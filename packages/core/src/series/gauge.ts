/**
 * The gauge (gauge.md), a polar type (ADR 0007): one value on a half ring open downwards, filled from the scale's start
 * along the reading direction; its value written in the middle, the scale's ends under the ring's ends, thresholds as
 * a thin ring outside with the value's threshold named under it. No needle (owner 2026-11-21).
 */
import { ownDirection } from '../dir.js';
import type { SeriesBase } from '../options.js';
import type { MarkContext, MarkSet, Placement, PlaceInput, SeriesType } from '../series-type.js';
import type { ColorToken, Primitive, TextPrimitive } from '../scene.js';
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

export interface GaugeSeriesOptions extends SeriesBase<'gauge', number | null | readonly (number | null)[]> {
  /** The scale (gauge.md 1). Default 0 to 100. */
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly thresholds?: readonly GaugeThreshold[] | undefined;
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
const CSS_NAME = /^[a-zA-Z_][\w-]*$/;
const HALF = Math.PI / 2;

/** What a gauge tells beyond its slices: its scale, its value, the threshold it falls in. */
export interface GaugeMeter {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly threshold: string | null;
}

export interface GaugePlacement extends Placement {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly inner: number;
  readonly meter: GaugeMeter;
  readonly track: readonly [number, number];
  readonly fill: readonly [number, number] | null;
  readonly grows: 'start' | 'end';
  readonly rings: readonly { readonly color: ColorToken; readonly start: number; readonly end: number }[];
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

function isThreshold(t: unknown): t is GaugeThreshold {
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return false;
  const r = t as Record<string, unknown>;
  const keys = Object.keys(r).every((k) => k === 'from' || k === 'to' || k === 'label' || k === 'color');
  return keys && typeof r['from'] === 'number' && typeof r['to'] === 'number' && r['from'] < r['to'] && (r['label'] === undefined || typeof r['label'] === 'string') && (r['color'] === undefined || (typeof r['color'] === 'string' && CSS_NAME.test(r['color'])));
}

function placeGauge(input: PlaceInput): GaugePlacement {
  const { series: s, box, measureText, locale, text } = input;
  const o = s.options as unknown as Readonly<Record<string, unknown>>;
  const { min, max } = scaleOf(o);
  const thresholds = thresholdsOf(o);
  const value = s.columns.y[0]!;
  const has = !Number.isNaN(value);
  const name = s.name ?? text.seriesName(s.rank + 1);
  const within = thresholds.find((t) => has && value >= t.from && value <= t.to);
  const tick = measureText('', 'tick-label');
  const lineH = tick.ascent + tick.descent;
  const big = measureText('', 'title');
  const ring = thresholds.length ? RING_GAP + RING : 0;
  // As large as the box allows: twice as wide as high, the scale's ends written under it.
  const below = TEXT_GAP + lineH + (within?.label ? lineH + 2 : 0);
  const radius = Math.max(0, Math.min(box.width / 2 - ring - 2, box.height - below - ring - 2));
  const inner = radius * (1 - THICKNESS);
  const cx = box.x + box.width / 2;
  const cy = box.y + (box.height - (radius + ring + below)) / 2 + radius + ring;
  // Along the reading direction (gauge.md 3): from the left end in left to right, from the right end in right to left.
  const ltr = input.dir === 'ltr';
  const at = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const span = (a: number, b: number): [number, number] => (ltr ? [-HALF + Math.PI * a, -HALF + Math.PI * b] : [HALF - Math.PI * b, HALF - Math.PI * a]);
  const fill = has ? span(0, at(value)) : null;
  const rings = thresholds.map((t) => {
    const [start, end] = span(at(t.from), at(t.to));
    return { color: (t.color ? `color-${t.color}` : 'others') as ColorToken, start, end };
  });
  const texts: GaugePlacement['texts'][number][] = [];
  texts.push({ text: has ? formatValue(value, locale) : '—', font: 'title', x: cx, y: cy - (big.ascent + big.descent) / 2 - 2, muted: false });
  const under = cy + TEXT_GAP + lineH / 2;
  const mid = (radius + inner) / 2;
  const [first, last] = ltr ? [min, max] : [max, min];
  texts.push({ text: formatValue(first, locale), font: 'tick-label', x: cx - mid, y: under, muted: true });
  texts.push({ text: formatValue(last, locale), font: 'tick-label', x: cx + mid, y: under, muted: true });
  if (within?.label) texts.push({ text: within.label, font: 'tick-label', x: cx, y: under + lineH + 2, muted: false });
  const end = fill ? (ltr ? fill[1] : fill[0]) : 0;
  return {
    cx,
    cy,
    radius,
    inner,
    meter: { min, max, value, threshold: within?.label ?? null },
    track: [-HALF, HALF],
    fill,
    grows: ltr ? 'start' : 'end',
    rings,
    texts,
    legend: [],
    needsLegend: false,
    order: has ? [0] : [],
    anchor: (index) => (index === 0 && has ? { x: cx + mid * Math.sin(end), y: cy - mid * Math.cos(end) } : null),
    share: () => Number.NaN,
    members: () => null,
    name: () => name,
  };
}

function gaugeMarks(ctx: MarkContext<SeriesBase<string, unknown>, 'polar'>): MarkSet[] {
  const p = ctx.frame.placement as GaugePlacement;
  const s = ctx.series;
  const arc = (id: string, fill: ColorToken, inner: number, outer: number, start: number, end: number): Primitive => ({ kind: 'arc', sceneId: sceneId('s', s.id, id), paint: { fill }, cx: p.cx, cy: p.cy, innerRadius: inner, outerRadius: outer, startAngle: start, endAngle: end });
  const items: Primitive[] = [arc('track', 'track', p.inner, p.radius, p.track[0], p.track[1])];
  // Thresholds side by side, 2 px of background between them, so they are told apart without colour.
  p.rings.forEach((r, k) => {
    const a = arc(`ring-${k}`, r.color, p.radius + RING_GAP, p.radius + RING_GAP + RING, r.start, r.end);
    items.push({ ...a, paint: { fill: r.color, stroke: 'background', strokeWidth: 2 } });
  });
  if (p.fill) items.push({ ...(arc('value', s.color, p.inner, p.radius, p.fill[0], p.fill[1]) as Extract<Primitive, { kind: 'arc' }>), grows: p.grows, point: { seriesId: s.id, index: 0 } });
  const texts: TextPrimitive[] = p.texts.map((t, k) => ({ kind: 'text', sceneId: sceneId('s', s.id, 'text', k), paint: { fill: t.muted ? 'text-muted' : 'text' }, x: t.x, y: t.y, text: t.text, font: t.font, ...ownDirection(t.text, ctx.dir, 'middle'), baseline: 'middle' }));
  return [
    { layer: 'series', role: 'marks', items },
    { layer: 'labels', role: 'labels', items: texts },
  ];
}

export const gauge: SeriesType<GaugeSeriesOptions, 'polar'> = {
  name: 'gauge',
  system: 'polar',
  sign: 'square',
  optionNames: { min: true, max: true, thresholds: true },
  check: (o, path) => {
    const out: Problem[] = [];
    for (const k of ['min', 'max'] as const) if (o[k] !== undefined && !(typeof o[k] === 'number' && Number.isFinite(o[k]))) out.push({ code: 'invalid-option', path: `${path}.${k}` });
    const min = typeof o['min'] === 'number' ? o['min'] : 0;
    const max = typeof o['max'] === 'number' ? o['max'] : 100;
    if (!out.length && min >= max) out.push({ code: 'invalid-option', path: `${path}.min` });
    const list = o['thresholds'];
    if (list !== undefined && !Array.isArray(list)) out.push({ code: 'invalid-option', path: `${path}.thresholds` });
    else if (Array.isArray(list)) list.forEach((t, i) => isThreshold(t) || out.push({ code: 'invalid-option', path: `${path}.thresholds[${i}]` }));
    return out;
  },
  readData: readGauge,
  bounds: () => ({ x: null, y: null }),
  place: placeGauge,
  marks: gaugeMarks,
};
