/**
 * Checks the options an app wrote and completes them into the chart's model (model.ts). Never throws: a bad option is
 * reported and its default used; a series that cannot be drawn is left out and reported; anything unreadable (a getter
 * that throws) gives an empty chart and one Problem. Problems carry option paths and option names, never the data's
 * values (CLAUDE.md).
 */
import type { Problem } from './problem.js';
import type { ScaleKind } from './options.js';
import type { ColorToken } from './scene.js';
import type { SeriesModel, SeriesType } from './series-type.js';
import type { AxisModel, ChartModel } from './model.js';
import { isSorted, readXYData, type RawXY } from './data.js';

/**
 * The theme's categorical palette has eight colours (`--dzgraph-series-1` … `-8`, validated for colour-blind
 * separation and contrast, theme/README.md); places past eight wrap, each series keeping its own marker symbol.
 */
const PALETTE_SIZE = 8;
const DEFAULT_ASPECT = 16 / 9;

const TOP_KEYS = new Set(['title', 'series', 'xAxis', 'yAxis', 'legend', 'locale', 'dir', 'mirror', 'aspectRatio', 'description', 'highlight', 'animation', 'dataTable']);
const SERIES_KEYS = new Set(['type', 'id', 'name', 'data', 'xAxis', 'yAxis', 'color', 'initiallyHidden']);
const AXIS_BASE_KEYS = ['id', 'title', 'opposite', 'reversed', 'scale'];
const AXIS_KEYS: Record<ScaleKind, ReadonlySet<string>> = {
  linear: new Set([...AXIS_BASE_KEYS, 'min', 'max', 'ticks']),
  log: new Set([...AXIS_BASE_KEYS, 'min', 'max', 'ticks']),
  category: new Set([...AXIS_BASE_KEYS, 'categories', 'ticks']),
  time: new Set([...AXIS_BASE_KEYS, 'zone', 'min', 'max', 'ticks']),
};
const TICKS_KEYS = new Set(['target', 'format', 'grid']);
const SCALES = new Set<ScaleKind>(['linear', 'log', 'category', 'time']);
/** The scales this version draws; the others are accepted, reported and drawn linear. */
const DRAWN_SCALES = new Set<ScaleKind>(['linear', 'category']);
/** The coordinate systems this version lays out; a type of another is left out and reported. */
const LAID_OUT_SYSTEMS = new Set<string>(['cartesian']);
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
  highlight: true,
  animation: true,
  dataTable: false,
};

function defaultAxis(id: string, scale: ScaleKind = 'linear'): AxisModel {
  return { id, scale, title: null, opposite: false, reversed: false, min: null, max: null, categories: scale === 'category' ? [] : null, ticks: { target: null, format: null, grid: null }, zone: null };
}

export function normalize(options: unknown, types: readonly SeriesType[]): { readonly model: ChartModel; readonly problems: readonly Problem[] } {
  try {
    return normalizeOrThrow(options, types);
  } catch {
    // Only an app's getter or proxy can throw while being read.
    return { model: EMPTY_MODEL, problems: [{ code: 'invalid-option', path: '' }] };
  }
}

function normalizeOrThrow(options: unknown, types: readonly SeriesType[]) {
  const problems: Problem[] = [];
  if (!isRecord(options)) return { model: EMPTY_MODEL, problems: [{ code: 'invalid-option', path: '' } as const] };
  const report = (p: Problem) => problems.push(p);

  for (const k of Object.keys(options)) if (!TOP_KEYS.has(k)) report({ code: 'unknown-option', path: k });

  const title = readTitle(options['title'], report);
  // Axis ids are one namespace for x and y: a series names its axes by id (review 2).
  const axisIds = new Set<string>();
  const xIn = readAxes(options['xAxis'], 'xAxis', 'x', report, axisIds);
  const yIn = readAxes(options['yAxis'], 'yAxis', 'y', report, axisIds);

  // Series: checked one by one; those that can be drawn keep their place in `drawn`.
  const byName = new Map(types.map((t) => [t.name as string, t]));
  const seriesIn = options['series'];
  const entries: { s: Rec; i: number; type: SeriesType; id: string; raw: RawXY; xAxis: string; yAxis: string }[] = [];
  let orientation: 'vertical' | 'horizontal' | null = null;
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
      const wanted = type.orientation ?? 'vertical';
      if (orientation !== null && wanted !== orientation) return void report({ code: 'mixed-orientation', path: `${path}.type`, seriesId: id, detail: type.name });
      orientation ??= wanted;

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
      const raw = type.readData ? fromTypeData(type, s['data'], `${path}.data`) : readXYData(s['data'], `${path}.data`, id);
      entries.push({ s, i, type, id, raw, xAxis, yAxis });
    });
  }

  // Axes complete: a category x axis gathers its categories from every series on it, in order.
  const xAxes = xIn.map((a) => finishAxis(a, entries.filter((e) => e.xAxis === a.id).some((e) => e.raw.x.kind === 'values' && e.raw.x.texts !== null)));
  const categoriesOf = new Map<string, string[]>();
  for (const a of xAxes) if (a.scale === 'category') categoriesOf.set(a.id, [...(a.categories ?? [])]);

  const series: SeriesModel[] = entries.map((e, rank) => {
    const path = `series[${e.i}]`;
    const cats = categoriesOf.get(e.xAxis) ?? null;
    const listed = cats ? xIn.find((a) => a.id === e.xAxis)!.categories?.length ?? 0 : 0;
    const { x, y } = resolveX(e.raw, cats, listed, `${path}.data`, e.id, report);
    for (const p of e.raw.problems) report(p);
    const sorted = isSorted(x);
    if (e.type.sortedX && !sorted) report({ code: 'unsorted-x', path: `${path}.data`, seriesId: e.id });
    // Gaps get the x of the point before them (after them, at the start): x stays ordered for binary search and
    // decimation, and a gap still has no value (review 4).
    if (sorted) fillGapX(x);
    return {
      id: e.id,
      type: e.type.name,
      name: typeof e.s['name'] === 'string' ? e.s['name'] : null,
      rank,
      color: readColor(e.s['color'], rank, `${path}.color`, e.id, report),
      xAxis: e.xAxis,
      yAxis: e.yAxis,
      initiallyHidden: e.s['initiallyHidden'] === true,
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
    yAxes: yIn.map((a) => finishAxis(a, false)),
    title,
    legend: readLegend(options['legend'], series.length, report),
    locale: readLocale(options['locale'], report),
    dir: oneOf(options['dir'], ['ltr', 'rtl'] as const, 'dir', report),
    mirror: readBool(options['mirror'], 'mirror', report) ?? false,
    aspectRatio: readAspect(options['aspectRatio'], report),
    description: readString(options['description'], 'description', report),
    orientation: orientation ?? 'vertical',
    highlight: readBool(options['highlight'], 'highlight', report) ?? true,
    animation: readBool(options['animation'], 'animation', report) ?? true,
    dataTable: readBool(options['dataTable'], 'dataTable', report) ?? false,
  };
  return { model, problems };
}

/** A type with its own data shape (OHLC, slices…): its reader gives the columns; x and y may be absent. */
function fromTypeData(type: SeriesType, data: unknown, path: string): RawXY {
  const r = type.readData!(data, path);
  const n = r.columns.y.length;
  return { count: n, x: { kind: 'values', numbers: Float64Array.from(r.columns.x), texts: null }, y: r.columns.y, keys: r.keys, names: null, sorted: isSorted(r.columns.x), problems: r.problems, extra: r.columns };
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
}

function finishAxis(a: AxisIn, hasTexts: boolean): AxisModel {
  const scale = a.scale ?? (hasTexts ? 'category' : 'linear');
  return { ...a, scale, categories: scale === 'category' ? (a.categories ?? []) : null };
}

function readAxes(v: unknown, key: 'xAxis' | 'yAxis', base: 'x' | 'y', report: (p: Problem) => void, ids: Set<string>): AxisIn[] {
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
      // Accepted by the types, drawn in a later phase (log: 4, time: 3): linear meanwhile, and said so.
      if (scale && !DRAWN_SCALES.has(scale)) report({ code: 'not-available', path: `${path}.scale`, detail: scale });
    }
    // Options of another scale: a guessed scale accepts the category options only when it may become one.
    const allowed = scale ? AXIS_KEYS[scale] : AXIS_KEYS.linear;
    for (const k of Object.keys(a)) if (!allowed.has(k)) report({ code: 'unknown-option', path: `${path}.${k}` });

    let min = allowed.has('min') ? readNumber(a['min'], `${path}.min`, report) : null;
    let max = allowed.has('max') ? readNumber(a['max'], `${path}.max`, report) : null;
    if (min !== null && max !== null && min >= max) {
      report({ code: 'invalid-option', path: `${path}.min` });
      min = max = null;
    }
    let categories: string[] | null = null;
    if (allowed.has('categories') && a['categories'] !== undefined) {
      if (Array.isArray(a['categories']) && a['categories'].every((c) => typeof c === 'string')) categories = [...new Set(a['categories'] as string[])];
      else report({ code: 'invalid-option', path: `${path}.categories` });
    }
    let zone: string | null = null;
    if (allowed.has('zone') && a['zone'] !== undefined) {
      if (typeof a['zone'] === 'string' && isZone(a['zone'])) zone = a['zone'];
      else report({ code: 'invalid-option', path: `${path}.zone` });
    }
    return {
      id,
      scale,
      title: readString(a['title'], `${path}.title`, report),
      opposite: readBool(a['opposite'], `${path}.opposite`, report) ?? false,
      reversed: readBool(a['reversed'], `${path}.reversed`, report) ?? false,
      min,
      max,
      categories,
      ticks: readTicks(a['ticks'], `${path}.ticks`, report),
      zone,
    };
  });
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

function readLegend(v: unknown, seriesCount: number, report: (p: Problem) => void): ChartModel['legend'] {
  const shown = { position: 'bottom', align: 'center' } as const;
  if (v === undefined) return seriesCount >= 2 ? shown : null;
  if (v === true) return shown;
  if (v === false) return null;
  if (isRecord(v)) {
    for (const k of Object.keys(v)) if (k !== 'position' && k !== 'align') report({ code: 'unknown-option', path: `legend.${k}` });
    return {
      position: oneOf(v['position'], ['top', 'bottom', 'start', 'end'] as const, 'legend.position', report) ?? 'bottom',
      align: oneOf(v['align'], ['start', 'center', 'end'] as const, 'legend.align', report) ?? 'center',
    };
  }
  report({ code: 'invalid-option', path: 'legend' });
  return seriesCount >= 2 ? shown : null;
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

function readBool(v: unknown, path: string, report: (p: Problem) => void): boolean | null {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v;
  report({ code: 'invalid-option', path });
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
