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
import type { ChartOptions, ChartUpdate, Group, PointRef, Problem, Scene, SeriesOptions } from '@dzgraph/core';
import type { ChartLayout, ChartModel, Extent, Range, SeriesType, View } from '@dzgraph/core/internal';
import { appearFrom, clampRange, composeScene, extentOf, layout, normalize, seriesName, summary, validOrder, withKey, xValueLabel } from '@dzgraph/core/internal';
import { createMeasurer } from './measure.js';
import { messagesFor, type Messages } from './messages.js';
import { SvgPainter } from './svg-painter.js';
import type { GestureFrame } from './gestures.js';
import { resolveFeatures, type Feature } from './features.js';
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
  /**
   * The features this chart may use (ADR 0006): `{ features: [timeAxis, zoom] }`, or `allFeatures`. An option whose
   * module is missing is reported as `missing-module`; without `canvas` every series is drawn in SVG.
   */
  readonly features?: readonly Feature[];
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
  /** A series, or a slice (its `index`, ADR 0007), hidden or shown from the legend. */
  readonly legendToggle: { readonly seriesId: string; readonly index?: number; readonly shown: boolean };
  /** The x axis's visible range changed (zoom-pan.md 9): its bounds, or `null` back to the whole data. */
  readonly rangeChange: { readonly range: { readonly min: number; readonly max: number } | null };
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
  /**
   * Shows a part of the x axis (GLOSSARY: Visible range), kept inside the data; `null` shows all of it. On a time
   * axis the ends may be ISO date-times or days, read in its zone. Anything else is reported (`invalid-option`).
   */
  setRange(range: { readonly min: number | string; readonly max: number | string } | null): void;
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
/** How long a gesture rests before the summary, the points and the table are written again. */
const AIDS_REST_MS = 200;
/** A range covering the whole extent is no zoom. */
const wholeOrNull = (r: Range, e: Extent): Range | null => (r.min <= e.min && r.max >= e.max ? null : r);
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
  // The planes stack inside the chart, never with the page's.
  root.style.isolation = 'isolate';
  root.style.inlineSize = '100%';
  root.setAttribute('role', 'figure');
  // Three planes, back to front (ADR 0002): an SVG for the background and the grid, a Canvas for series of many marks,
  // the main SVG for the rest (other series, axes, labels, legend), the hover layer and the aids. The main SVG comes
  // first in the document (it is the chart's drawing for readers and scripts) and is raised above the two others.
  const svg = document.createElementNS(NS, 'svg');
  // Horizontal slides stay with the chart's tooltip; vertical ones scroll the page (hover-tooltip.md 9).
  Object.assign(svg.style, { display: 'block', position: 'relative', zIndex: '1', touchAction: 'pan-y' });
  root.appendChild(svg);
  const back = document.createElementNS(NS, 'svg');
  back.setAttribute('aria-hidden', 'true');
  Object.assign(back.style, { position: 'absolute', insetBlockStart: '0', insetInlineStart: '0', pointerEvents: 'none' });
  root.appendChild(back);
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

  const features = resolveFeatures(setup.features);
  const backPainter: Painter = new SvgPainter(back, `${prefix}-b`);
  // Planes back to front (ADR 0008): the back SVG, WebGL2, Canvas, the main SVG; each painter adds its own in order.
  const webglPainter = features.webgl ? features.webgl(root, () => animator.shown && paintAll(animator.shown)) : null;
  const canvasPainter = features.canvas ? features.canvas(root) : null;
  const painter: Painter = new SvgPainter(svg, prefix);
  const measurer = createMeasurer(root);
  /** Each painter gets its groups (ADR 0002): background and grid behind, Canvas groups in the middle, the rest in front. */
  const behind = (layer: string) => layer === 'background' || layer === 'grid';
  const paintAll = (s: Scene) => {
    const opts = { font: measurer.font };
    backPainter.paint(s, opts, (_g, layer) => behind(layer));
    // WebGL2 groups go to Canvas when WebGL2 cannot draw them (no module, no WebGL2, context lost; its context opened
    // only when one comes), and Canvas groups to SVG without the Canvas module, in the same order: first in each layer.
    const gl = webglPainter !== null && s.layers.some((l) => l.groups.some((g) => g.painter === 'webgl2')) && webglPainter.ready();
    const raster = (g: Group) => g.painter === 'canvas' || (g.painter === 'webgl2' && !gl);
    webglPainter?.paint(s, opts, (g, layer) => !behind(layer) && gl && g.painter === 'webgl2');
    canvasPainter?.paint(s, opts, (g, layer) => !behind(layer) && raster(g));
    painter.paint(s, opts, (g, layer) => !behind(layer) && (g.painter === 'svg' || (!canvasPainter && raster(g))));
  };
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
  let view: View = { hidden };
  /** The first x axis's visible range (GLOSSARY: Visible range); null: the whole data. */
  let range: Range | null = null;
  /** A gesture is changing the range frame after frame: the aids wait for it to rest. */
  let moving = false;
  let lastRangeAt = -Infinity;
  let aidsTimer: ReturnType<typeof setTimeout> | 0 = 0;
  /** Bumped when the view changes, so the layout is redone. */
  let viewVersion = 0;
  /** Bumped when a font arrives, so the layout is measured again. */
  let fontVersion = 0;
  /** The series pointed at (GLOSSARY: Highlight): passing, not part of the view. */
  let highlight: string | undefined;
  /** The last layout and its key; the last scene. */
  let laid: ChartLayout | null = null;
  let laidKey = '';
  /** The container's size as last measured; null: measure again. */
  let measured: { width: number; height: number } | null = null;
  /** What was wrong with the last `setRange()` call, until a good one (CLAUDE.md: bad input becomes a Problem). */
  let callProblem: Problem | null = null;
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
    // The page's zone, the default of a time axis (time-axis.md 2): read here, the core never reads the host.
    const r = normalize(withData, setup.types, { zone: new Intl.DateTimeFormat().resolvedOptions().timeZone, kit: features.kit });
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
    // The aspect ratio or the direction may have changed: measured again.
    measured = null;
    // New data: the range stays inside it, or goes back to the whole (zoom-pan.md 5).
    if (range) {
      const e = xExtent();
      applyRange(e && e.max > e.min ? wholeOrNull(clampRange(range, e), e) : null);
    }
  };

  const render = () => {
    frame = 0;
    if (destroyed) return;
    if (stale || !model) read();
    const m = model!;

    // ---- Stage 2: layout, redone only when what it depends on changed. ----
    // The container is measured when it may have changed (created, resized, new options), not at every frame of a
    // zoom: reading styles forces the browser to compute them (big-data.md 4).
    if (!measured) {
      measured = containerSize(element, root, m.aspectRatio, tableBox);
      root.style.blockSize = `${measured.height}px`;
      drawnSize = contentSize();
    }
    const { width, height } = measured;
    // Direction and language at every drawing: a page may switch them without resizing anything (review 9).
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
      // The summary, the points' items and the table read the data: during a gesture (a drag, the wheel, a pinch)
      // they are written once it rests, not at every frame (big-data.md 4); otherwise at once.
      if (aidsTimer) clearTimeout(aidsTimer);
      aidsTimer = 0;
      const writeAids = () => {
        aidsTimer = 0;
        if (destroyed || !model || !laid) return;
        const sum = words.messages.summary(summary(model, laid, view, words.locale, words.messages));
        described.textContent = model.description ? `${sum} ${model.description}` : sum;
        items.update({ model, layout: laid, view, locale: words.locale, messages: words.messages });
        writeTable(tableBox, model, laid, view, words.locale, words.messages, tableMode(), toggleTable);
      };
      if (moving && !items.hasFocus) aidsTimer = setTimeout(writeAids, AIDS_REST_MS);
      else writeAids();
      moving = false;
      legend.update(m, l, view, messages);
      navPart?.update(width, dir);
      zoomPart?.place(l.plot, width, dir, range, messages.resetZoom);
    }

    const next = [...found, ...l.problems, ...(callProblem ? [callProblem] : [])];
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
  const drawn = () => render();

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
    // A slice's item (ADR 0007): named and reported as the slice of its series.
    const item = laid?.legend?.items.find((i) => i.key === id && i.point);
    const name = s ? seriesName(s, words.messages) : (item?.name ?? id);
    live.textContent = visible ? words.messages.seriesShown(name) : words.messages.seriesHidden(name);
    emit('legendToggle', item?.point ? { seriesId: item.seriesId, index: item.point.index, shown: visible } : { seriesId: id, shown: visible });
    schedule('data');
  };

  // ---- Zoom and pan (zoom-pan.md): the range is part of the view; gestures and keys only propose ranges. ----
  const xAxisId = () => laid?.axes.find((a) => a.dimension === 'x')?.id ?? model?.xAxes[0]?.id;
  const xExtent = () => {
    const id = xAxisId();
    return model && id !== undefined ? extentOf(model, id) : null;
  };
  /** Sets the range and the view; tells the app. Drawing is the caller's. */
  const applyRange = (r: Range | null) => {
    if (r === range || (r && range && r.min === range.min && r.max === range.max)) return false;
    range = r;
    const id = xAxisId();
    view = r && id !== undefined ? { hidden, range: { [id]: r } } : { hidden };
    viewVersion++;
    emit('rangeChange', { range: r && { min: r.min, max: r.max } });
    return true;
  };
  const setRange = (r: Range | null, how: 'animate' | 'now', from: 'pointer' | 'keyboard') => {
    if (!applyRange(r)) return;
    // A gesture, or changes coming faster than the aids' rest (an app's own slider, linked charts): moving.
    const now = performance.now();
    moving = (how === 'now' && from === 'pointer') || now - lastRangeAt < AIDS_REST_MS;
    lastRangeAt = now;
    if (from === 'keyboard' && model) {
      const id = xAxisId()!;
      live.textContent = r ? words.messages.rangeShown(xValueLabel(model, id, r.min, words.locale), xValueLabel(model, id, r.max, words.locale)) : words.messages.rangeWhole;
      keepFocusInView();
    }
    schedule(how === 'animate' ? 'data' : 'immediate');
  };
  /** The focused point, when a key moved the range past it, gives the focus to its series' nearest point in view. */
  const keepFocusInView = () => {
    const at = items.activePoint;
    if (!range || !at || !items.hasFocus || !model) return;
    const s = model.series.find((o) => o.id === at.seriesId);
    if (!s) return;
    const x = s.columns.x[at.index]!;
    if (x >= range.min && x <= range.max) return;
    const target = Math.min(Math.max(x, range.min), range.max);
    let best = -1;
    for (const i of validOrder(s)) {
      const v = s.columns.x[i]!;
      if (v < range.min || v > range.max) continue;
      if (best === -1 || Math.abs(v - target) < Math.abs(s.columns.x[best]! - target)) best = i;
    }
    if (best !== -1) items.focusPoint({ seriesId: s.id, index: best });
  };
  const frameOf = (): GestureFrame | null => {
    const axis = laid?.axes.find((a) => a.dimension === 'x');
    const e = xExtent();
    if (!model || !laid || !axis || !e || !(e.max > e.min)) return null;
    const shown = range ?? { min: e.min, max: e.max };
    return { plot: laid.plot, horizontal: model.orientation === 'vertical', ends: [axis.scale.map(shown.min), axis.scale.map(shown.max)], extent: e, shown, zoomed: range !== null };
  };

  // Gestures and the navigator listen before the hover (review 10): on the move that starts a drag, or the finger
  // that starts a pinch, `busy()` is already true when the hover asks.
  // Each only when its module came (ADR 0006).
  const zoomPart =
    features.zoom?.(root, svg, {
      frame: frameOf,
      setRange,
      // The reset button goes: the focus goes back to the points rather than to the page.
      refocus: () => {
        const at = items.activePoint;
        if (at) items.focusPoint(at);
      },
    }) ?? null;
  const navGroup = document.createElementNS(NS, 'g');
  const navPart =
    features.navigator?.(svg, navGroup, root, {
      state: () => (model && laid ? { model, layout: laid, range, locale: words.locale, messages: words.messages } : null),
      setRange: (r, how) => setRange(r, how, 'pointer'),
    }) ?? null;
  const hover = new Hover(root, svg, {
    busy: () => (zoomPart?.busy() ?? false) || (navPart?.busy() ?? false),
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
  a11y.append(itemsGroup, legendGroup, navGroup);
  svg.appendChild(a11y);
  const items = new PointItems(itemsGroup, {
    focused: (point) => {
      hover.focus(hover.findPoint(point));
      emit('pointFocus', { point: keyed(point) });
    },
    leave: () => hover.focus(null),
    clicked: (point) => emit('pointClick', { point: keyed(point) }),
    escape: () => hover.hideTooltip(),
    key: (e, point) => {
      const s = model?.series.find((o) => o.id === point.seriesId);
      return zoomPart?.key(e, s ? s.columns.x[point.index]! : null) ?? false;
    },
  });
  // ---- The table's range (data-table.md 5): the visible range, or all the data. ----
  /** The user's choice, once they made one; until then the app's (`dataTable.rows`). */
  let tableWhich: 'visible' | 'all' | null = null;
  const tableMode = () => tableWhich ?? model?.dataTableRows ?? 'visible';
  const toggleTable = () => {
    tableWhich = tableMode() === 'all' ? 'visible' : 'all';
    if (model && laid) writeTable(tableBox, model, laid, view, words.locale, words.messages, tableWhich, toggleTable);
    tableBox.querySelector<HTMLButtonElement>('.dzgraph-table-range')?.focus();
  };

  const legend = new LegendButtons(legendGroup, { toggle: (id) => setVisible(id, hidden.has(id)), highlight: setHighlight });

  const resize = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (box && `${Math.round(box.width)}x${Math.round(box.height)}` === drawnSize) return;
    measured = null;
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
    setRange(r) {
      if (destroyed) return;
      const wrong = () => {
        callProblem = { code: 'invalid-option', path: 'setRange' };
        schedule();
      };
      if (r === null) {
        callProblem = null;
        schedule();
        return setRange(null, 'animate', 'pointer');
      }
      // Plain JavaScript may pass anything: a range is { min, max }, numbers, or ISO strings on a time axis.
      if (!isRecord(r)) return wrong();
      const e = xExtent();
      const axis = model?.xAxes.find((a) => a.id === xAxisId());
      const read = (v: unknown) => {
        if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN;
        const time = model?.kit.time;
        if (typeof v === 'string' && axis?.scale === 'time' && time) {
          const t = time.parse(v, axis.zone ?? 'UTC');
          return typeof t === 'number' ? t : Number.NaN;
        }
        return Number.NaN;
      };
      const min = read(r['min']);
      const max = read(r['max']);
      if (!e || !(min < max)) return wrong();
      callProblem = null;
      schedule();
      setRange(wholeOrNull(clampRange({ min, max }, e), e), 'animate', 'pointer');
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
      if (aidsTimer) clearTimeout(aidsTimer);
      frame = 0;
      resize.disconnect();
      animator.stop();
      hover.destroy();
      zoomPart?.destroy();
      canvasPainter?.destroy();
      webglPainter?.destroy();
      navPart?.destroy();
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
