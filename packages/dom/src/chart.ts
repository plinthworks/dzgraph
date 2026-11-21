/**
 * `chart(el, options, setup)` (D.5): mounts a chart in an element and keeps it drawn. Options in, the core's model,
 * layout and scene, then the painter. Its size is its container's (D.11: the height never follows the content; a
 * container without a height of its own gets `aspectRatio`). Redraws are gathered into one per frame.
 */
import type { ChartOptions, ChartUpdate, Problem, Scene, SeriesOptions } from '@dzgraph/core';
import type { ChartLayout, ChartModel, SeriesType } from '@dzgraph/core/internal';
import { composeScene, layout, normalize } from '@dzgraph/core/internal';
import { createMeasurer } from './measure.js';
import { messagesFor, type Messages } from './messages.js';
import { SvgPainter } from './svg-painter.js';
import type { Painter } from './painter.js';

export interface ChartSetup {
  /**
   * The series types this chart may draw (ADR 0005): `{ types: [line, column] }`. An app pays only for what it
   * imports; a series of another type is reported as `unknown-series-type`.
   */
  readonly types: readonly SeriesType[];
  /** Words to use instead of the built-in ones (any language; English and French ship). */
  readonly messages?: Partial<Messages>;
}

/** Events, by name; each handler receives one plain object. Phase 2 adds pointer, focus and legend events. */
export interface ChartEvents {
  /** The problems changed (after creation, `update()` or `setData()`). */
  readonly problems: { readonly problems: readonly Problem[] };
}

export interface Chart {
  /** Replaces the top-level fields given (series matched by `id`); draws on the next frame. */
  update(changes: ChartUpdate): void;
  /**
   * Replaces one series' data, the cheapest way to show new values. The shape is the series type's own; a shape the
   * type does not read is reported (`invalid-data`). The next `update()` that gives this series' data wins over it.
   */
  setData(seriesId: string, data: SeriesOptions['data']): void;
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

/** The container's content box, without the chart in it; a box without a height of its own takes `aspectRatio`. */
function containerSize(element: HTMLElement, root: HTMLElement, aspectRatio: number): { width: number; height: number } {
  root.style.display = 'none';
  const style = getComputedStyle(element);
  const padInline = Number.parseFloat(style.paddingInlineStart) + Number.parseFloat(style.paddingInlineEnd) || 0;
  const padBlock = Number.parseFloat(style.paddingBlockStart) + Number.parseFloat(style.paddingBlockEnd) || 0;
  const width = Math.max(0, Math.floor(element.clientWidth - padInline));
  const own = Math.max(0, Math.floor(element.clientHeight - padBlock));
  root.style.display = '';
  return { width, height: own > 0 ? own : Math.round(width / aspectRatio) };
}

/** The id a series has in the options: its own, or its default by position (normalize.ts). */
const idOf = (s: { readonly id?: unknown }, i: number) => (typeof s.id === 'string' && !s.id.startsWith('#') ? s.id : `#${i + 1}`);

export const chart: CreateChart = (element, initial, setup) => {
  const prefix = `dzgraph-${++charts}`;
  const root = document.createElement('div');
  root.className = 'dzgraph';
  root.style.position = 'relative';
  root.style.inlineSize = '100%';
  const svg = document.createElementNS(NS, 'svg');
  svg.style.display = 'block';
  root.appendChild(svg);
  element.appendChild(root);

  const painter: Painter = new SvgPainter(svg, prefix);
  const measurer = createMeasurer(root);
  const listeners = new Map<keyof ChartEvents, Set<(d: never) => void>>();
  let options: ChartOptions = initial;
  /** Data given by setData(), by series id, until an update gives that series' data. */
  const data = new Map<string, SeriesOptions['data']>();
  let problems: readonly Problem[] = [];
  let frame = 0;
  let destroyed = false;
  /** The options have changed since they were last read (update, setData): read them again before drawing. */
  let stale = true;
  /** The last reading and drawing: kept for hover, the tooltip's anchors, the keyboard and exports (Phase 2 on). */
  let current: { model: ChartModel; found: readonly Problem[]; layout: ChartLayout | null; scene: Scene | null } | null = null;
  /** The view (GLOSSARY: View): hidden series by id; `initiallyHidden` read once, when an id first appears. */
  const hidden = new Set<string>();
  const known = new Set<string>();

  const emit = <E extends keyof ChartEvents>(event: E, detail: ChartEvents[E]) => {
    for (const h of listeners.get(event) ?? []) (h as (d: ChartEvents[E]) => void)(detail);
  };

  /** Reads the options and data into the model, only when they changed (a resize does not re-read them). */
  const read = () => {
    const withData: ChartOptions = data.size
      ? { ...options, series: Array.isArray(options.series) ? options.series.map((s, i) => (isRecord(s) && data.has(idOf(s, i)) ? ({ ...s, data: data.get(idOf(s, i)) } as SeriesOptions) : s)) : options.series }
      : options;
    const { model, problems: found } = normalize(withData, setup.types);
    for (const s of model.series) {
      if (known.has(s.id)) continue;
      known.add(s.id);
      if (s.initiallyHidden) hidden.add(s.id);
    }
    current = { model, found, layout: null, scene: null };
    stale = false;
  };

  const render = () => {
    frame = 0;
    if (destroyed) return;
    if (stale || !current) read();
    const { model, found } = current!;

    // Size: the container's own, read with the chart out of it, so the chart never measures what it draws (D.11: the
    // height never follows the content). Without a height of its own: from the width and the aspect ratio.
    const { width, height } = containerSize(element, root, model.aspectRatio);
    root.style.blockSize = `${height}px`;

    const style = getComputedStyle(element);
    const dir = model.dir ?? (style.direction === 'rtl' ? 'rtl' : 'ltr');
    const locale = model.locale ?? resolveLocale(element.closest('[lang]')?.getAttribute('lang'), navigator.language);
    const messages = messagesFor(locale, setup.messages);
    const view = { hidden };
    const laid = layout({ model, types: setup.types, width, height, dir, measureText: measurer.measureText, text: messages, locale, view });
    const scene = composeScene({ model, types: setup.types, layout: laid, measureText: measurer.measureText, view });
    // Phase 1: the SVG painter draws every group, those the scene gives to Canvas included (Phase 3 routes them).
    painter.paint(scene, { font: measurer.font }, () => true);
    current = { model, found, layout: laid, scene };

    // Who reads it (Phase 2 adds the full description, keyboard and data table).
    svg.setAttribute('role', 'img');
    const name = model.description ?? model.title?.text ?? null;
    if (name) svg.setAttribute('aria-label', name);
    else svg.removeAttribute('aria-label');

    const next = [...found, ...laid.problems];
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
          schedule();
        },
        () => {
          // A font that never loads keeps its fallback: nothing to redo.
        },
      );
    }
  };

  const schedule = () => {
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
      schedule();
    },
    setData(seriesId, values) {
      if (destroyed) return;
      data.set(seriesId, values);
      stale = true;
      schedule();
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
      root.remove();
      listeners.clear();
      data.clear();
      current = null;
    },
  };
};
