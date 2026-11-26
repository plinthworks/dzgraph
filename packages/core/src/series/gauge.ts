/**
 * The gauge (gauge.md), a polar type (ADR 0007): one value on a half ring open downwards, filled from the scale's start
 * along the reading direction; its value written in the middle, the scale's ends under the ring's ends, thresholds as
 * a thin ring outside with the value's threshold named under it. No needle (owner 2026-11-21). Richer (gauge.md 13–18,
 * owner 2026-11-24): the fill from an origin, ticks and their numbers inside the arc, thresholds painted on the track.
 * As a bar (gauge.md 19–24, owner 2026-11-24): the same options on a straight bar, across or upright.
 */
import { ownDirection } from '../dir.js';
import type { SeriesBase } from '../options.js';
import type { MarkContext, MarkSet, Placement, PlaceInput, SeriesType } from '../series-type.js';
import type { ArcPrimitive, ColorToken, Primitive, RectPrimitive, TextPrimitive } from '../scene.js';
import type { Problem } from '../problem.js';
import { formatValue } from '../format.js';
import { sceneId } from './shared.js';

export interface GaugeThreshold {
  readonly from: number;
  readonly to: number;
  /** Written under the value when it falls in this threshold, so it is not told by colour alone (gauge.md 6). */
  readonly label?: string | undefined;
  /** A colour the app defines as `--dzgraph-color-<name>`; absent: neutral. */
  readonly color?: string | undefined;
}

/** Ticks along a gauge's arc (gauge.md 14). */
export interface GaugeTicks {
  /** A tick at every multiple of `step` within the scale; at most 200 ticks. */
  readonly step: number;
  /** A longer tick with its number at every multiple of `labels`, itself a multiple of `step`; absent: no numbers. */
  readonly labels?: number | undefined;
}

export interface GaugeSeriesOptions extends SeriesBase<'gauge', number | null | readonly (number | null)[]> {
  /**
   * The scale (gauge.md 1). Default 0 to 100.
   * @default `0`
   */
  readonly min?: number | undefined;
  /**
   * @default `100`
   */
  readonly max?: number | undefined;
  readonly thresholds?: readonly GaugeThreshold[] | undefined;
  /**
   * Where the fill starts (gauge.md 13): `0` on a scale from −2000 to 2000 fills towards the value, either way.
   * @default {scaleMin}
   */
  readonly origin?: number | undefined;
  /** Ticks inside the arc, and their numbers (gauge.md 14). */
  readonly ticks?: GaugeTicks | undefined;
  /**
   * The thresholds as a thin ring outside the arc, or painted on the arc itself with their labels around it (gauge.md 15).
   * @default `'ring'`
   */
  readonly thresholdsOn?: 'ring' | 'track' | undefined;
  /**
   * A half ring, or a straight bar (gauge.md 19); every other option holds for both.
   * @default `'arc'`
   */
  readonly shape?: 'arc' | 'bar' | undefined;
  /**
   * The bar's direction (gauge.md 20): across, `min` at the inline start; or upright, `min` at the bottom.
   * @default `'horizontal'`
   */
  readonly orientation?: 'horizontal' | 'vertical' | undefined;
  /**
   * The arc's or the bar's thickness, in pixels (gauge.md 25).
   * @default {gaugeThickness}
   */
  readonly thickness?: number | undefined;
}

declare module '../options.js' {
  interface SeriesOptionsByType {
    gauge: GaugeSeriesOptions;
  }
}

/** The ring a quarter of its radius thick (gauge.md 2); the thresholds' ring 6 px wide, 3 px outside it. */
const THICKNESS = 0.25;
const RING_GAP = 3;
const RING = 6;
/** Between the ring's base and the texts under it. */
const TEXT_GAP = 4;
/** A tick's length inwards from the arc's inner edge, a labelled one's, and the gap to its number (gauge.md 14). */
const TICK = 4;
const TICK_LONG = 8;
const MOST_TICKS = 200;
/** The bar's thickness at most (gauge.md 21); the gap under the value, so its threshold is not read with the zones'. */
const BAR = 24;
const HEAD_GAP = 14;
const CSS_NAME = /^[a-zA-Z_][\w-]*$/;
const HALF = Math.PI / 2;

/** What a gauge tells beyond its slices: its scale, its value, the threshold it falls in. */
export interface GaugeMeter {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly threshold: string | null;
}

type Zone = { readonly color: ColorToken; readonly start: number; readonly end: number };
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type FreeEnd = NonNullable<RectPrimitive['roundEnd']>;

/** The half ring (gauge.md 2): angles in radians, clockwise from twelve o'clock. */
export interface GaugeArc {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly inner: number;
  readonly track: readonly [number, number];
  readonly fill: readonly [number, number] | null;
  readonly grows: 'start' | 'end';
  readonly rings: readonly Zone[];
}

/** The straight bar (gauge.md 19–21): its track, the value from the origin, the thresholds' rectangles. */
export interface GaugeBar {
  readonly track: Rect;
  readonly fill: Rect | null;
  /** The value's end, away from the origin: where it grows to when it appears (gauge.md 24). */
  readonly free: FreeEnd;
  readonly zones: readonly (Rect & { readonly color: ColorToken })[];
}

export interface GaugePlacement extends Placement {
  readonly meter: GaugeMeter;
  readonly shape: { readonly kind: 'arc'; readonly arc: GaugeArc } | { readonly kind: 'bar'; readonly bar: GaugeBar };
  /** `thresholdsOn: 'track'`: the zones painted on the arc or the bar, the value narrower over them (gauge.md 15, 21). */
  readonly onTrack: boolean;
  readonly ticks: readonly { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }[];
  readonly texts: readonly { readonly text: string; readonly font: 'title' | 'tick-label'; readonly x: number; readonly y: number; readonly muted: boolean }[];
}

function readGauge(data: unknown, path: string, seriesId: string) {
  const v = Array.isArray(data) ? data[0] : data;
  const ok = v === null || (typeof v === 'number' && Number.isFinite(v));
  const problems: Problem[] = ok && (!Array.isArray(data) || data.length <= 1) ? [] : [{ code: 'invalid-data', path, seriesId }];
  return { columns: { x: Float64Array.of(0), y: Float64Array.of(ok && v !== null ? (v as number) : Number.NaN) }, keys: null, problems };
}

/** The scale, the defaults when the app's is not one (gauge.md 1). */
function scaleOf(o: Readonly<Record<string, unknown>>): { min: number; max: number } {
  const min = typeof o['min'] === 'number' && Number.isFinite(o['min']) ? o['min'] : 0;
  const max = typeof o['max'] === 'number' && Number.isFinite(o['max']) ? o['max'] : 100;
  return min < max ? { min, max } : { min: 0, max: 100 };
}

function thresholdsOf(o: Readonly<Record<string, unknown>>): GaugeThreshold[] {
  const list = o['thresholds'];
  return Array.isArray(list) ? list.filter(isThreshold) : [];
}

/** The origin of the fill when it is one (gauge.md 13); `min` otherwise. */
function originOf(o: Readonly<Record<string, unknown>>, min: number, max: number): number {
  const v = o['origin'];
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : min;
}

/** The ticks asked, when they can be drawn (gauge.md 14): the step, and the numbers' step or null. */
function ticksOf(o: Readonly<Record<string, unknown>>, min: number, max: number): { step: number; labels: number | null } | null {
  const t = o['ticks'];
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return null;
  const r = t as Record<string, unknown>;
  const step = r['step'];
  if (typeof step !== 'number' || !Number.isFinite(step) || step <= 0 || tickCount(min, max, step) > MOST_TICKS) return null;
  return { step, labels: isMultiple(r['labels'], step) ? (r['labels'] as number) : null };
}

/** Two values of the scale the same, within a hair of the step (0.1 × 3 is 0.3). */
const same = (a: number, b: number, step: number) => Math.abs(a - b) < step * 1e-6;

/** How many multiples of `step` the scale holds, its ends included (0–200 by 1: 201). */
function tickCount(min: number, max: number, step: number): number {
  return Math.floor(max / step + 1e-9) - Math.ceil(min / step - 1e-9) + 1;
}

/** A positive multiple of the step, a hair of tolerance for the division (0.3 / 0.1). */
function isMultiple(v: unknown, step: number): boolean {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return false;
  const k = v / step;
  return Math.round(k) >= 1 && Math.abs(k - Math.round(k)) < 1e-9;
}

const isThickness = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function isThreshold(t: unknown): t is GaugeThreshold {
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return false;
  const r = t as Record<string, unknown>;
  const keys = Object.keys(r).every((k) => k === 'from' || k === 'to' || k === 'label' || k === 'color');
  return keys && typeof r['from'] === 'number' && typeof r['to'] === 'number' && r['from'] < r['to'] && (r['label'] === undefined || typeof r['label'] === 'string') && (r['color'] === undefined || (typeof r['color'] === 'string' && CSS_NAME.test(r['color'])));
}

/** What both shapes read from the options and the value, before either is placed. */
interface Reading {
  readonly min: number;
  readonly max: number;
  readonly origin: number;
  readonly ticks: { readonly step: number; readonly labels: number | null } | null;
  readonly thresholds: readonly GaugeThreshold[];
  readonly onTrack: boolean;
  /** The thickness asked in pixels (gauge.md 25), or null for the shape's own. */
  readonly thickness: number | null;
  readonly value: number;
  readonly has: boolean;
  readonly within: GaugeThreshold | undefined;
  /** Where `v` falls along the scale, 0 to 1, clamped (a value past the scale fills it, gauge.md 5). */
  readonly at: (v: number) => number;
  /** The tick values from min to max (gauge.md 14), each with whether it carries its number. */
  readonly tickValues: readonly { readonly v: number; readonly labelled: boolean }[];
  readonly zoneLabels: readonly GaugeThreshold[];
  /** The thresholds drawn: those that reach into the scale (gauge.md 15); all of them still name the value. */
  readonly shown: readonly GaugeThreshold[];
  readonly valueText: string;
  readonly lineH: number;
  readonly bigH: number;
}

function read(input: PlaceInput): Reading {
  const { series: s, measureText, locale } = input;
  const o = s.options as unknown as Readonly<Record<string, unknown>>;
  const { min, max } = scaleOf(o);
  const ticks = ticksOf(o, min, max);
  const thresholds = thresholdsOf(o);
  const shown = thresholds.filter((t) => t.from < max && t.to > min);
  const onTrack = o['thresholdsOn'] === 'track';
  const value = s.columns.y[0]!;
  const has = !Number.isNaN(value);
  const tickValues: { v: number; labelled: boolean }[] = [];
  if (ticks) {
    const first = Math.ceil(min / ticks.step - 1e-9);
    const last = Math.floor(max / ticks.step + 1e-9);
    for (let k = first; k <= last; k++) {
      const v = k * ticks.step;
      tickValues.push({ v, labelled: ticks.labels !== null && (v === 0 || isMultiple(Math.abs(v), ticks.labels)) });
    }
  }
  const tick = measureText('', 'tick-label');
  const big = measureText('', 'title');
  return {
    min,
    max,
    origin: originOf(o, min, max),
    ticks,
    thresholds,
    onTrack,
    thickness: isThickness(o['thickness']) ? o['thickness'] : null,
    value,
    has,
    within: thresholds.find((t) => has && value >= t.from && value <= t.to),
    at: (v) => Math.min(1, Math.max(0, (v - min) / (max - min))),
    tickValues,
    zoneLabels: onTrack ? shown.filter((t) => t.label) : [],
    shown,
    valueText: has ? formatValue(value, locale) : '—',
    lineH: tick.ascent + tick.descent,
    bigH: big.ascent + big.descent,
  };
}

function placeGauge(input: PlaceInput): GaugePlacement {
  const s = input.series;
  const o = s.options as unknown as Readonly<Record<string, unknown>>;
  const r = read(input);
  const name = s.name ?? input.text.seriesName(s.rank + 1);
  const placed = o['shape'] === 'bar' ? placeBar(input, r, o['orientation'] === 'vertical') : placeArc(input, r);
  return {
    meter: { min: r.min, max: r.max, value: r.value, threshold: r.within?.label ?? null },
    onTrack: r.onTrack,
    ...placed,
    legend: [],
    needsLegend: false,
    order: r.has ? [0] : [],
    share: () => Number.NaN,
    members: () => null,
    name: () => name,
  };
}

type Placed = Pick<GaugePlacement, 'shape' | 'ticks' | 'texts' | 'anchor'>;

function placeArc(input: PlaceInput, r: Reading): Placed {
  const { box, measureText, locale } = input;
  // The thresholds drawn are those reaching into the scale (gauge.md 15).
  const { min, max, origin, shown: thresholds, onTrack, value, has, within, at, lineH, zoneLabels } = r;
  const ring = thresholds.length && !onTrack ? RING_GAP + RING : 0;
  // Zone labels around the arc (gauge.md 15): a line above it, the widest on either side.
  const around = zoneLabels.length ? TEXT_GAP + lineH : 0;
  const aside = zoneLabels.length ? TEXT_GAP + Math.max(...zoneLabels.map((t) => measureText(t.label!, 'tick-label').width)) : 0;
  // As large as the box allows: twice as wide as high, the texts under it.
  const below = TEXT_GAP + lineH + (within?.label ? lineH + 2 : 0);
  const radius = Math.max(0, Math.min(box.width / 2 - ring - aside - 2, box.height - below - ring - around - 2));
  const inner = r.thickness === null ? radius * (1 - THICKNESS) : Math.max(0, radius - r.thickness);
  const cx = box.x + box.width / 2;
  const cy = box.y + (box.height - (radius + ring + around + below)) / 2 + radius + ring + around;
  // Along the reading direction (gauge.md 3): from the left end in left to right, from the right end in right to left.
  const ltr = input.dir === 'ltr';
  const angle = (v: number) => (ltr ? -HALF + Math.PI * at(v) : HALF - Math.PI * at(v));
  const span = (a: number, b: number): [number, number] => (ltr ? [-HALF + Math.PI * a, -HALF + Math.PI * b] : [HALF - Math.PI * b, HALF - Math.PI * a]);
  const toward = (a: number, d: number) => ({ x: cx + d * Math.sin(a), y: cy - d * Math.cos(a) });
  // From the origin to the value, either way (gauge.md 13); it grows from the origin's end.
  const up = has && value >= origin;
  const fill = has ? (up ? span(at(origin), at(value)) : span(at(value), at(origin))) : null;
  const grows: 'start' | 'end' = up === ltr ? 'start' : 'end';
  const rings = thresholds.map((t) => {
    const [start, end] = span(at(t.from), at(t.to));
    return { color: colorOf(t), start, end };
  });
  const texts: Placed['texts'][number][] = [];
  const valueY = cy - r.bigH / 2 - 2;
  texts.push({ text: r.valueText, font: 'title', x: cx, y: valueY, muted: false });
  const valueBox = boxOf(cx, valueY, measureText(r.valueText, 'title').width, r.bigH);
  const under = cy + TEXT_GAP + lineH / 2;
  const mid = (radius + inner) / 2;
  if (within?.label) texts.push({ text: within.label, font: 'tick-label', x: cx, y: under + lineH + 2, muted: false });
  // Ticks inwards from the inner edge, numbers inside them; a number over the value, or over one placed, is left out
  // (gauge.md 14). No room inside the arc for a long tick: none (gauge.md 25).
  const lines: Placed['ticks'][number][] = [];
  const numbers: Box[] = [valueBox];
  const written: number[] = [];
  for (const { v, labelled } of inner >= TICK_LONG ? r.tickValues : []) {
    const a = angle(v);
    const from = toward(a, inner);
    const to = toward(a, inner - (labelled ? TICK_LONG : TICK));
    lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    if (!labelled) continue;
    const label = formatValue(v, locale);
    const w = measureText(label, 'tick-label').width;
    // Its half-extent towards the centre: a number that would reach past the centre is left out (gauge.md 25).
    const half = (w / 2) * Math.abs(Math.sin(a)) + (lineH / 2) * Math.abs(Math.cos(a));
    const d = inner - TICK_LONG - 3 - half;
    if (d < half) continue;
    const c = toward(a, d);
    if (!place(numbers, boxOf(c.x, c.y, w, lineH))) continue;
    texts.push({ text: label, font: 'tick-label', x: c.x, y: c.y, muted: true });
    written.push(v);
  }
  // The scale's ends under the arc's ends, unless a number writes them (gauge.md 4, 14).
  const [first, last] = ltr ? [min, max] : [max, min];
  const wrote = (end: number) => written.some((v) => same(v, end, r.ticks!.step));
  if (!(r.ticks && wrote(first))) texts.push({ text: formatValue(first, locale), font: 'tick-label', x: cx - mid, y: under, muted: true });
  if (!(r.ticks && wrote(last))) texts.push({ text: formatValue(last, locale), font: 'tick-label', x: cx + mid, y: under, muted: true });
  // Zone labels outside the arc, at each zone's middle; one that would overlap one placed is left out (gauge.md 15).
  const placed: Box[] = [];
  for (const z of zoneLabels) {
    const a = angle((Math.max(z.from, min) + Math.min(z.to, max)) / 2);
    const w = measureText(z.label!, 'tick-label').width;
    const c = toward(a, radius + TEXT_GAP + (w / 2) * Math.abs(Math.sin(a)) + (lineH / 2) * Math.abs(Math.cos(a)));
    if (place(placed, boxOf(c.x, c.y, w, lineH))) texts.push({ text: z.label!, font: 'tick-label', x: c.x, y: c.y, muted: false });
  }
  const tip = fill ? (up === ltr ? fill[1] : fill[0]) : 0;
  return {
    shape: { kind: 'arc', arc: { cx, cy, radius, inner, track: [-HALF, HALF], fill, grows, rings } },
    ticks: lines,
    texts,
    anchor: (index) => (index === 0 && has ? toward(tip, mid) : null),
  };
}

/**
 * The bar (gauge.md 19–23). Across: the value and its threshold on top, the zone labels, the bar, its ticks and
 * numbers under it. Upright: the value on top, the bar under it down to the box's base, the ticks on its inline-end
 * side and the zone labels on its inline-start side.
 */
function placeBar(input: PlaceInput, r: Reading, upright: boolean): Placed {
  const { box, measureText, locale } = input;
  const { min, max, origin, shown: thresholds, onTrack, value, has, within, at, lineH, bigH, zoneLabels } = r;
  const ltr = input.dir === 'ltr';
  const width = (t: string) => measureText(t, 'tick-label').width;
  // The scale's ends are always written and placed first; the numbers between them (gauge.md 22, 23).
  const numbered = r.tickValues.some((t) => t.labelled);
  const isEnd = (v: number) => same(v, min, r.ticks?.step ?? 1) || same(v, max, r.ticks?.step ?? 1);
  const numbers = r.tickValues.filter((t) => t.labelled && !isEnd(t.v)).map((t) => ({ v: t.v, text: formatValue(t.v, locale) }));
  const ends = [formatValue(min, locale), formatValue(max, locale)];
  const ring = thresholds.length && !onTrack ? RING_GAP + RING : 0;
  const tickLen = r.ticks ? TICK_LONG : 0;
  const head = bigH + (within?.label ? 2 + lineH : 0);
  const texts: Placed['texts'][number][] = [];
  const lines: Placed['ticks'][number][] = [];
  const placed: Box[] = [];
  let track: Rect;
  let pos: (v: number) => number;
  if (!upright) {
    // Room under the bar: the ticks, then the numbers or the scale's ends; at the sides, half the widest end number.
    const below = tickLen + TEXT_GAP + lineH;
    const zoneRow = zoneLabels.length ? lineH + TEXT_GAP : 0;
    const thick = Math.max(0, Math.min(r.thickness ?? BAR, box.height - head - HEAD_GAP - zoneRow - ring - below - 4));
    const side = Math.max(0, ...[...numbers.map((n) => n.text), ...ends].map((t) => width(t) / 2)) + 2;
    const top = box.y + (box.height - (head + HEAD_GAP + zoneRow + ring + thick + below)) / 2;
    track = { x: box.x + side, y: top + head + HEAD_GAP + zoneRow + ring, width: Math.max(0, box.width - 2 * side), height: thick };
    const t = track;
    pos = (v) => (ltr ? t.x + at(v) * t.width : t.x + t.width - at(v) * t.width);
    const cx = box.x + box.width / 2;
    texts.push({ text: r.valueText, font: 'title', x: cx, y: top + bigH / 2, muted: false });
    if (within?.label) texts.push({ text: within.label, font: 'tick-label', x: cx, y: top + bigH + 2 + lineH / 2, muted: false });
    const base = t.y + t.height;
    const numberY = base + tickLen + TEXT_GAP + lineH / 2;
    for (const { v, labelled } of r.tickValues) lines.push({ x1: pos(v), y1: base, x2: pos(v), y2: base + (labelled ? TICK_LONG : TICK) });
    ends.forEach((e, k) => {
      const x = pos(k ? max : min);
      place(placed, boxOf(x, numberY, width(e), lineH));
      texts.push({ text: e, font: 'tick-label', x, y: numberY, muted: true });
    });
    for (const n of numbers) {
      const x = pos(n.v);
      if (place(placed, boxOf(x, numberY, width(n.text), lineH))) texts.push({ text: n.text, font: 'tick-label', x, y: numberY, muted: true });
    }
    // Zone labels over each zone's middle, kept inside the box.
    const zoneY = t.y - ring - TEXT_GAP - lineH / 2;
    const zonesPlaced: Box[] = [];
    for (const z of zoneLabels) {
      const w = width(z.label!);
      const x = Math.min(box.x + box.width - w / 2, Math.max(box.x + w / 2, pos((Math.max(z.from, min) + Math.min(z.to, max)) / 2)));
      if (place(zonesPlaced, boxOf(x, zoneY, w, lineH))) texts.push({ text: z.label!, font: 'tick-label', x, y: zoneY, muted: false });
    }
  } else {
    // Room above and under the bar: the scale's ends, or half a number at each end.
    // With numbers, the ends are written beside the bar as they are; without, above and under it.
    const pad = numbered ? lineH / 2 : TEXT_GAP + lineH;
    const zoneW = zoneLabels.length ? TEXT_GAP + Math.max(...zoneLabels.map((z) => width(z.label!))) : 0;
    const numberW = numbered ? 3 + Math.max(...[...numbers.map((n) => n.text), ...ends].map(width)) : 0;
    const thick = Math.max(0, Math.min(r.thickness ?? BAR, box.width - zoneW - ring - tickLen - numberW - 4));
    const startW = zoneW + ring;
    const group = startW + thick + tickLen + numberW;
    const left = box.x + (box.width - group) / 2;
    // The inline-start side is on the left in left to right.
    const x = ltr ? left + startW : left + tickLen + numberW;
    const y = box.y + head + HEAD_GAP + pad;
    track = { x, y, width: thick, height: Math.max(0, box.y + box.height - pad - 2 - y) };
    const t = track;
    pos = (v) => t.y + t.height - at(v) * t.height;
    const cx = t.x + t.width / 2;
    texts.push({ text: r.valueText, font: 'title', x: cx, y: box.y + bigH / 2, muted: false });
    if (within?.label) texts.push({ text: within.label, font: 'tick-label', x: cx, y: box.y + bigH + 2 + lineH / 2, muted: false });
    const edge = ltr ? t.x + t.width : t.x;
    const out = ltr ? 1 : -1;
    for (const { v, labelled } of r.tickValues) lines.push({ x1: edge, y1: pos(v), x2: edge + out * (labelled ? TICK_LONG : TICK), y2: pos(v) });
    const beside = numbered ? [{ v: min, text: ends[0]! }, { v: max, text: ends[1]! }, ...numbers] : [];
    for (const n of beside) {
      const w = width(n.text);
      const nx = edge + out * (tickLen + 3 + w / 2);
      if (place(placed, boxOf(nx, pos(n.v), w, lineH))) texts.push({ text: n.text, font: 'tick-label', x: nx, y: pos(n.v), muted: true });
    }
    if (!numbered) {
      texts.push({ text: ends[1]!, font: 'tick-label', x: cx, y: t.y - TEXT_GAP - lineH / 2, muted: true });
      texts.push({ text: ends[0]!, font: 'tick-label', x: cx, y: t.y + t.height + TEXT_GAP + lineH / 2, muted: true });
    }
    const zonesPlaced: Box[] = [];
    for (const z of zoneLabels) {
      const w = width(z.label!);
      const zx = ltr ? t.x - ring - TEXT_GAP - w / 2 : t.x + t.width + ring + TEXT_GAP + w / 2;
      const zy = Math.min(t.y + t.height - lineH / 2, Math.max(t.y + lineH / 2, pos((Math.max(z.from, min) + Math.min(z.to, max)) / 2)));
      if (place(zonesPlaced, boxOf(zx, zy, w, lineH))) texts.push({ text: z.label!, font: 'tick-label', x: zx, y: zy, muted: false });
    }
  }
  // A stretch of the scale as a rectangle on the bar, from `a` to `b`: across, or upright.
  const t = track;
  const stretch = (a: number, b: number): Rect => {
    const [p, q] = [pos(a), pos(b)];
    return upright ? { x: t.x, y: Math.min(p, q), width: t.width, height: Math.abs(p - q) } : { x: Math.min(p, q), y: t.y, width: Math.abs(p - q), height: t.height };
  };
  // The thresholds' strip: on the side away from the ticks (above across, inline start upright), or the bar itself.
  const zones = thresholds.map((z) => {
    const s = stretch(Math.max(z.from, min), Math.min(z.to, max));
    const strip = onTrack ? s : upright ? { ...s, x: ltr ? t.x - RING_GAP - RING : t.x + t.width + RING_GAP, width: RING } : { ...s, y: t.y - RING_GAP - RING, height: RING };
    return { ...strip, color: colorOf(z) };
  });
  const fill = has ? stretch(origin, Math.min(max, Math.max(min, value))) : null;
  const toValue = pos(has ? value : origin) - pos(origin);
  const free: FreeEnd = upright ? (toValue < 0 ? 'y-min' : 'y-max') : toValue > 0 ? 'x-max' : 'x-min';
  const tip = pos(Math.min(max, Math.max(min, has ? value : origin)));
  return {
    shape: { kind: 'bar', bar: { track, fill, free, zones } },
    ticks: lines,
    texts,
    anchor: (index) => (index === 0 && has ? (upright ? { x: t.x + t.width / 2, y: tip } : { x: tip, y: t.y + t.height / 2 }) : null),
  };
}

const colorOf = (t: GaugeThreshold): ColorToken => (t.color ? `color-${t.color}` : 'others') as ColorToken;

type Box = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
const boxOf = (x: number, y: number, w: number, h: number): Box => ({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 });
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Keeps `b` when it overlaps none placed (gauge.md 15, 23): the later one is left out. */
function place(placed: Box[], b: Box): boolean {
  if (placed.some((p) => overlaps(p, b))) return false;
  placed.push(b);
  return true;
}

function gaugeMarks(ctx: MarkContext<SeriesBase<string, unknown>, 'polar'>): MarkSet[] {
  const p = ctx.frame.placement as GaugePlacement;
  const s = ctx.series;
  const items = p.shape.kind === 'arc' ? arcMarks(p.shape.arc, p.onTrack, s) : barMarks(p.shape.bar, p.onTrack, s);
  // Ticks (gauge.md 14, 22).
  p.ticks.forEach((l, k) => items.push({ kind: 'line', sceneId: sceneId('s', s.id, 'tick', k), paint: { stroke: 'tick', strokeWidth: 1 }, ...l }));
  const texts: TextPrimitive[] = p.texts.map((t, k) => ({ kind: 'text', sceneId: sceneId('s', s.id, 'text', k), paint: { fill: t.muted ? 'text-muted' : 'text' }, x: t.x, y: t.y, text: t.text, font: t.font, ...ownDirection(t.text, ctx.dir, 'middle'), baseline: 'middle' }));
  return [
    { layer: 'series', role: 'marks', items },
    { layer: 'labels', role: 'labels', items: texts },
  ];
}

type Marked = MarkContext<SeriesBase<string, unknown>, 'polar'>['series'];
/** Thresholds and a value over them, edged with the background: told apart without colour (gauge.md 6, 15). */
const EDGED = { stroke: 'background', strokeWidth: 2 } as const;

function arcMarks(a: GaugeArc, onTrack: boolean, s: Marked): Primitive[] {
  const arc = (id: string, fill: ColorToken, inner: number, outer: number, start: number, end: number): ArcPrimitive => ({ kind: 'arc', sceneId: sceneId('s', s.id, id), paint: { fill }, cx: a.cx, cy: a.cy, innerRadius: inner, outerRadius: outer, startAngle: start, endAngle: end });
  const items: Primitive[] = [arc('track', 'track', a.inner, a.radius, a.track[0], a.track[1])];
  // Thresholds side by side, 2 px of background between them: a thin ring outside, or the arc itself.
  const [z0, z1] = onTrack ? [a.inner, a.radius] : [a.radius + RING_GAP, a.radius + RING_GAP + RING];
  a.rings.forEach((r, k) => items.push({ ...arc(`ring-${k}`, r.color, z0, z1, r.start, r.end), paint: { fill: r.color, ...EDGED } }));
  // On the track, the value is narrower, centred, edged with the background: the zones show on both its sides.
  const quarter = (a.radius - a.inner) / 4;
  const [v0, v1] = onTrack ? [a.inner + quarter, a.radius - quarter] : [a.inner, a.radius];
  if (a.fill) {
    const v = arc('value', s.color, v0, v1, a.fill[0], a.fill[1]);
    items.push({ ...v, ...(onTrack ? { paint: { fill: s.color, ...EDGED } } : {}), grows: a.grows, point: { seriesId: s.id, index: 0 } });
  }
  return items;
}

function barMarks(b: GaugeBar, onTrack: boolean, s: Marked): Primitive[] {
  const rect = (id: string, fill: ColorToken, r: Rect): RectPrimitive => ({ kind: 'rect', sceneId: sceneId('s', s.id, id), paint: { fill }, x: r.x, y: r.y, width: r.width, height: r.height });
  const items: Primitive[] = [rect('track', 'track', b.track)];
  b.zones.forEach((z, k) => items.push({ ...rect(`ring-${k}`, z.color, z), paint: { fill: z.color, ...EDGED } }));
  if (b.fill) {
    // On the track, half the thickness, centred (gauge.md 21); it grows from the origin (`free` is its far end).
    const across = b.free === 'x-min' || b.free === 'x-max';
    const q = (across ? b.track.height : b.track.width) / 4;
    const f = !onTrack ? b.fill : across ? { ...b.fill, y: b.fill.y + q, height: b.fill.height - 2 * q } : { ...b.fill, x: b.fill.x + q, width: b.fill.width - 2 * q };
    const v = rect('value', s.color, f);
    items.push({ ...v, ...(onTrack ? { paint: { fill: s.color, ...EDGED } } : {}), roundEnd: b.free, point: { seriesId: s.id, index: 0 } });
  }
  return items;
}

export const gauge: SeriesType<GaugeSeriesOptions, 'polar'> = {
  name: 'gauge',
  system: 'polar',
  sign: 'square',
  optionNames: { min: true, max: true, thresholds: true, origin: true, ticks: true, thresholdsOn: true, shape: true, orientation: true, thickness: true },
  check: (o, path) => {
    const out: Problem[] = [];
    for (const k of ['min', 'max'] as const) if (o[k] !== undefined && !(typeof o[k] === 'number' && Number.isFinite(o[k]))) out.push({ code: 'invalid-option', path: `${path}.${k}` });
    const min = typeof o['min'] === 'number' ? o['min'] : 0;
    const max = typeof o['max'] === 'number' ? o['max'] : 100;
    if (!out.length && min >= max) out.push({ code: 'invalid-option', path: `${path}.min` });
    const list = o['thresholds'];
    if (list !== undefined && !Array.isArray(list)) out.push({ code: 'invalid-option', path: `${path}.thresholds` });
    else if (Array.isArray(list)) list.forEach((t, i) => isThreshold(t) || out.push({ code: 'invalid-option', path: `${path}.thresholds[${i}]` }));
    // The richer gauge (gauge.md 13–15), against the scale drawn (the defaults when the app's is not one).
    const scale = scaleOf(o as Readonly<Record<string, unknown>>);
    const origin = o['origin'];
    if (origin !== undefined && !(typeof origin === 'number' && Number.isFinite(origin) && origin >= scale.min && origin <= scale.max)) out.push({ code: 'invalid-option', path: `${path}.origin` });
    const ticks = o['ticks'] as unknown;
    if (ticks !== undefined) {
      if (typeof ticks !== 'object' || ticks === null || Array.isArray(ticks) || Object.keys(ticks).some((k) => k !== 'step' && k !== 'labels')) out.push({ code: 'invalid-option', path: `${path}.ticks` });
      else {
        const r = ticks as Record<string, unknown>;
        const step = r['step'];
        const fine = typeof step === 'number' && Number.isFinite(step) && step > 0 && tickCount(scale.min, scale.max, step) <= MOST_TICKS;
        if (!fine) out.push({ code: 'invalid-option', path: `${path}.ticks.step` });
        else if (r['labels'] !== undefined && !isMultiple(r['labels'], step)) out.push({ code: 'invalid-option', path: `${path}.ticks.labels` });
      }
    }
    const on = o['thresholdsOn'];
    if (on !== undefined && on !== 'ring' && on !== 'track') out.push({ code: 'invalid-option', path: `${path}.thresholdsOn` });
    // The bar (gauge.md 19, 20).
    const shape = o['shape'];
    if (shape !== undefined && shape !== 'arc' && shape !== 'bar') out.push({ code: 'invalid-option', path: `${path}.shape` });
    const orientation = o['orientation'];
    if (orientation !== undefined && orientation !== 'horizontal' && orientation !== 'vertical') out.push({ code: 'invalid-option', path: `${path}.orientation` });
    if (o['thickness'] !== undefined && !isThickness(o['thickness'])) out.push({ code: 'invalid-option', path: `${path}.thickness` });
    return out;
  },
  readData: readGauge,
  bounds: () => ({ x: null, y: null }),
  place: placeGauge,
  marks: gaugeMarks,
};
