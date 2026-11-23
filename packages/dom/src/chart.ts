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
import type { Aggregated, ChartLayout, ChartModel, ChartView, Extent, Range, SelectShape, SeriesType, View } from '@dzgraph/core/internal';
import { appearFrom, clampRange, composeScene, extentOf, hasDetail, screenStep, layout, normalize, pointAt, seriesName, summary, validOrder, viewFromJson, viewToJson, withKey, xValueLabel } from '@dzgraph/core/internal';
import { createMeasurer } from './measure.js';
import { messagesFor, type Messages } from './messages.js';
import { SvgPainter } from './svg-painter.js';
import type { GestureFrame } from './gestures.js';
import { resolveFeatures, type Feature } from './features.js';
import type { Mode } from './modes.js';
import type { ExportFormat, ExportOptions, ExportState, PngOptions } from './exporting.js';
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
  readonly pointHover: { readonly point: PointRef | null; /** Its x value, for linked charts (linked-charts.md 1). */ readonly x?: number };
  /** A point was clicked, tapped, or chosen with Enter (hover-tooltip.md 11, keyboard.md 6). */
  readonly pointClick: { readonly point: PointRef };
  /** The keyboard focus moved to a point (keyboard.md 6). */
  readonly pointFocus: { readonly point: PointRef };
  /** A series was hidden or shown, from the legend or `setSeriesVisible` (legend-interaction.md 5). */
  /** A series, or a slice (its `index`, ADR 0007), hidden or shown from the legend. */
  readonly legendToggle: { readonly seriesId: string; readonly index?: number; readonly shown: boolean };
  /** The x axis's visible range changed (zoom-pan.md 9): its bounds, or `null` back to the whole data. */
  readonly rangeChange: { readonly range: { readonly min: number; readonly max: number } | null };
  /**
   * The view changed (view-state.md 4): the whole view, what changed in it, and who changed it. A gesture's frames give
   * one event once it rests.
   */
  readonly viewChange: { readonly view: ChartView; readonly changed: readonly ViewPart[]; readonly source: 'user' | 'app' };
  /** The mode changed (modes.md 6): what a drag across the plot does. */
  readonly modeChange: { readonly mode: Mode };
  /**
   * The selection changed (selection.md 9): how many points, and per series the indices and keys selected. Never in a
   * `Problem`.
   */
  readonly selectionChange: { readonly count: number; readonly series: readonly { readonly id: string; readonly indices: Int32Array; readonly keys: readonly (string | null)[] | null; readonly xs: Float64Array }[] };
  /** A measure was kept between two points, or went (null) (measure.md 7). Not part of the view. */
  readonly measure: { readonly from: PointRef; readonly to: PointRef } | null;
  /** The drill level changed (drilldown.md 7): the keys from the root to the level shown. */
  readonly drill: { readonly path: readonly string[] };
}

/** The parts of a view (view-state.md 1). */
export type ViewPart = 'hidden' | 'range' | 'compare' | 'selection' | 'aggregation' | 'drill' | 'types' | 'scale';

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
  /** The user's exploration as JSON (view-state.md 2): save it, put it in a URL, give it back to `setView`. */
  getView(): ChartView;
  /**
   * Brings a view back (view-state.md 3). What it names that no longer exists is left out and reported
   * (`invalid-view`); what it does not say is left as it is.
   */
  setView(view: ChartView): void;
  /**
   * Shows the tooltip and the crosshair at an x value, as if pointed at there (linked-charts.md 1); null clears them.
   * Not told back as `pointHover`.
   */
  showX(x: number | null): void;
  /** Selects the points with these keys, or these x values (linked-charts.md 3); not told back as `selectionChange`. */
  selectBy(by: 'key' | 'x', values: readonly (string | number)[]): void;
  /** What a drag across the plot does (modes.md): a mode the chart has (its modules), else nothing changes. */
  setMode(mode: Mode): void;
  /**
   * The view as a standalone SVG document, without the controls (export.md); null without the `exporting` module
   * (reported `missing-module`).
   */
  exportSvg(options?: ExportOptions): string | null;
  /** The view as a PNG (export.md 5); null without the `exporting` module, or when the browser cannot draw it. */
  exportPng(options?: PngOptions): Promise<Blob | null>;
  /** The data as CSV, the rows the table shows (csv.md); `locale`: the language's separators. Null without the module. */
  exportCsv(options?: { readonly locale?: boolean }): string | null;
  /** Gives the browser the export as a file to save, named after the title (export.md 8). */
  download(format: ExportFormat, options?: PngOptions): Promise<void>;
  /** Prints the chart alone, in light colours; `table`: its data table under it (print.md). */
  print(options?: { readonly table?: boolean }): void;
  readonly mode: Mode;
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
function containerSize(element: HTMLElement, root: HTMLElement, aspectRatio: number, table: HTMLElement, above: HTMLElement | null): { width: number; height: number } {
  root.style.display = 'none';
  const tableDisplay = table.style.display;
  table.style.display = 'none';
  const style = getComputedStyle(element);
  const padInline = Number.parseFloat(style.paddingInlineStart) + Number.parseFloat(style.paddingInlineEnd) || 0;
  const padBlock = Number.parseFloat(style.paddingBlockStart) + Number.parseFloat(style.paddingBlockEnd) || 0;
  const width = Math.max(0, Math.floor(element.clientWidth - padInline));
  // The breadcrumb above the chart takes its own room out of the container's (drilldown.md 4).
  const own = Math.max(0, Math.floor(element.clientHeight - padBlock - (above && !above.hidden ? above.offsetHeight : 0)));
  root.style.display = '';
  table.style.display = tableDisplay;
  return { width, height: own > 0 ? own : Math.round(width / aspectRatio) };
}

/** The selection as the event gives it (selection.md 9): per series of the app, the indices, keys and x values. */
function selectionDetail(model: ChartModel | null, sel: ReadonlyMap<string, Uint8Array> | undefined): ChartEvents['selectionChange'] {
  let count = 0;
  const series = [...(sel ?? [])].map(([id, bits]) => {
    const on: number[] = [];
    for (let i = bits.indexOf(1); i !== -1; i = bits.indexOf(1, i + 1)) on.push(i);
    count += on.length;
    const indices = Int32Array.from(on);
    const s = model?.series.find((o) => o.id === id);
    return { id, indices, keys: s?.keys ? Array.from(indices, (i) => s.keys![i] ?? null) : null, xs: Float64Array.from(indices, (i) => s?.columns.x[i] ?? Number.NaN) };
  });
  return { count, series };
}

/** Whether two selections hold the same points. */
function sameSelection(a: ReadonlyMap<string, Uint8Array> | undefined, b: ReadonlyMap<string, Uint8Array> | undefined): boolean {
  const ka = [...(a ?? [])].filter(([, v]) => v.indexOf(1) !== -1);
  const kb = [...(b ?? [])].filter(([, v]) => v.indexOf(1) !== -1);
  if (ka.length !== kb.length) return false;
  return ka.every(([id, v]) => {
    const w = b?.get(id);
    return !!w && w.length === v.length && v.every((x, i) => x === w[i]);
  });
}

const countOf = (sel: ReadonlyMap<string, Uint8Array>) => {
  let n = 0;
  for (const bits of sel.values()) for (let i = bits.indexOf(1); i !== -1; i = bits.indexOf(1, i + 1)) n++;
  return n;
};

/** A selection carried to new data (selection.md 8): by key when both readings have keys, else by index. */
function carrySelection(before: ChartModel | null, after: ChartModel, sel: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  for (const [id, bits] of sel) {
    const s = after.series.find((o) => o.id === id);
    if (!s) continue;
    const n = s.columns.x.length;
    const next = new Uint8Array(n);
    const oldKeys = before?.series.find((o) => o.id === id)?.keys;
    if (oldKeys && s.keys) {
      const at = new Map(s.keys.flatMap((k, i) => (k === null ? [] : [[k, i] as const])));
      for (let i = bits.indexOf(1); i !== -1; i = bits.indexOf(1, i + 1)) {
        const k = oldKeys[i];
        const j = k == null ? undefined : at.get(k);
        if (j !== undefined) next[j] = 1;
      }
    } else for (let i = bits.indexOf(1); i !== -1 && i < n; i = bits.indexOf(1, i + 1)) next[i] = 1;
    if (next.indexOf(1) !== -1) out.set(id, next);
  }
  return out;
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
  // Drilldown (drilldown.md): its breadcrumb above the chart; its levels change what the chart reads.
  const drillPart =
    features.drill?.({
      model: () => model,
      locale: () => words.locale,
      words: () => words.messages.drill,
      save: () => ({ hidden: new Set(hidden), range, selection, aggregation: aggChoice }),
      show: (saved, time) => {
        const rangeBefore = range;
        if (saved) {
          hidden.clear();
          saved.hidden.forEach((h) => hidden.add(h));
          selection = saved.selection ? new Map(saved.selection) : undefined;
          aggChoice = saved.aggregation;
          range = saved.range;
        } else {
          selection = undefined;
          range = null;
        }
        if (time) {
          aggChoice = time.aggregation;
          range = time.range;
        }
        periodRange = time ? range : null;
        viewVersion++;
        // The level read now: the next key of a path is looked for in it, and the events tell its view (review 1, 3).
        read();
        if (JSON.stringify(range) !== JSON.stringify(rangeBefore)) emit('rangeChange', { range: range && { min: range.min, max: range.max } });
        schedule('data');
      },
      announce: (text) => (live.textContent = text),
      changed: (path) => {
        emit('drill', { path });
        viewChanged(['drill'], 'user');
      },
      refocus: () => (refocusPoints = true),
    }) ?? null;
  if (drillPart) element.insertBefore(drillPart.nav, element.firstChild);
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
  /** The model drawn: the source, aggregated when the view or the options ask for it (aggregation.md). */
  let model: ChartModel | null = null;
  /** The model as the options give it: the view names its points (keys, selection). */
  let source: ChartModel | null = null;
  /** The aggregation in force: maps a selection between the source's points and the drawn ones. */
  let agg: Aggregated | null = null;
  let found: readonly Problem[] = [];
  /** The view (GLOSSARY: View): hidden series by id; `initiallyHidden` read once, when an id first appears. */
  const hidden = new Set<string>();
  const known = new Set<string>();
  let view: View = { hidden };
  /** The first x axis's visible range (GLOSSARY: Visible range); null: the whole data. */
  let range: Range | null = null;
  /**
   * A time level's period (drilldown.md 6): shown whole, past the data's end too, so it is not kept inside the data
   * like a range the user chose (a partial year moved back would show the year before).
   */
  let periodRange: Range | null = null;
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
  /** What was wrong with the last `setView()` call. */
  let viewProblems: Problem[] = [];
  /** The selection changed since the aids were written: they are written again without a layout. */
  let aidsStale = false;
  /** A drill level chosen from the breadcrumb: once its points are written, the keyboard goes back to them. */
  let refocusPoints = false;
  /** View parts changed by a gesture still moving: told once it rests (view-state.md 4). */
  const pendingView = new Set<ViewPart>();
  let viewTimer = 0;
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
    // The level shown: the detail's series in place of the chart's (drilldown.md 2).
    const shownOptions = withChoices(drillPart ? drillPart.effective(options) : options);
    const withData: ChartOptions = data.size && shownOptions === options
      ? { ...options, series: Array.isArray(options.series) ? options.series.map((s, i) => (isRecord(s) && data.has(idOf(s, i)) ? ({ ...s, data: data.get(idOf(s, i)) } as SeriesOptions) : s)) : options.series }
      : shownOptions;
    // The page's zone, the default of a time axis (time-axis.md 2): read here, the core never reads the host.
    const r = normalize(withData, setup.types, { zone: new Intl.DateTimeFormat().resolvedOptions().timeZone, kit: features.kit });
    const before = source;
    source = r.model;
    // The user's aggregation (the menu, setView), else the x axis's option (aggregation.md).
    // An automatic time drill starts by years (drilldown.md 6).
    const spec = aggChoice !== undefined ? aggChoice : source.drill === 'time' ? { period: 'year' as const } : (source.xAxes[0]?.aggregate ?? null);
    agg = spec ? (source.kit.aggregation?.apply(source, spec) ?? null) : null;
    model = agg?.model ?? source;
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
    // The view for the core from the parts kept here: the selection mapped to the model just read (review 2).
    view = makeView();
    // New data: a measure goes if its points are gone (measure.md 4, review 7); a selection keeps the points still
    // there, by key when the series has keys, else by index (selection.md 8, review 3), and says so if some went.
    measurePart?.keepIf((p) => (model!.series.find((o) => o.id === p.seriesId)?.columns.x.length ?? 0) > p.index);
    if (selection) {
      const next = carrySelection(before, source, selection);
      if (!sameSelection(next, selection)) {
        const lost = countOf(next) < countOf(selection);
        applySelection(next);
        if (lost) selectPart?.told();
      }
    }
    // The aspect ratio or the direction may have changed: measured again.
    measured = null;
    // New data: the range stays inside it, or goes back to the whole (zoom-pan.md 5).
    if (range && range !== periodRange) {
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
      measured = containerSize(element, root, m.aspectRatio, tableBox, drillPart?.nav ?? null);
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
    // Over the drawing, where its points now are; the mode bar and the cursor as the mode says (modes.md 1–2).
    measurePart?.redraw();
    modeBar?.place(l.plot, width, dir, messages.modeBar);
    menuPart?.place(width, dir);
    if (modeBar || measurePart) svg.style.cursor = modeNow() === 'selection' ? 'cell' : 'crosshair';

    // ---- Stage 4: the aids, with the layout or a new selection (screen-reader.md, keyboard.md, data-table.md). ----
    if (relaid || aidsStale) {
      aidsStale = false;
      root.setAttribute('aria-label', m.title?.text ?? m.description ?? messages.chart);
      // The summary, the points' items and the table read the data: during a gesture (a drag, the wheel, a pinch)
      // they are written once it rests, not at every frame (big-data.md 4); otherwise at once.
      if (aidsTimer) clearTimeout(aidsTimer);
      aidsTimer = 0;
      const writeAids = () => {
        aidsTimer = 0;
        if (destroyed || !model || !laid) return;
        described.textContent = describe(model, laid);
        items.update({ model, layout: laid, view, locale: words.locale, messages: words.messages });
        writeTable(tableBox, model, laid, view, words.locale, words.messages, tableMode(), toggleTable);
        // Back on the points after a level chosen from the breadcrumb (drilldown.md 4, review 5).
        if (refocusPoints && items.activePoint) items.focusPoint(items.activePoint);
        refocusPoints = false;
      };
      if (moving && !items.hasFocus) aidsTimer = setTimeout(writeAids, AIDS_REST_MS);
      else writeAids();
      moving = false;
      legend.update(m, l, view, messages);
      navPart?.update(width, dir);
      zoomPart?.place(l.plot, width, dir, range, messages.resetZoom);
    }

    // Options of the DOM's own modules, asked without them (ADR 0006).
    const missing: Problem[] = [...(m.menu && !features.menu ? [{ code: 'missing-module' as const, path: 'menu', detail: 'menu' }] : []), ...(m.drill && !features.drill ? [{ code: 'missing-module' as const, path: 'drilldown', detail: 'drilldown' }] : [])];
    const next = [...found, ...l.problems, ...(callProblem ? [callProblem] : []), ...viewProblems, ...missing];
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
  const setVisible = (id: string, visible: boolean, source: 'user' | 'app') => {
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
    viewChanged(['hidden'], source);
    schedule('data');
  };

  // ---- The view as state (view-state.md, ADR 0009). ----
  /** The user's comparison (compare.md); undefined: the options decide. */
  let compareChoice: View['compare'] = undefined;
  /** The selected points (selection.md); undefined: none. */
  let selection: Map<string, Uint8Array> | undefined;
  /** The core's view from the parts kept here. */
  const makeView = (): View => {
    const id = xAxisId();
    return { hidden, ...(range && id !== undefined ? { range: { [id]: range } } : {}), ...(compareChoice !== undefined ? { compare: compareChoice } : {}), ...(selection ? { selection: agg ? agg.forth(selection) : selection } : {}), ...(aggChoice !== undefined ? { aggregation: aggChoice } : {}) };
  };
  const currentView = (): ChartView => (source ? viewToJson(source, { hidden, range, ...(compareChoice !== undefined ? { compare: compareChoice } : {}), ...(selection ? { selection } : {}), ...(aggChoice !== undefined ? { aggregation: aggChoice } : {}), ...(drillPart ? { drill: drillPart.path() } : {}), ...(Object.keys(typeChoice).length ? { types: typeChoice } : {}), ...(scaleChoice ? { scale: scaleChoice } : {}) }) : { hidden: [], range: null });
  /** The user's types by series id and value axis scale, from the menu (menu.md 2, 4). */
  let typeChoice: Record<string, string> = {};
  let scaleChoice: 'linear' | 'log' | undefined;
  /** The options with the menu's choices applied: a series' type, the first value axis's scale. */
  const withChoices = (o: ChartOptions): ChartOptions => {
    if (!Object.keys(typeChoice).length && !scaleChoice) return o;
    const series = Array.isArray(o.series) ? o.series.map((s, i) => (isRecord(s) && typeChoice[idOf(s, i)] ? ({ ...s, type: typeChoice[idOf(s, i)] } as SeriesOptions) : s)) : o.series;
    const yAxes = Array.isArray(o.yAxis) ? o.yAxis : o.yAxis ? [o.yAxis] : [{}];
    const yAxis = scaleChoice ? [{ ...yAxes[0], scale: scaleChoice }, ...yAxes.slice(1)] : o.yAxis;
    return { ...o, series, ...(yAxis !== undefined ? { yAxis: yAxis as ChartOptions['yAxis'] } : {}) };
  };
  /** The user's aggregation (aggregation.md, menu.md); undefined: the options decide. */
  let aggChoice: View['aggregation'] = undefined;
  const tellView = (changed: readonly ViewPart[], source: 'user' | 'app') => {
    if (changed.length) emit('viewChange', { view: currentView(), changed, source });
  };
  /** Tells the app now, or once a moving gesture rests. */
  const viewChanged = (changed: readonly ViewPart[], source: 'user' | 'app') => {
    if (source === 'app' || !moving) return tellView(changed, source);
    changed.forEach((c) => pendingView.add(c));
    if (viewTimer) clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
      viewTimer = 0;
      if (destroyed) return;
      const parts = (['hidden', 'range', 'compare', 'selection', 'aggregation', 'drill', 'types', 'scale'] as const).filter((c) => pendingView.has(c));
      pendingView.clear();
      tellView(parts, 'user');
    }, AIDS_REST_MS) as unknown as number;
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
    view = makeView();
    viewVersion++;
    emit('rangeChange', { range: r && { min: r.min, max: r.max } });
    return true;
  };
  const setRange = (r: Range | null, how: 'animate' | 'now', from: 'pointer' | 'keyboard', source: 'user' | 'app' = 'user') => {
    if (!applyRange(r)) return;
    // A gesture, or changes coming faster than the aids' rest (an app's own slider, linked charts): moving.
    const now = performance.now();
    moving = (how === 'now' && from === 'pointer') || now - lastRangeAt < AIDS_REST_MS;
    lastRangeAt = now;
    viewChanged(['range'], source);
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
      dragZooms: () => modeNow() === 'zoom',
      dragPans: () => modeNow() !== 'selection',
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
    busy: (): boolean => (zoomPart?.busy() ?? false) || (navPart?.busy() ?? false) || (measurePart?.busy() ?? false) || (selectPart?.busy() ?? false),
    state: () => (model && laid && scene ? { model, layout: laid, scene, locale: words.locale, text: words.messages, font: (r) => measurer.font(r), view } : null),
    highlight: setHighlight,
    hovered: (point) => {
      const x = point && model ? model.series.find((o) => o.id === point.seriesId)?.columns.x[point.index] : undefined;
      emit('pointHover', { point: point && keyed(point), ...(x !== undefined ? { x } : {}) });
    },
    clicked: (point) => {
      emit('pointClick', { point: keyed(point) });
      drillPart?.down(point);
    },
  }, features.tooltip?.(root) ?? null);
  /** Up a drill level (drilldown.md 4): Backspace, or Alt + the arrow toward the reading direction's start. */
  const upKey = (e: KeyboardEvent) => e.key === 'Backspace' || (e.altKey && screenStep(e.key, true) === (getComputedStyle(root).direction === 'rtl' ? 1 : -1));
  // ---- Modes and measure (modes.md, measure.md). ----
  /** Escape anywhere in the chart removes a measure (measure.md 4); the points' own Escape is theirs. */
  const onRootKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !items.hasFocus && (measurePart?.clear() || selectPart?.clear())) e.preventDefault();
    if (!items.hasFocus && upKey(e) && drillPart?.up()) e.preventDefault();
  };
  root.addEventListener('keydown', onRootKey);
  // Printed, marks drawn on Canvas or WebGL2 are painted again in the print colours (print.md 3): their pixels do not
  // follow the theme by themselves, as SVG does.
  const printing = typeof matchMedia === 'function' ? matchMedia('print') : null;
  const onPrint = () => {
    if (destroyed || !model || !(canvasPainter || webglPainter)) return;
    if (frame) cancelAnimationFrame(frame);
    render();
  };
  printing?.addEventListener('change', onPrint);
  /** The modes this chart has (modes.md 1): from its modules, and selection when the app asked for it on a chart with axes. */
  const modesOf = (): Mode[] => [...(zoomPart ? (['zoom'] as const) : []), ...(selectPart && model?.selection && model.system === 'cartesian' ? (['selection'] as const) : []), ...(features.measure ? (['measure'] as const) : [])];
  /** Sets the selection in the view (empty: none). */
  const applySelection = (next: Map<string, Uint8Array>) => {
    selection = next.size ? next : undefined;
    view = makeView();
    // A selection moves no scale: the scene and the aids are redrawn, the layout kept (review 4).
    aidsStale = true;
  };
  const selectPart =
    features.selection?.(svg, {
      state: () => (model && laid ? { model, layout: laid, view } : null),
      active: () => modeNow() === 'selection',
      pick: (x, y): PointRef | null => hover.find(x, y)?.point ?? null,
      drills: (at) => !!drillPart && !!model && hasDetail(model, at),
      apply: (next, resting) => {
        // Chosen among the points drawn: kept as the source's (an aggregated point selects all it holds).
        applySelection(agg ? agg.back(next) : next);
        // A lasso still drawing: the aids and the app wait for it to rest (view-state.md 4).
        moving = !resting;
        viewChanged(['selection'], 'user');
        schedule('immediate');
      },
      tell: () => {
        // The app's points (an aggregated point stands for all it holds): read from the source, not the drawing.
        const d = selectionDetail(source, selection);
        live.textContent = words.messages.selectedCount(new Intl.NumberFormat(words.locale).format(d.count));
        emit('selectionChange', d);
      },
    }) ?? null;
  /** The user's or app's mode; the first the chart has until one is chosen, or when the chosen one is gone (review 6). */
  let modeChosen: Mode | null = null;
  const modeNow = (): Mode => {
    const all = modesOf();
    return modeChosen && all.includes(modeChosen) ? modeChosen : (all[0] ?? 'zoom');
  };
  const measurePart =
    features.measure?.(svg, {
      state: () => (model && laid ? { model, layout: laid, measureText: measurer.measureText, locale: words.locale, tag: (r) => words.messages.measureTag(r) } : null),
      active: () => modeNow() === 'measure',
      pick: (x, y): PointRef | null => hover.find(x, y)?.point ?? null,
      changed: (m, fromKeyboard) => {
        if (m) live.textContent = words.messages.measured(m.reading);
        void fromKeyboard;
        emit('measure', m && { from: keyed(m.from), to: keyed(m.to) });
      },
    }) ?? null;
  const setMode = (next: Mode) => {
    if (next === modeNow() || !modesOf().includes(next)) return;
    modeChosen = next;
    // A measure belongs to its mode (measure.md 4).
    measurePart?.clear();
    schedule();
    emit('modeChange', { mode: next });
  };
  const modeBar =
    features.modeBar?.(root, {
      modes: () => modesOf().map((m) => ({ mode: m, name: words.messages.modes[m] })),
      current: modeNow,
      choose: setMode,
      shapes: () => (model?.selection?.shapes ?? []).map((x) => ({ shape: x, name: words.messages.shapes[x] })),
      shape: () => selectPart?.shape() ?? 'rectangle',
      chooseShape: (x) => {
        selectPart?.chooseShape(x);
        schedule();
      },
    }) ?? null;
  // ---- The chart menu (menu.md). ----
  const menuPart =
    features.menu?.(root, {
      state: () => ({ model, source, words: words.messages, typeNames: setup.types.map((t) => t.name as string), compares: features.compares, aggregates: features.aggregates, exports: features.exporting !== null, chosen: { types: typeChoice, scale: scaleChoice, aggregation: aggChoice !== undefined ? aggChoice : source?.drill === 'time' ? { period: 'year' } : undefined, compare: compareChoice } }),
      choose: (c) => {
        const w = c.kind;
        // Outputs leave the view as it is (menu.md 9).
        if (w === 'export') return void api.download(c.value as ExportFormat);
        if (w === 'print') return api.print();
        if (w === 'type' && c.seriesId) typeChoice = { ...typeChoice, [c.seriesId]: c.value! };
        else if (w === 'scale') scaleChoice = c.value as 'linear' | 'log';
        else if (w === 'aggregation') aggChoice = c.value ? { period: c.value as 'month' } : null;
        else if (w === 'compare') compareChoice = c.value ? { mode: c.value as 'percent', to: null } : null;
        view = makeView();
        viewVersion++;
        if (w !== 'compare') stale = true;
        viewChanged([w === 'type' ? 'types' : w], 'user');
        schedule('data');
      },
    }) ?? null;
  const crossPart =
    features.crosshair?.(svg, {
      state: () => (model && laid ? { model, layout: laid, measureText: measurer.measureText, locale: words.locale } : null),
      busy: () => (zoomPart?.busy() ?? false) || (navPart?.busy() ?? false),
    }) ?? null;
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
      crossPart?.focus(model && laid ? pointAt(model, laid, point) : null);
      measurePart?.focusMoved(point);
      selectPart?.focused(point);
      emit('pointFocus', { point: keyed(point) });
    },
    leave: () => {
      hover.focus(null);
      crossPart?.focus(null);
    },
    clicked: (point) => {
      emit('pointClick', { point: keyed(point) });
      drillPart?.down(point);
    },
    escape: () => {
      // A measure goes first, then a selection, then the tooltip (keyboard.md 4, selection.md 5).
      if (!measurePart?.clear() && !selectPart?.clear()) hover.hideTooltip();
    },
    key: (e, point) => {
      // Space selects; in selection mode Shift + arrows extend the selection rather than move the range (modes.md 4).
      if (selectPart?.key(e, point)) return true;
      // Up a level (drilldown.md 4).
      if (upKey(e) && drillPart?.up()) return true;
      if (modeNow() === 'selection' && e.shiftKey) return false;
      if (measurePart && (e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        measurePart.key(point);
        return true;
      }
      const s = model?.series.find((o) => o.id === point.seriesId);
      return zoomPart?.key(e, s ? s.columns.x[point.index]! : null) ?? false;
    },
  });
  // ---- The table's range (data-table.md 5): the visible range, or all the data. ----
  /** The user's choice, once they made one; until then the app's (`dataTable.rows`). */
  /** What screen readers hear about the chart (screen-reader.md); an exported picture's description too (export.md 6). */
  const describe = (m: ChartModel, l: ChartLayout) => {
    const sum = words.messages.summary(summary(m, l, view, words.locale, words.messages));
    return m.description ? `${sum} ${m.description}` : sum;
  };
  /** The chart as an export reads it now; null before its first drawing. */
  const exportState = (): ExportState | null => {
    if (!model || !laid || !measured) return null;
    return { model, types: setup.types, layout: laid, view, locale: words.locale, messages: words.messages, width: measured.width, height: measured.height, dir: laid.dir, measureText: measurer.measureText, font: (r) => measurer.font(r), host: root, summary: describe(model, laid), rows: tableMode() };
  };
  /** An export asked without its module (ADR 0006): reported with the next drawing, nothing done. */
  const exportKit = () => {
    if (features.exporting) return features.exporting;
    callProblem = { code: 'missing-module', path: 'exporting', detail: 'exporting' };
    schedule();
    return null;
  };
  let tableWhich: 'visible' | 'all' | null = null;
  const tableMode = () => tableWhich ?? model?.dataTableRows ?? 'visible';
  const toggleTable = () => {
    tableWhich = tableMode() === 'all' ? 'visible' : 'all';
    if (model && laid) writeTable(tableBox, model, laid, view, words.locale, words.messages, tableWhich, toggleTable);
    tableBox.querySelector<HTMLButtonElement>('.dzgraph-table-range')?.focus();
  };

  const legend = new LegendButtons(legendGroup, { toggle: (id) => setVisible(id, hidden.has(id), 'user'), highlight: setHighlight });

  const resize = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (box && `${Math.round(box.width)}x${Math.round(box.height)}` === drawnSize) return;
    measured = null;
    schedule();
  });
  resize.observe(element);
  drawn();

  const api: Chart = {
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
      if (!destroyed) setVisible(seriesId, visible, 'app');
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
        return setRange(null, 'animate', 'pointer', 'app');
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
      setRange(wholeOrNull(clampRange({ min, max }, e), e), 'animate', 'pointer', 'app');
    },
    showX(x) {
      if (destroyed || !model || !laid) return;
      const xs = laid.axes.find((a) => a.dimension === 'x')?.scale;
      if (x === null || !xs) {
        hover.hide();
        crossPart?.focus(null);
        return;
      }
      const at = xs.map(x);
      const vertical = model.orientation === 'vertical';
      const px = vertical ? at : laid.plot.x + laid.plot.width / 2;
      const py = vertical ? laid.plot.y + laid.plot.height / 2 : at;
      hover.showAt(hover.find(px, py), false);
      crossPart?.focus({ x: px, y: py });
    },
    selectBy(by, values) {
      if (destroyed || !source) return;
      const wanted = new Set(values);
      const next = new Map<string, Uint8Array>();
      for (const s of source.series) {
        const bits = new Uint8Array(s.columns.x.length);
        for (let i = 0; i < bits.length; i++) if (by === 'key' ? s.keys?.[i] != null && wanted.has(s.keys[i]!) : wanted.has(s.columns.x[i]!)) bits[i] = 1;
        if (bits.indexOf(1) !== -1) next.set(s.id, bits);
      }
      if (sameSelection(next, selection)) return;
      applySelection(next);
      viewChanged(['selection'], 'app');
      schedule('immediate');
    },
    exportSvg(options) {
      const kit = exportKit();
      const st = exportState();
      return kit && st ? kit.svg(st, options) : null;
    },
    async exportPng(options) {
      const kit = exportKit();
      const st = exportState();
      return kit && st ? kit.png(st, options) : null;
    },
    exportCsv(options) {
      const kit = exportKit();
      const st = exportState();
      return kit && st ? kit.csv(st, options) : null;
    },
    async download(format, options) {
      const kit = exportKit();
      const st = exportState();
      if (kit && st && (format === 'png' || format === 'svg' || format === 'csv')) await kit.download(st, format, options);
    },
    print(options) {
      const kit = exportKit();
      const st = exportState();
      if (kit && st) kit.print(st, options);
    },
    get mode() {
      return modeNow();
    },
    setMode(next) {
      if (!destroyed) setMode(next);
    },
    getView() {
      if (!destroyed && (stale || !model)) read();
      return currentView();
    },
    setView(given) {
      if (destroyed) return;
      if (stale || !model) read();
      const r = viewFromJson(source!, given);
      viewProblems = [...r.problems];
      const changed: ViewPart[] = [];
      // The level first: what else the view gives is the level's (review 1).
      if (r.drill !== undefined && drillPart && JSON.stringify(r.drill) !== JSON.stringify(drillPart.path())) {
        const missed = drillPart.goTo(r.drill);
        if (missed >= 0) viewProblems.push({ code: 'invalid-view', path: `view.drill[${missed}]` });
      }
      // The menu's choices, only those the menu would offer (review 8).
      if (r.types) {
        const kinds = ['line', 'area', 'column'].filter((t) => setup.types.some((x) => x.name === t));
        for (const [id, t] of Object.entries(r.types))
          if (!kinds.includes(t) || !kinds.includes(source!.series.find((o) => o.id === id)?.type ?? '')) {
            viewProblems.push({ code: 'invalid-view', path: `view.types.${id}` });
            delete r.types[id];
          }
      }
      if (r.scale === 'log' && source!.series.some((s) => s.columns.y.some((v) => v <= 0))) {
        viewProblems.push({ code: 'invalid-view', path: 'view.scale' });
        r.scale = undefined;
      }
      if (r.hidden) {
        const before = [...hidden].sort().join('\u0000');
        hidden.clear();
        r.hidden.forEach((h) => hidden.add(h));
        // The view says what is hidden: `initiallyHidden` no longer decides for the series it knows.
        for (const s of model!.series) known.add(s.id);
        if ([...hidden].sort().join('\u0000') !== before) {
          viewVersion++;
          if (highlight !== undefined && hidden.has(highlight)) highlight = undefined;
          changed.push('hidden');
        }
      }
      if (r.range !== undefined) {
        const e = xExtent();
        const next = r.range && e && e.max > e.min ? wholeOrNull(clampRange(r.range, e), e) : null;
        if (applyRange(next)) changed.push('range');
      }
      if (r.selection !== undefined && !sameSelection(r.selection, selection)) {
        applySelection(r.selection);
        changed.push('selection');
      }
      if (r.types !== undefined && JSON.stringify(r.types) !== JSON.stringify(typeChoice)) {
        typeChoice = r.types;
        stale = true;
        changed.push('types');
      }
      if (r.scale !== undefined && r.scale !== scaleChoice) {
        scaleChoice = r.scale;
        stale = true;
        changed.push('scale');
      }
      if (r.aggregation !== undefined && JSON.stringify(r.aggregation) !== JSON.stringify(aggChoice)) {
        aggChoice = r.aggregation;
        // Read again: the drawn model is the source aggregated another way.
        stale = true;
        changed.push('aggregation');
      }
      if (r.compare !== undefined && JSON.stringify(r.compare) !== JSON.stringify(compareChoice)) {
        compareChoice = r.compare;
        view = makeView();
        viewVersion++;
        changed.push('compare');
      }
      tellView(changed, 'app');
      schedule('data');
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
      if (viewTimer) clearTimeout(viewTimer);
      frame = 0;
      resize.disconnect();
      animator.stop();
      hover.destroy();
      crossPart?.destroy();
      measurePart?.destroy();
      drillPart?.destroy();
      menuPart?.destroy();
      selectPart?.destroy();
      modeBar?.destroy();
      root.removeEventListener('keydown', onRootKey);
      printing?.removeEventListener('change', onPrint);
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
  return api;
};
