/**
 * `chart(el, options, setup)` (D.5): mounts a chart in an element and keeps it drawn. Its size is its container's
 * (D.11: the height never follows the content; a container without a height of its own gets `aspectRatio`). Redraws
 * are gathered into one per frame, in stages each redone only when what it depends on changed:
 *
 * 1. reading the options into the model — when they change (`update`, `setData`);
 * 2. layout — when the model, the view, the size, the direction, the locale or the fonts change;
 * 3. the scene — every drawing (a highlight changes only opacities), painted at once or animated;
 * 4. the aids (summary, keyboard items, legend buttons, data table) — when the layout changes.
 */
import type { ChartOptions, ChartUpdate, PointRef, Problem, Scene, SeriesOptions } from '@dzgraph/core';
import type { ChartLayout, ChartModel, SeriesType, View } from '@dzgraph/core/internal';
import { appearFrom, composeScene, layout, normalize, seriesName, summary, withKey } from '@dzgraph/core/internal';
import { createMeasurer } from './measure.js';
import { messagesFor, type Messages } from './messages.js';
import { SvgPainter } from './svg-painter.js';
import type { Painter } from './painter.js';
import { Hover } from './hover.js';
import { LegendButtons } from './legend.js';
import { PointItems } from './keyboard.js';
import { Animator, type AnimateHook } from './animator.js';
import { hideVisually, writeTable } from './table.js';

export interface ChartSetup {
  /**
   * The series types this chart may draw (ADR 0005): `{ types: [line, column] }`. An app pays only for what it
   * imports; a series of another type is reported as `unknown-series-type`.
   */
  readonly types: readonly SeriesType[];
  /** Words to use instead of the built-in ones (any language; English and French ship). */
  readonly messages?: Partial<Messages>;
  /** Drive the animations yourself (animation.md 6), GSAP for instance: called instead of DzGraph's own timing. */
  readonly animate?: (animation: AnimateHook) => void;
}

/** Events, by name; each handler receives one plain object. Points carry their key when the app gave one. */
export interface ChartEvents {
  /** The problems changed (after creation, `update()` or `setData()`). */
  readonly problems: { readonly problems: readonly Problem[] };
  /** The point under the pointer changed; `null` when it leaves (hover-tooltip.md 11). The pointer only. */
  readonly pointHover: { readonly point: PointRef | null };
  /** A point was clicked, tapped, or chosen with Enter (hover-tooltip.md 11, keyboard.md 6). */
  readonly pointClick: { readonly point: PointRef };
  /** The keyboard focus moved to a point (keyboard.md 6). */
  readonly pointFocus: { readonly point: PointRef };
  /** A series was hidden or shown, from the legend or `setSeriesVisible` (legend-interaction.md 5). */
  readonly legendToggle: { readonly seriesId: string; readonly shown: boolean };
}

export interface Chart {
  /** Replaces the top-level fields given (series matched by `id`); draws on the next frame. */
  update(changes: ChartUpdate): void;
  /**
   * Replaces one series' data, the cheapest way to show new values. The shape is the series type's own; a shape the
   * type does not read is reported (`invalid-data`). The next `update()` that gives this series' data wins over it.
   */
  setData(seriesId: string, data: SeriesOptions['data']): void;
  /** Hides or shows a series, as its legend item does (GLOSSARY: Hidden series). */
  setSeriesVisible(seriesId: string, visible: boolean): void;
  /** What is wrong with the current options and data, if anything. */
  readonly problems: readonly Problem[];
  /** Listens to an event; returns the function that stops listening. */
  on<E extends keyof ChartEvents>(event: E, handler: (detail: ChartEvents[E]) => void): () => void;
  /** Removes everything the chart added (elements, observers, listeners). Calling it twice does nothing. */
  destroy(): void;
}

/** The signature of `chart()`. */
export type CreateChart = (element: HTMLElement, options: ChartOptions, setup: ChartSetup) => Chart;

const NS = 'http://www.w3.org/2000/svg';
let charts = 0;
/** Durations (owner 2026-11-21, animation.md 1–2). */
const APPEAR_MS = 400;
const UPDATE_MS = 250;

/** A locale Intl accepts: the given one, else the page's, else English (review 1: `lang="en_US"` is a common slip). */
function resolveLocale(...candidates: readonly (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    try {
      const [canonical] = Intl.getCanonicalLocales(c);
      if (canonical) return canonical;
    } catch {
      // Not a language tag: the next one.
    }
  }
  return 'en';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The container's content box, the chart and its table out of it; a box without a height takes `aspectRatio`. */
function containerSize(element: HTMLElement, root: HTMLElement, aspectRatio: number, table: HTMLElement): { width: number; height: number } {
  root.style.display = 'none';
  const tableDisplay = table.style.display;
  table.style.display = 'none';
  const style = getComputedStyle(element);
  const padInline = Number.parseFloat(style.paddingInlineStart) + Number.parseFloat(style.paddingInlineEnd) || 0;
  const padBlock = Number.parseFloat(style.paddingBlockStart) + Number.parseFloat(style.paddingBlockEnd) || 0;
  const width = Math.max(0, Math.floor(element.clientWidth - padInline));
  const own = Math.max(0, Math.floor(element.clientHeight - padBlock));
  root.style.display = '';
  table.style.display = tableDisplay;
  return { width, height: own > 0 ? own : Math.round(width / aspectRatio) };
}

/** The id a series has in the options: its own, or its default by position (normalize.ts). */
const idOf = (s: { readonly id?: unknown }, i: number) => (typeof s.id === 'string' && !s.id.startsWith('#') ? s.id : `#${i + 1}`);

export const chart: CreateChart = (element, initial, setup) => {
  const prefix = `dzgraph-${++charts}`;

  // ---- Elements: the figure, its drawing, its aids; then the table, after the chart (data-table.md 2). ----
  const root = document.createElement('div');
  root.className = 'dzgraph';
  root.style.position = 'relative';
  root.style.inlineSize = '100%';
  root.setAttribute('role', 'figure');
  const svg = document.createElementNS(NS, 'svg');
  svg.style.display = 'block';
  // Horizontal slides stay with the chart's tooltip; vertical ones scroll the page (hover-tooltip.md 9).
  svg.style.touchAction = 'pan-y';
  root.appendChild(svg);
  const described = document.createElement('div');
  described.id = `${prefix}-summary`;
  described.className = 'dzgraph-sr-only';
  hideVisually(described);
  root.setAttribute('aria-describedby', described.id);
  const live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.className = 'dzgraph-sr-only';
  hideVisually(live);
  root.append(described, live);
  const tableBox = document.createElement('div');
  element.append(root, tableBox);

  const painter: Painter = new SvgPainter(svg, prefix);
  const measurer = createMeasurer(root);
  /** Every painter's groups (ADR 0002): Phase 1–2 has one painter, SVG, which draws them all; Phase 3 routes them. */
  const paintAll = (scene: Scene) => painter.paint(scene, { font: measurer.font }, () => true);
  const animator = new Animator(paintAll);

  // ---- State. ----
  const listeners = new Map<keyof ChartEvents, Set<(d: never) => void>>();
  let options: ChartOptions = initial;
  /** Data given by setData(), by series id, until an update gives that series' data. */
  const data = new Map<string, SeriesOptions['data']>();
  let problems: readonly Problem[] = [];
  let frame = 0;
  let destroyed = false;
  /** The options changed since they were last read. */
  let stale = true;
  let model: ChartModel | null = null;
  let found: readonly Problem[] = [];
  /** The view (GLOSSARY: View): hidden series by id; `initiallyHidden` read once, when an id first appears. */
  const hidden = new Set<string>();
  const known = new Set<string>();
  const view: View = { hidden };
  /** Bumped when the view changes, so the layout is redone. */
  let viewVersion = 0;
  /** Bumped when a font arrives, so the layout is measured again. */
  let fontVersion = 0;
  /** The series pointed at (GLOSSARY: Highlight): passing, not part of the view. */
  let highlight: string | undefined;
  /** The last layout and its key; the last scene. */
  let laid: ChartLayout | null = null;
  let laidKey = '';
  let scene: Scene | null = null;
  /** The locale and messages of the last drawing. */
  let words: { locale: string; messages: Messages } = { locale: 'en', messages: messagesFor('en', setup.messages) };
  /** Why the next drawing happens: the first one appears, a change of data or view moves, the rest is at once. */
  let reason: 'initial' | 'data' | 'immediate' = 'initial';

  const emit = <E extends keyof ChartEvents>(event: E, detail: ChartEvents[E]) => {
    for (const h of listeners.get(event) ?? []) (h as (d: ChartEvents[E]) => void)(detail);
  };
  const keyed = (p: PointRef) => (model ? withKey(model, p) : p);

  // ---- Stage 1: the options read into the model. ----
  const read = () => {
    const withData: ChartOptions = data.size
      ? { ...options, series: Array.isArray(options.series) ? options.series.map((s, i) => (isRecord(s) && data.has(idOf(s, i)) ? ({ ...s, data: data.get(idOf(s, i)) } as SeriesOptions) : s)) : options.series }
      : options;
    const r = normalize(withData, setup.types);
    model = r.model;
    found = r.problems;
    for (const s of model.series) {
      if (known.has(s.id)) continue;
      known.add(s.id);
      if (s.initiallyHidden) {
        hidden.add(s.id);
        viewVersion++;
      }
    }
    stale = false;
    laidKey = '';
  };

  const render = () => {
    frame = 0;
    if (destroyed) return;
    if (stale || !model) read();
    const m = model!;

    // ---- Stage 2: layout, redone only when what it depends on changed. ----
    const { width, height } = containerSize(element, root, m.aspectRatio, tableBox);
    root.style.blockSize = `${height}px`;
    const dir = m.dir ?? (getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr');
    const locale = m.locale ?? resolveLocale(element.closest('[lang]')?.getAttribute('lang'), navigator.language);
    const messages = messagesFor(locale, setup.messages);
    words = { locale, messages };
    const key = `${width}x${height}|${dir}|${locale}|${viewVersion}|${fontVersion}`;
    const relaid = !laid || key !== laidKey;
    if (relaid) {
      laid = layout({ model: m, types: setup.types, width, height, dir, measureText: measurer.measureText, text: messages, locale, view });
      laidKey = key;
    }
    const l = laid!;

    // ---- Stage 3: the scene, at once or animated (animation.md). ----
    scene = composeScene({ model: m, types: setup.types, layout: l, measureText: measurer.measureText, view, ...(highlight !== undefined ? { highlight } : {}) });
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = m.animation && !reduced;
    const why = reason;
    reason = 'immediate';
    // The reveal starts where the x axis starts on screen: read from its scale (mirrored, reversed or not).
    const xs = l.axes.find((a) => a.dimension === 'x')?.scale;
    const fromXMax = m.orientation === 'vertical' && xs !== undefined && xs.map(1) < xs.map(0);
    if (motion && why === 'initial') animator.animate(appearFrom(scene, { fromXMax }), scene, APPEAR_MS, setup.animate);
    else if (motion && why === 'data' && animator.shown) animator.animate(animator.shown, scene, UPDATE_MS, setup.animate);
    else animator.jump(scene);

    // ---- Stage 4: the aids, with the layout (screen-reader.md, keyboard.md, legend-interaction.md, data-table.md). ----
    if (relaid) {
      root.setAttribute('aria-label', m.title?.text ?? m.description ?? messages.chart);
      const sum = messages.summary(summary(m, l, view, locale, messages));
      described.textContent = m.description ? `${sum} ${m.description}` : sum;
      items.update({ model: m, layout: l, view, locale, messages });
      legend.update(m, l, view, messages);
      writeTable(tableBox, m, l, view, locale, messages);
    }

    const next = [...found, ...l.problems];
    if (JSON.stringify(next) !== JSON.stringify(problems)) {
      problems = next;
      emit('problems', { problems });
    }
    // A font measured before it arrived: lay out again once it has (spike S2).
    for (const font of measurer.pending()) {
      void document.fonts.load(font).then(
        () => {
          if (destroyed) return;
          measurer.refresh();
          fontVersion++;
          schedule();
        },
        () => {
          // A font that never loads keeps its fallback: nothing to redo.
        },
      );
    }
  };

  /** Asks for a drawing on the next frame; `data` (an update, a change of view) animates, the others do not. */
  const schedule = (why: 'data' | 'immediate' = 'immediate') => {
    if (why === 'data') reason = 'data';
    if (!frame && !destroyed) frame = requestAnimationFrame(() => drawn());
  };

  // The container's content box as last drawn: the observer's first report, and the one our own height causes in a
  // container without a height, are not changes (review 13: one drawing at creation).
  let drawnSize = '';
  const contentSize = () => {
    const s = getComputedStyle(element);
    const w = element.clientWidth - (Number.parseFloat(s.paddingInlineStart) + Number.parseFloat(s.paddingInlineEnd) || 0);
    const h = element.clientHeight - (Number.parseFloat(s.paddingBlockStart) + Number.parseFloat(s.paddingBlockEnd) || 0);
    return `${Math.round(w)}x${Math.round(h)}`;
  };
  const drawn = () => {
    render();
    drawnSize = contentSize();
  };

  // ---- Interaction: hover, keyboard items, legend buttons. ----
  const setHighlight = (id: string | undefined) => {
    const next = model?.highlight && id !== undefined && !hidden.has(id) ? id : undefined;
    if (next === highlight) return;
    highlight = next;
    schedule();
  };
  const setVisible = (id: string, visible: boolean) => {
    if (visible === !hidden.has(id)) return;
    if (visible) hidden.delete(id);
    else hidden.add(id);
    viewVersion++;
    if (!visible && highlight === id) highlight = undefined;
    const s = model?.series.find((o) => o.id === id);
    const name = s ? seriesName(s, words.messages) : id;
    live.textContent = visible ? words.messages.seriesShown(name) : words.messages.seriesHidden(name);
    emit('legendToggle', { seriesId: id, shown: visible });
    schedule('data');
  };

  const hover = new Hover(root, svg, {
    state: () => (model && laid && scene ? { model, layout: laid, scene, locale: words.locale, text: words.messages, font: (r) => measurer.font(r), view } : null),
    highlight: setHighlight,
    hovered: (point) => emit('pointHover', { point: point && keyed(point) }),
    clicked: (point) => emit('pointClick', { point: keyed(point) }),
  });
  // The aids go over the drawing and the hover layer, last: the painter puts its layers before them and never moves
  // them again, so a redraw never moves a focused item (review 1: moving it would drop the focus to <body>).
  const a11y = document.createElementNS(NS, 'g');
  a11y.setAttribute('class', 'dzgraph-a11y');
  const itemsGroup = document.createElementNS(NS, 'g');
  const legendGroup = document.createElementNS(NS, 'g');
  a11y.append(itemsGroup, legendGroup);
  svg.appendChild(a11y);
  const items = new PointItems(itemsGroup, {
    focused: (point) => {
      hover.focus(hover.findPoint(point));
      emit('pointFocus', { point: keyed(point) });
    },
    leave: () => hover.focus(null),
    clicked: (point) => emit('pointClick', { point: keyed(point) }),
    escape: () => hover.hideTooltip(),
  });
  const legend = new LegendButtons(legendGroup, { toggle: (id) => setVisible(id, hidden.has(id)), highlight: setHighlight });

  const resize = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (box && `${Math.round(box.width)}x${Math.round(box.height)}` === drawnSize) return;
    schedule();
  });
  resize.observe(element);
  drawn();

  return {
    update(changes) {
      // Plain JavaScript may pass anything: what is not an object changes nothing; a bad field is reported by the
      // core like any option (review 12).
      if (destroyed || !isRecord(changes)) return;
      // A series whose data the update gives takes it over data given earlier by setData().
      if (Array.isArray(changes.series)) changes.series.forEach((s, i) => isRecord(s) && 'data' in s && data.delete(idOf(s, i)));
      const next: Record<string, unknown> = { ...options };
      for (const [k, v] of Object.entries(changes)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      options = next as unknown as ChartOptions;
      stale = true;
      schedule('data');
    },
    setData(seriesId, values) {
      if (destroyed) return;
      data.set(seriesId, values);
      stale = true;
      schedule('data');
    },
    setSeriesVisible(seriesId, visible) {
      if (!destroyed) setVisible(seriesId, visible);
    },
    get problems() {
      return problems;
    },
    on(event, handler) {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(handler as (d: never) => void);
      return () => set.delete(handler as (d: never) => void);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      resize.disconnect();
      animator.stop();
      hover.destroy();
      root.remove();
      tableBox.remove();
      listeners.clear();
      data.clear();
      model = null;
      laid = null;
      scene = null;
    },
  };
};
