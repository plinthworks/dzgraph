/**
 * Checks the options an app wrote and completes them into the chart's model (model.ts). Never throws: a bad option is
 * reported and its default used; a series that cannot be drawn is left out and reported; anything unreadable (a getter
 * that throws) gives an empty chart and one Problem. Problems carry option paths and option names, never the data's
 * values (CLAUDE.md).
 */
import type { AggregateFn, AggregateSpec } from './aggregation.js';
import type { Period } from './time.js';
import type { SelectShape } from './selection.js';
import type { CompareMode } from './compare.js';
import type { Problem } from './problem.js';
import type { ScaleKind } from './options.js';
import type { ColorToken } from './scene.js';
import type { SeriesModel, SeriesType } from './series-type.js';
import type { AxisModel, ChartModel } from './model.js';
import { isSorted, readXYData, type RawXY } from './data.js';
import { NO_KIT, type Kit, type TimeKit } from './kit.js';

/**
 * The theme's categorical palette has eight colours (`--dzgraph-series-1` … `-8`, validated for colour-blind
 * separation and contrast, theme/README.md); places past eight wrap, each series keeping its own marker symbol.
 */
const PALETTE_SIZE = 8;
const DEFAULT_ASPECT = 16 / 9;

const TOP_KEYS = new Set(['title', 'series', 'xAxis', 'yAxis', 'legend', 'locale', 'dir', 'mirror', 'aspectRatio', 'description', 'highlight', 'animation', 'dataTable', 'navigator', 'rangeButtons', 'crosshair', 'selection', 'drilldown', 'menu']);
const SERIES_KEYS = new Set(['type', 'id', 'name', 'data', 'xAxis', 'yAxis', 'color', 'initiallyHidden', 'aggregate', 'drilldown']);
const AXIS_BASE_KEYS = ['id', 'title', 'opposite', 'reversed', 'scale'];
const AXIS_KEYS: Record<ScaleKind, ReadonlySet<string>> = {
  linear: new Set([...AXIS_BASE_KEYS, 'min', 'max', 'ticks', 'stacking', 'compare', 'compareTo', 'aggregate']),
  log: new Set([...AXIS_BASE_KEYS, 'min', 'max', 'ticks', 'stacking', 'compare', 'compareTo']),
  category: new Set([...AXIS_BASE_KEYS, 'categories', 'ticks']),
  time: new Set([...AXIS_BASE_KEYS, 'zone', 'min', 'max', 'ticks', 'aggregate']),
};
const TICKS_KEYS = new Set(['target', 'format', 'grid']);
const SCALES = new Set<ScaleKind>(['linear', 'log', 'category', 'time']);
/** The coordinate systems this version lays out; a type of another is left out and reported. */
const LAID_OUT_SYSTEMS = new Set<string>(['cartesian', 'polar']);
/** A name usable in a CSS custom property: `--dzgraph-color-<name>`. */
const CSS_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

type Rec = Readonly<Record<string, unknown>>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const EMPTY_MODEL: ChartModel = {
  series: [],
  xAxes: [defaultAxis('x')],
  yAxes: [defaultAxis('y')],
  title: null,
  legend: null,
  locale: null,
  dir: null,
  mirror: false,
  aspectRatio: DEFAULT_ASPECT,
  description: null,
  orientation: 'vertical',
  system: 'cartesian',
  highlight: true,
  animation: true,
  dataTable: false,
  dataTableRows: 'visible',
  navigator: false,
  crosshair: null,
  selection: null,
  drill: null,
  menu: null,
  rangeButtons: null,
  kit: NO_KIT,
};

function defaultAxis(id: string, scale: ScaleKind = 'linear'): AxisModel {
  return { id, scale, title: null, opposite: false, reversed: false, min: null, max: null, categories: scale === 'category' ? [] : null, ticks: { target: null, format: null, grid: null }, zone: null, stacking: null, compare: null, aggregate: null };
}

/** What the reading needs from where the chart is shown: the page's zone, the default of a time axis (time-axis.md 2). */
export interface ReadContext {
  /** An IANA zone; absent, UTC — the core never reads the host's zone, so a scene does not depend on the machine. */
  readonly zone?: string;
  /** What the imported features lend the core (ADR 0006); absent, none. */
  readonly kit?: Kit;
}

export function normalize(options: unknown, types: readonly SeriesType[], context: ReadContext = {}): { readonly model: ChartModel; readonly problems: readonly Problem[] } {
  try {
    return normalizeOrThrow(options, types, context.zone !== undefined && isZone(context.zone) ? context.zone : 'UTC', context.kit ?? NO_KIT);
  } catch {
    // Only an app's getter or proxy can throw while being read.
    return { model: EMPTY_MODEL, problems: [{ code: 'invalid-option', path: '' }] };
  }
}

function normalizeOrThrow(options: unknown, types: readonly SeriesType[], pageZone: string, kit: Kit) {
  const problems: Problem[] = [];
  if (!isRecord(options)) return { model: EMPTY_MODEL, problems: [{ code: 'invalid-option', path: '' } as const] };
  const report = (p: Problem) => problems.push(p);

  for (const k of Object.keys(options)) if (!TOP_KEYS.has(k)) report({ code: 'unknown-option', path: k });

  const title = readTitle(options['title'], report);
  // Axis ids are one namespace for x and y: a series names its axes by id (review 2).
  const axisIds = new Set<string>();
  const xIn = readAxes(options['xAxis'], 'xAxis', 'x', report, axisIds, pageZone, kit);
  const yIn = readAxes(options['yAxis'], 'yAxis', 'y', report, axisIds, pageZone, kit);

  // Series: checked one by one; those that can be drawn keep their place in `drawn`.
  const byName = new Map(types.map((t) => [t.name as string, t]));
  const seriesIn = options['series'];
  const entries: { s: Rec; i: number; type: SeriesType; id: string; raw: RawXY; xAxis: string; yAxis: string; stack: string | null }[] = [];
  let orientation: 'vertical' | 'horizontal' | null = null;
  /** The chart's coordinate system: its first series' (combined.md 12, ADR 0007). */
  let system: string | null = null;
  if (!Array.isArray(seriesIn)) report({ code: 'invalid-option', path: 'series' });
  else {
    const ids = new Set<string>();
    seriesIn.forEach((s: unknown, i: number) => {
      const path = `series[${i}]`;
      if (!isRecord(s)) return void report({ code: 'invalid-option', path });
      const type = typeof s['type'] === 'string' ? byName.get(s['type']) : undefined;
      if (!type) return void report({ code: 'unknown-series-type', path: `${path}.type`, ...(typeof s['type'] === 'string' ? { detail: s['type'] } : {}) });

      // The id first: every other problem of the series names it.
      let id = `#${i + 1}`;
      const idProblem: Problem[] = [];
      if (s['id'] !== undefined) {
        if (typeof s['id'] !== 'string') idProblem.push({ code: 'invalid-option', path: `${path}.id` });
        else if (s['id'].startsWith('#') || ids.has(s['id'])) idProblem.push({ code: 'duplicate-id', path: `${path}.id` });
        else id = s['id'];
      }
      ids.add(id);

      if (!LAID_OUT_SYSTEMS.has(type.system)) return void report({ code: 'not-available', path: `${path}.type`, seriesId: id, detail: type.system });
      // One coordinate system per chart, and one pie, donut or gauge in a polar one (pie-donut.md 17, gauge.md 12).
      if ((system !== null && type.system !== system) || (system === 'polar' && entries.length > 0)) return void report({ code: 'invalid-option', path: `${path}.type`, seriesId: id, detail: type.name });
      system ??= type.system;
      // Columns and bars set the chart's orientation; lines, areas and scatters follow it (combined.md 3).
      const wanted = type.orientation;
      if (wanted && orientation !== null && wanted !== orientation) return void report({ code: 'mixed-orientation', path: `${path}.type`, seriesId: id, detail: type.name });
      if (wanted) orientation ??= wanted;

      const own = new Set(Object.keys(type.optionNames));
      for (const k of Object.keys(s)) if (!SERIES_KEYS.has(k) && !own.has(k)) report({ code: 'unknown-option', path: `${path}.${k}`, seriesId: id });
      for (const p of type.check(s, path)) report(p);
      idProblem.forEach(report);
      if (s['name'] !== undefined && typeof s['name'] !== 'string') report({ code: 'invalid-option', path: `${path}.name`, seriesId: id });
      if (s['initiallyHidden'] !== undefined && typeof s['initiallyHidden'] !== 'boolean') report({ code: 'invalid-option', path: `${path}.initiallyHidden`, seriesId: id });

      const axisRef = (key: 'xAxis' | 'yAxis', axes: readonly AxisIn[]): string => {
        const v = s[key];
        const first = axes[0]!.id;
        if (v === undefined) return first;
        if (typeof v === 'string' && axes.some((a) => a.id === v)) return v;
        report({ code: 'unknown-axis', path: `${path}.${key}`, seriesId: id, ...(typeof v === 'string' ? { detail: v } : {}) });
        return first;
      };
      const xAxis = axisRef('xAxis', xIn);
      const yAxis = axisRef('yAxis', yIn);
      const raw = type.readData ? fromTypeData(type, s['data'], `${path}.data`, id) : readXYData(s['data'], `${path}.data`, id);
      let stack = type.stackable ? readStack(s['stack'], `${path}.stack`, id, report) : null;
      // A pile's parts do not add up along a log axis (log-scale.md 10).
      if (stack !== null && yIn.find((a) => a.id === yAxis)?.scale === 'log') {
        report({ code: 'invalid-option', path: `${path}.stack`, seriesId: id });
        stack = null;
      }
      entries.push({ s, i, type, id, raw, xAxis, yAxis, stack });
    });
  }

  // A percent axis needs piles on it (stacking.md 11).
  yIn.forEach((a, i) => {
    if (a.stacking && !entries.some((e) => e.stack !== null && e.yAxis === a.id)) {
      report({ code: 'invalid-option', path: `yAxis[${i}].stacking` });
      yIn[i] = { ...a, stacking: null };
    }
  });

  // A comparison (compare.md 7): with its module, not on an axis with piles; a fixed baseline read on the x axis.
  yIn.forEach((a, i) => {
    if (!a.compare) return;
    const path = `yAxis[${i}]`;
    let compare: AxisModel['compare'] = null;
    const x = xIn[0];
    const to = a.compare.to;
    const at = typeof to === 'number' || to === null ? to : x?.scale === 'time' && kit.time ? kit.time.parse(to, x.zone ?? pageZone) : 'invalid';
    if (!kit.compare) report({ code: 'missing-module', path: `${path}.compare`, detail: 'compare' });
    else if (a.stacking || entries.some((e) => e.stack !== null && e.yAxis === a.id)) report({ code: 'invalid-option', path: `${path}.compare` });
    else if (typeof at !== 'number' && at !== null) report({ code: 'invalid-option', path: `${path}.compareTo` });
    else compare = { mode: a.compare.mode, to: at };
    yIn[i] = { ...a, compare };
  });

  // Axes complete: a category x axis gathers its categories from every series on it, in order.
  const xAxes = xIn.map((a) => finishAxis(a, entries.filter((e) => e.xAxis === a.id).some((e) => e.raw.x.kind === 'values' && e.raw.x.texts !== null), pageZone));
  const categoriesOf = new Map<string, string[]>();
  for (const a of xAxes) if (a.scale === 'category') categoriesOf.set(a.id, [...(a.categories ?? [])]);

  const series: SeriesModel[] = entries.map((e, rank) => {
    const path = `series[${e.i}]`;
    const cats = categoriesOf.get(e.xAxis) ?? null;
    const listed = cats ? xIn.find((a) => a.id === e.xAxis)!.categories?.length ?? 0 : 0;
    const xa = xAxes.find((a) => a.id === e.xAxis);
    let { x, y } = xa?.scale === 'time' && kit.time ? resolveTime(e.raw, xa.zone ?? pageZone, kit.time, `${path}.data`, e.id, report) : resolveX(e.raw, cats, listed, `${path}.data`, e.id, report);
    for (const p of e.raw.problems) report(p);
    const logX = xa?.scale === 'log';
    const logY = yIn.find((a) => a.id === e.yAxis)?.scale === 'log';
    const placed = logX || logY ? dropNonPositive(x, y, logX, logY, `${path}.data`, e.id, report) : { x, y };
    x = placed.x;
    y = placed.y;
    const sorted = isSorted(x);
    if (e.type.sortedX && !sorted) report({ code: 'unsorted-x', path: `${path}.data`, seriesId: e.id });
    // Gaps get the x of the point before them (after them, at the start): x stays ordered for binary search and
    // decimation, and a gap still has no value (review 4).
    if (sorted) fillGapX(x);
    checkSeriesDrill(e.s['drilldown'], `${path}.drilldown`, e.id, report);
    return {
      id: e.id,
      type: e.type.name,
      name: typeof e.s['name'] === 'string' ? e.s['name'] : null,
      rank,
      color: readColor(e.s['color'], rank, `${path}.color`, e.id, report),
      xAxis: e.xAxis,
      yAxis: e.yAxis,
      stack: e.stack,
      initiallyHidden: e.s['initiallyHidden'] === true,
      aggregate: readAggregateFn(e.s['aggregate'], e.type.name, `${path}.aggregate`, e.id, report),
      columns: { ...e.raw.extra, x, y },
      keys: e.raw.keys,
      names: e.raw.names,
      sorted,
      tooltip: e.type.sortedX ? 'shared' : 'mark',
      // Checked against SeriesBase above and by the type's own check: the record is the series' options.
      options: e.s as unknown as SeriesModel['options'],
    };
  });
  const finalX = xAxes.map((a) => (a.scale === 'category' ? { ...a, categories: categoriesOf.get(a.id)! } : a));

  const model: ChartModel = {
    series,
    xAxes: finalX,
    yAxes: yIn.map((a) => finishAxis(a, false, pageZone)),
    title,
    legend: readLegend(options['legend'], series.length, system === 'polar', report),
    locale: readLocale(options['locale'], report),
    dir: oneOf(options['dir'], ['ltr', 'rtl'] as const, 'dir', report),
    mirror: readBool(options['mirror'], 'mirror', report) ?? false,
    aspectRatio: readAspect(options['aspectRatio'], report),
    description: readString(options['description'], 'description', report),
    orientation: orientation ?? 'vertical',
    system: system === 'polar' ? 'polar' : 'cartesian',
    highlight: readBool(options['highlight'], 'highlight', report) ?? true,
    animation: readBool(options['animation'], 'animation', report) ?? true,
    ...readDataTable(options['dataTable'], report),
    navigator: needsNavigator(readBool(options['navigator'], 'navigator', report) ?? false, 'navigator', kit, report),
    rangeButtons: readRangeButtons(options['rangeButtons'], xAxes[0]?.scale === 'time', kit, report),
    crosshair: readCrosshair(options['crosshair'], kit, report),
    selection: readSelection(options['selection'], kit, report),
    drill: readDrill(options['drilldown'], xAxes[0]?.scale === 'time', report),
    menu: readMenu(options['menu'], report),
    kit,
  };
  return { model, problems };
}

/** A type with its own data shape (OHLC, slices…): its reader gives the columns; x and y may be absent. */
function fromTypeData(type: SeriesType, data: unknown, path: string, seriesId: string): RawXY {
  const r = type.readData!(data, path, seriesId);
  const n = r.columns.y.length;
  return { count: n, x: { kind: 'values', numbers: Float64Array.from(r.columns.x), texts: null }, y: r.columns.y, keys: r.keys, names: r.names ?? null, sorted: isSorted(r.columns.x), problems: r.problems, extra: r.columns };
}

/** x as numbers on its axis: positions, values, or category ranks (adding categories the app did not list). */
function resolveX(raw: RawXY, categories: string[] | null, listed: number, path: string, seriesId: string, report: (p: Problem) => void): { x: Float64Array; y: Float64Array } {
  const n = raw.count;
  if (raw.x.kind === 'index') {
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = i;
    // On a category axis, positions past the categories get bands named by their position (review 9).
    if (categories && n > categories.length) {
      if (listed > 0) report({ code: 'invalid-data', path: `${path}[${categories.length}]`, seriesId, detail: 'category' });
      for (let i = categories.length; i < n; i++) categories.push(String(i));
    }
    return { x, y: raw.y };
  }
  const { numbers, texts } = raw.x;
  if (!texts) return { x: numbers, y: raw.y };
  const x = new Float64Array(n);
  let y = raw.y;
  if (categories) {
    const rank = new Map(categories.map((c, i) => [c, i]));
    let unlisted: string | null = null;
    for (let i = 0; i < n; i++) {
      const t = texts[i];
      if (t === null || t === undefined) {
        x[i] = numbers[i]!;
        continue;
      }
      let r = rank.get(t);
      if (r === undefined) {
        r = categories.push(t) - 1;
        rank.set(t, r);
        if (listed > 0 && unlisted === null) unlisted = `${path}[${i}]`;
      }
      x[i] = r;
    }
    if (unlisted !== null) report({ code: 'invalid-data', path: unlisted, seriesId, detail: 'category' });
    return { x, y };
  }
  // Strings along an axis that takes numbers: gaps.
  let first: string | null = null;
  let count = 0;
  for (let i = 0; i < n; i++) {
    x[i] = numbers[i]!;
    if (texts[i] !== null && texts[i] !== undefined) {
      if (count++ === 0) {
        first = `${path}[${i}]`;
        y = y.slice();
      }
      y[i] = Number.NaN;
    }
  }
  if (first !== null) report({ code: 'invalid-data', path: first, seriesId, detail: `count=${count}` });
  return { x, y };
}

interface AxisIn {
  readonly id: string;
  /** The scale the app asked for, or null to guess from the data. */
  readonly scale: ScaleKind | null;
  readonly title: string | null;
  readonly opposite: boolean;
  readonly reversed: boolean;
  readonly min: number | null;
  readonly max: number | null;
  readonly categories: readonly string[] | null;
  readonly ticks: AxisModel['ticks'];
  readonly zone: string | null;
  readonly stacking: 'percent' | null;
  /** A y axis's comparison (compare.md), its baseline's x as the app wrote it until the x axis is known. */
  readonly compare: { readonly mode: CompareMode; readonly to: number | string | null } | null;
  readonly aggregate: AggregateSpec | null;
}

function finishAxis(a: AxisIn, hasTexts: boolean, pageZone: string): AxisModel {
  const scale = a.scale ?? (hasTexts ? 'category' : 'linear');
  // Read on the x axis already (the post pass), or none: only numbers stay.
  return { ...a, compare: a.compare && typeof a.compare.to !== 'string' ? { mode: a.compare.mode, to: a.compare.to } : null, scale, categories: scale === 'category' ? (a.categories ?? []) : null, zone: scale === 'time' ? (a.zone ?? pageZone) : null };
}

/**
 * x on a time axis (time-axis.md 1): numbers are instants; ISO strings with an offset are read; a calendar day stands
 * at its local midnight in the axis's zone; a date-time without an offset is a gap, reported `ambiguous-instant`.
 */
function resolveTime(raw: RawXY, zone: string, time: TimeKit, path: string, seriesId: string, report: (p: Problem) => void): { x: Float64Array; y: Float64Array } {
  const n = raw.count;
  if (raw.x.kind === 'index') return { x: Float64Array.from({ length: n }, (_, i) => i), y: raw.y };
  const { numbers, texts } = raw.x;
  if (!texts) return { x: numbers, y: raw.y };
  const x = new Float64Array(n);
  let y = raw.y;
  const tallies = { ambiguous: { first: '', count: 0 }, invalid: { first: '', count: 0 } };
  for (let i = 0; i < n; i++) {
    const t = texts[i];
    if (t === null || t === undefined) {
      x[i] = numbers[i]!;
      continue;
    }
    const v = time.parse(t, zone);
    if (typeof v === 'number') {
      x[i] = v;
      continue;
    }
    x[i] = Number.NaN;
    if (y === raw.y) y = y.slice();
    y[i] = Number.NaN;
    const tally = tallies[v];
    if (tally.count++ === 0) tally.first = `${path}[${i}]`;
  }
  if (tallies.ambiguous.count) report({ code: 'ambiguous-instant', path: tallies.ambiguous.first, seriesId, detail: `count=${tallies.ambiguous.count}` });
  if (tallies.invalid.count) report({ code: 'invalid-data', path: tallies.invalid.first, seriesId, detail: `count=${tallies.invalid.count}` });
  return { x, y };
}

function readAxes(v: unknown, key: 'xAxis' | 'yAxis', base: 'x' | 'y', report: (p: Problem) => void, ids: Set<string>, pageZone: string, kit: Kit): AxisIn[] {
  const time = kit.time;
  const list: unknown[] = v === undefined ? [{}] : Array.isArray(v) ? (v.length ? v : [{}]) : [v];
  return list.map((a, i) => {
    const path = `${key}[${i}]`;
    const fallbackId = i === 0 ? base : `${base}${i + 1}`;
    if (!isRecord(a)) {
      report({ code: 'invalid-option', path });
      ids.add(fallbackId);
      return { ...defaultAxis(fallbackId), scale: null };
    }
    let id = ids.has(fallbackId) ? `${fallbackId}#${i + 1}` : fallbackId;
    if (a['id'] !== undefined) {
      if (typeof a['id'] !== 'string') report({ code: 'invalid-option', path: `${path}.id` });
      else if (ids.has(a['id'])) report({ code: 'duplicate-id', path: `${path}.id` });
      else id = a['id'];
    }
    ids.add(id);
    let scale: ScaleKind | null = null;
    if (a['scale'] !== undefined) {
      if (typeof a['scale'] === 'string' && SCALES.has(a['scale'] as ScaleKind)) scale = a['scale'] as ScaleKind;
      else report({ code: 'invalid-option', path: `${path}.scale` });
      // A time axis without its module (ADR 0006): its options are still checked as a time axis's; it is drawn linear.
      if (scale === 'time' && !time) report({ code: 'missing-module', path: `${path}.scale`, detail: 'timeAxis' });
    }
    // Options of another scale: a guessed scale accepts the category options only when it may become one.
    const allowed = scale ? AXIS_KEYS[scale] : AXIS_KEYS.linear;
    for (const k of Object.keys(a)) if (!allowed.has(k)) report({ code: 'unknown-option', path: `${path}.${k}` });

    // A time axis's bounds may be ISO date-times or days, read in its zone (TimeAxisOptions).
    const zoneFor = typeof a['zone'] === 'string' && isZone(a['zone']) ? a['zone'] : pageZone;
    // Without the module the axis is linear: a date bound is left out, the missing module already said why.
    const bound = (v: unknown, at: string) => (scale === 'time' && typeof v === 'string' ? (time ? readInstant(v, zoneFor, time, at, report) : null) : readNumber(v, at, report));
    let min = allowed.has('min') ? bound(a['min'], `${path}.min`) : null;
    let max = allowed.has('max') ? bound(a['max'], `${path}.max`) : null;
    // A log axis has no place for zero or below (log-scale.md 3).
    if (scale === 'log' && min !== null && min <= 0) {
      report({ code: 'invalid-option', path: `${path}.min` });
      min = null;
    }
    if (scale === 'log' && max !== null && max <= 0) {
      report({ code: 'invalid-option', path: `${path}.max` });
      max = null;
    }
    if (min !== null && max !== null && min >= max) {
      report({ code: 'invalid-option', path: `${path}.min` });
      min = max = null;
    }
    let categories: string[] | null = null;
    if (allowed.has('categories') && a['categories'] !== undefined) {
      if (Array.isArray(a['categories']) && a['categories'].every((c) => typeof c === 'string')) categories = [...new Set(a['categories'] as string[])];
      else report({ code: 'invalid-option', path: `${path}.categories` });
    }
    // Shares on a y axis only, and not on a log one (stacking.md 11, log-scale.md 10).
    let stacking: 'percent' | null = null;
    if (allowed.has('stacking') && a['stacking'] !== undefined) {
      if (a['stacking'] === 'percent' && key === 'yAxis' && scale !== 'log') stacking = 'percent';
      else report({ code: 'invalid-option', path: `${path}.stacking` });
    }
    // An x axis's aggregation (aggregation.md): a period on a time axis, a step on a numeric one; its module checked.
    let aggregate: AggregateSpec | null = null;
    const ag = a['aggregate'];
    if (allowed.has('aggregate') && ag !== undefined) {
      const period = typeof ag === 'string' && PERIODS.has(ag) && scale === 'time' ? (ag as Period) : null;
      const step = isRecord(ag) && Object.keys(ag).every((k) => k === 'step') && typeof ag['step'] === 'number' && ag['step'] > 0 && Number.isFinite(ag['step']) && scale !== 'time' ? ag['step'] : null;
      if (key !== 'xAxis' || (period === null && step === null)) report({ code: 'invalid-option', path: `${path}.aggregate` });
      else if (!kit.aggregation) report({ code: 'missing-module', path: `${path}.aggregate`, detail: 'aggregation' });
      else aggregate = period ? { period } : { step: step! };
    }
    // A comparison on a y axis (compare.md): its mode, and its baseline's x if the app fixed one.
    let compare: AxisIn['compare'] = null;
    if (allowed.has('compare') && (a['compare'] !== undefined || a['compareTo'] !== undefined)) {
      const mode = a['compare'];
      const to = a['compareTo'];
      if (key !== 'yAxis' || (mode !== 'value' && mode !== 'percent' && mode !== 'index') || scale === 'log') report({ code: 'invalid-option', path: `${path}.compare` });
      else if (to !== undefined && !(typeof to === 'string' || (typeof to === 'number' && Number.isFinite(to)))) report({ code: 'invalid-option', path: `${path}.compareTo` });
      else compare = { mode, to: (to as number | string | undefined) ?? null };
    }
    let zone: string | null = null;
    if (allowed.has('zone') && a['zone'] !== undefined) {
      if (typeof a['zone'] === 'string' && isZone(a['zone'])) zone = a['zone'];
      else report({ code: 'invalid-option', path: `${path}.zone` });
    }
    return {
      id,
      scale: scale === 'time' && !time ? 'linear' : scale,
      title: readString(a['title'], `${path}.title`, report),
      opposite: readBool(a['opposite'], `${path}.opposite`, report) ?? false,
      reversed: readBool(a['reversed'], `${path}.reversed`, report) ?? false,
      min,
      max,
      categories,
      ticks: readTicks(a['ticks'], `${path}.ticks`, report),
      zone,
      stacking,
      compare,
      aggregate,
    };
  });
}

/**
 * On a log axis, a value of zero or below has no place (log-scale.md 2): the point becomes a gap, reported once for the
 * series with how many. The columns are copied first: a typed `y` may be the app's own array.
 */
function dropNonPositive(x: Float64Array, y: Float64Array, onX: boolean, onY: boolean, path: string, seriesId: string, report: (p: Problem) => void): { x: Float64Array; y: Float64Array } {
  let first = -1;
  let count = 0;
  let ox = x;
  let oy = y;
  for (let i = 0; i < y.length; i++) {
    const badX = onX && x[i]! <= 0;
    if (!((onY && y[i]! <= 0) || badX)) continue;
    if (count++ === 0) {
      first = i;
      ox = x.slice();
      oy = y.slice();
    }
    // A y gap keeps its x, so it keeps its row (review 5); an x with no place on its axis has none.
    if (badX) ox[i] = Number.NaN;
    oy[i] = Number.NaN;
  }
  if (count) report({ code: 'non-positive-log-value', path: `${path}[${first}]`, seriesId, detail: `count=${count}` });
  return { x: ox, y: oy };
}

/** A series' stack (stacking.md 1): `true` is the stack `default`, a name is its own; anything else is reported. */
function readStack(v: unknown, path: string, seriesId: string, report: (p: Problem) => void): string | null {
  if (v === undefined || v === false) return null;
  if (v === true) return 'default';
  if (typeof v === 'string' && v !== '') return v;
  report({ code: 'invalid-option', path, seriesId });
  return null;
}

function readTicks(v: unknown, path: string, report: (p: Problem) => void): AxisModel['ticks'] {
  const none = { target: null, format: null, grid: null };
  if (v === undefined) return none;
  if (!isRecord(v)) {
    report({ code: 'invalid-option', path });
    return none;
  }
  for (const k of Object.keys(v)) if (!TICKS_KEYS.has(k)) report({ code: 'unknown-option', path: `${path}.${k}` });
  let target: number | null = null;
  if (v['target'] !== undefined) {
    if (typeof v['target'] === 'number' && Number.isFinite(v['target']) && v['target'] >= 2) target = Math.round(v['target']);
    else report({ code: 'invalid-option', path: `${path}.target` });
  }
  let format: AxisModel['ticks']['format'] = null;
  if (v['format'] !== undefined) {
    if (typeof v['format'] === 'function') format = v['format'] as AxisModel['ticks']['format'];
    else report({ code: 'invalid-option', path: `${path}.format` });
  }
  return { target, format, grid: readBool(v['grid'], `${path}.grid`, report) };
}

function readColor(v: unknown, rank: number, path: string, seriesId: string, report: (p: Problem) => void): ColorToken {
  const place = (n: number): ColorToken => `series-${((n - 1) % PALETTE_SIZE) + 1}`;
  if (v === undefined) return place(rank + 1);
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return place(v);
  if (isRecord(v) && typeof v['token'] === 'string' && CSS_NAME.test(v['token'])) return `color-${v['token']}`;
  report({ code: 'invalid-option', path, seriesId });
  return place(rank + 1);
}

function readTitle(v: unknown, report: (p: Problem) => void): ChartModel['title'] {
  if (v === undefined) return null;
  if (typeof v === 'string') return { text: v, subtitle: null, align: 'start' };
  if (isRecord(v) && typeof v['text'] === 'string') {
    for (const k of Object.keys(v)) if (k !== 'text' && k !== 'subtitle' && k !== 'align') report({ code: 'unknown-option', path: `title.${k}` });
    return {
      text: v['text'],
      subtitle: readString(v['subtitle'], 'title.subtitle', report),
      align: oneOf(v['align'], ['start', 'center', 'end'] as const, 'title.align', report) ?? 'start',
    };
  }
  report({ code: 'invalid-option', path: 'title' });
  return null;
}

/**
 * The legend (legend.md 1): shown by default from two series. A polar chart's legend lists its points and is shown by
 * default only when the type's labels do not fit (`auto`, pie-donut.md 11).
 */
function readLegend(v: unknown, seriesCount: number, polar: boolean, report: (p: Problem) => void): ChartModel['legend'] {
  const shown = { position: 'bottom', align: 'center', auto: false } as const;
  const byDefault = polar ? { ...shown, auto: true } : seriesCount >= 2 ? shown : null;
  if (v === undefined) return byDefault;
  if (v === true) return shown;
  if (v === false) return null;
  if (isRecord(v)) {
    for (const k of Object.keys(v)) if (k !== 'position' && k !== 'align') report({ code: 'unknown-option', path: `legend.${k}` });
    return {
      position: oneOf(v['position'], ['top', 'bottom', 'start', 'end'] as const, 'legend.position', report) ?? 'bottom',
      align: oneOf(v['align'], ['start', 'center', 'end'] as const, 'legend.align', report) ?? 'center',
      auto: false,
    };
  }
  report({ code: 'invalid-option', path: 'legend' });
  return byDefault;
}

function readLocale(v: unknown, report: (p: Problem) => void): string | null {
  if (v === undefined) return null;
  if (typeof v === 'string') {
    try {
      const [canonical] = Intl.getCanonicalLocales(v);
      if (canonical) return canonical;
    } catch {
      // Not a language tag: reported below.
    }
  }
  report({ code: 'invalid-option', path: 'locale' });
  return null;
}

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function readAspect(v: unknown, report: (p: Problem) => void): number {
  if (v === undefined) return DEFAULT_ASPECT;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  report({ code: 'invalid-option', path: 'aspectRatio' });
  return DEFAULT_ASPECT;
}

function readString(v: unknown, path: string, report: (p: Problem) => void): string | null {
  if (v === undefined) return null;
  if (typeof v === 'string') return v;
  report({ code: 'invalid-option', path });
  return null;
}

/** `dataTable`: a boolean, or `{ show, rows }` (data-table.md 2, 5). */
function readDataTable(v: unknown, report: (p: Problem) => void): { dataTable: boolean; dataTableRows: 'visible' | 'all' } {
  if (v === undefined || typeof v === 'boolean') return { dataTable: v ?? false, dataTableRows: 'visible' };
  if (!isRecord(v)) {
    report({ code: 'invalid-option', path: 'dataTable' });
    return { dataTable: false, dataTableRows: 'visible' };
  }
  for (const k of Object.keys(v)) if (k !== 'show' && k !== 'rows') report({ code: 'unknown-option', path: `dataTable.${k}` });
  return { dataTable: readBool(v['show'], 'dataTable.show', report) ?? false, dataTableRows: oneOf(v['rows'], ['visible', 'all'] as const, 'dataTable.rows', report) ?? 'visible' };
}

/** `rangeButtons` (range-buttons.md): spans of time, so only on a time axis; asked elsewhere, reported and left out. */
function readRangeButtons(v: unknown, onTime: boolean, kit: Kit, report: (p: Problem) => void): boolean | null {
  const b = readBool(v, 'rangeButtons', report);
  if (b && !needsNavigator(b, 'rangeButtons', kit, report)) return false;
  if (b && !onTime) {
    report({ code: 'not-available', path: 'rangeButtons', detail: 'not-time' });
    return false;
  }
  return b;
}

const PERIODS = new Set(['hour', 'day', 'week', 'month', 'quarter', 'year']);

/** A series' function when aggregated (aggregation.md 1): its own, else a sum for columns and bars, a mean otherwise. */
function readAggregateFn(v: unknown, type: string, path: string, seriesId: string, report: (p: Problem) => void): AggregateFn {
  if (v === 'sum' || v === 'mean' || v === 'min' || v === 'max' || v === 'count') return v;
  if (v !== undefined) report({ code: 'invalid-option', path, seriesId });
  return type === 'column' || type === 'bar' ? 'sum' : 'mean';
}

export type MenuItem = 'type' | 'aggregation' | 'scale' | 'compare';
const MENU_ITEMS: readonly MenuItem[] = ['type', 'aggregation', 'scale', 'compare'];

/** `menu: true | { items }` (menu.md): what the chart menu may offer. */
function readMenu(v: unknown, report: (p: Problem) => void): { items: MenuItem[] } | null {
  if (v === undefined || v === false) return null;
  if (v === true) return { items: [...MENU_ITEMS] };
  const list = isRecord(v) && Object.keys(v).every((k) => k === 'items') ? v['items'] : undefined;
  if (Array.isArray(list) && list.length && list.every((x) => MENU_ITEMS.includes(x as MenuItem))) return { items: MENU_ITEMS.filter((x) => list.includes(x)) };
  report({ code: 'invalid-option', path: 'menu' });
  return null;
}

/** `drilldown: 'time'` (drilldown.md 6): years, then months, then days, on a time x axis. */
function readDrill(v: unknown, onTime: boolean, report: (p: Problem) => void): 'time' | null {
  if (v === undefined || v === false) return null;
  if (v === 'time' && onTime) return 'time';
  report({ code: 'invalid-option', path: 'drilldown' });
  return null;
}

/** A series' `drilldown` (drilldown.md): `{ details: { [key]: series[] } }` or `{ load: (point) => Promise }`. */
function checkSeriesDrill(v: unknown, path: string, seriesId: string, report: (p: Problem) => void): void {
  if (v === undefined) return;
  const o = isRecord(v) ? v : null;
  const details = o?.['details'];
  const ok = o !== null && Object.keys(o).length === 1 && (typeof o['load'] === 'function' || (isRecord(details) && Object.values(details).every(Array.isArray)));
  if (!ok) report({ code: 'invalid-option', path, seriesId });
}

/** `selection: true | { shapes }` (selection.md 1), with the `selection` module (ADR 0006). */
function readSelection(v: unknown, kit: Kit, report: (p: Problem) => void): { shapes: SelectShape[] } | null {
  if (v === undefined || v === false) return null;
  const all: SelectShape[] = ['rectangle', 'range', 'lasso'];
  const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const list = o?.['shapes'];
  const ok = v === true || (o !== null && Object.keys(o).every((k) => k === 'shapes') && (list === undefined || (Array.isArray(list) && list.length > 0 && list.every((x) => all.includes(x as SelectShape)))));
  if (!ok) {
    report({ code: 'invalid-option', path: 'selection' });
    return null;
  }
  if (!kit.selection) {
    report({ code: 'missing-module', path: 'selection', detail: 'selection' });
    return null;
  }
  return { shapes: Array.isArray(list) ? [...new Set(list as SelectShape[])] : ['rectangle', 'range'] };
}

/** `crosshair: true | { horizontal }` (crosshair.md), with the `crosshair` module (ADR 0006). */
function readCrosshair(v: unknown, kit: Kit, report: (p: Problem) => void): { horizontal: boolean } | null {
  if (v === undefined || v === false) return null;
  const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const okObject = o !== null && Object.keys(o).every((k) => k === 'horizontal') && (o['horizontal'] === undefined || typeof o['horizontal'] === 'boolean');
  if (v !== true && !okObject) {
    report({ code: 'invalid-option', path: 'crosshair' });
    return null;
  }
  if (!kit.crosshair) {
    report({ code: 'missing-module', path: 'crosshair', detail: 'crosshair' });
    return null;
  }
  return { horizontal: o?.['horizontal'] === true };
}

/** The navigator and the range buttons come with `navigatorStrip` (ADR 0006): asked without it, reported and left out. */
function needsNavigator(asked: boolean, path: string, kit: Kit, report: (p: Problem) => void): boolean {
  if (asked && !kit.navigator) {
    report({ code: 'missing-module', path, detail: 'navigatorStrip' });
    return false;
  }
  return asked;
}

function readBool(v: unknown, path: string, report: (p: Problem) => void): boolean | null {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v;
  report({ code: 'invalid-option', path });
  return null;
}

function readInstant(v: string, zone: string, time: TimeKit, path: string, report: (p: Problem) => void): number | null {
  const t = time.parse(v, zone);
  if (typeof t === 'number') return t;
  report({ code: t === 'ambiguous' ? 'ambiguous-instant' : 'invalid-option', path });
  return null;
}

function readNumber(v: unknown, path: string, report: (p: Problem) => void): number | null {
  if (v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  report({ code: 'invalid-option', path });
  return null;
}

function oneOf<const T extends readonly string[]>(v: unknown, allowed: T, path: string, report: (p: Problem) => void): T[number] | null {
  if (v === undefined) return null;
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T[number];
  report({ code: 'invalid-option', path });
  return null;
}

/**
 * Fills each NaN x with its nearest earlier x (the first ones with the first x): x stays ordered. Those points are
 * already gaps (data.ts: a point without a usable x has no value), and `x` is always the chart's own array.
 */
function fillGapX(x: Float64Array): void {
  let last = Number.NaN;
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(x[i]!)) {
      if (!Number.isNaN(last)) x[i] = last;
    } else last = x[i]!;
  }
  let first = Number.NaN;
  for (let i = 0; i < x.length && Number.isNaN(first); i++) if (!Number.isNaN(x[i]!)) first = x[i]!;
  if (!Number.isNaN(first)) for (let i = 0; i < x.length && Number.isNaN(x[i]!); i++) x[i] = first;
}
