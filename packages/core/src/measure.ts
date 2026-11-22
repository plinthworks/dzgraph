/**
 * Measuring between two points (measure.md), lent to the core by the `measure` module (ADR 0006): the difference in
 * value (compared values when the series is compared), in percent of the start, and along x — a duration on a time
 * axis, a count of categories, a signed number otherwise. The words around them are the DOM's (no sentence here).
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { PointRef, Primitive, TextMeasurer } from './scene.js';
import { cachedFormat } from './format.js';
import { pointAt } from './points.js';

export interface MeasureReading {
  readonly value: string;
  /** Null when the start is 0 (no percent of nothing). */
  readonly percent: string | null;
  readonly along: { readonly kind: 'text'; readonly text: string } | { readonly kind: 'categories'; readonly count: number };
}

export interface MeasureKit {
  readonly read: (model: ChartModel, layout: ChartLayout, from: PointRef, to: PointRef, locale: string | undefined) => MeasureReading | null;
  /** The line, its ends and the tag (`label`, written by the DOM's words); null when a point is not there. */
  readonly draw: (model: ChartModel, layout: ChartLayout, from: PointRef, to: PointRef, label: string, measureText: TextMeasurer) => Primitive[] | null;
}

const signed = (v: number, locale: string | undefined) => cachedFormat(locale, 'measure', { maximumSignificantDigits: 6, maximumFractionDigits: 2, roundingPriority: 'morePrecision', signDisplay: 'exceptZero' }).format(v === 0 ? 0 : v);

/** Units of a duration, largest first, with Intl's unit names. */
const UNITS: readonly (readonly [Intl.NumberFormatOptions['unit'] & string, number])[] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1_000],
  ['millisecond', 1],
];

/** A duration in its two largest units (« 1d 4h »), as the locale writes units in short. */
function duration(ms: number, locale: string | undefined): string {
  const sign = ms < 0 ? '-' : '';
  let rest = Math.abs(Math.round(ms));
  const parts: string[] = [];
  for (const [unit, size] of UNITS) {
    const n = Math.floor(rest / size);
    if (n === 0 && !parts.length) continue;
    if (n > 0) parts.push(cachedFormat(locale, `dur|${unit}`, { style: 'unit', unit, unitDisplay: 'narrow' }).format(n));
    rest -= n * size;
    if (parts.length === 2 || (parts.length === 1 && n === 0)) break;
  }
  return sign + (parts.join(' ') || cachedFormat(locale, 'dur|millisecond', { style: 'unit', unit: 'millisecond', unitDisplay: 'narrow' }).format(0));
}

function valueOf(model: ChartModel, layout: ChartLayout, p: PointRef): number {
  const s = model.series.find((o) => o.id === p.seriesId)!;
  const y = layout.stacks.get(s.id)?.top[p.index] ?? s.columns.y[p.index]!;
  const c = layout.compare.series.get(s.id);
  return c ? c.a * y + c.c : y;
}

function read(model: ChartModel, layout: ChartLayout, from: PointRef, to: PointRef, locale: string | undefined): MeasureReading | null {
  const a = model.series.find((o) => o.id === from.seriesId);
  const b = model.series.find((o) => o.id === to.seriesId);
  if (!a || !b || from.index >= a.columns.x.length || to.index >= b.columns.x.length) return null;
  const ya = valueOf(model, layout, from);
  const yb = valueOf(model, layout, to);
  if (Number.isNaN(ya) || Number.isNaN(yb)) return null;
  const percent = ya === 0 ? null : cachedFormat(locale, 'measure|pct', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format((yb - ya) / Math.abs(ya));
  const dx = b.columns.x[to.index]! - a.columns.x[from.index]!;
  const axis = model.xAxes.find((x) => x.id === a.xAxis);
  const along: MeasureReading['along'] = axis?.scale === 'category' ? { kind: 'categories', count: Math.abs(Math.round(dx)) } : { kind: 'text', text: axis?.scale === 'time' ? duration(dx, locale) : signed(dx, locale) };
  return { value: signed(yb - ya, locale), percent, along };
}

/** Between the tag and its text. */
const PAD_X = 6;
const PAD_Y = 3;

function draw(model: ChartModel, layout: ChartLayout, from: PointRef, to: PointRef, label: string, measureText: TextMeasurer): Primitive[] | null {
  const a = pointAt(model, layout, from);
  const b = pointAt(model, layout, to);
  if (!a || !b) return null;
  const { plot } = layout;
  const m = measureText(label, 'tick-label');
  const w = m.width + 2 * PAD_X;
  const h = m.ascent + m.descent + 2 * PAD_Y;
  const cx = (a.x + b.x) / 2;
  // Above the line's middle, kept inside the plot (measure.md 2).
  const bx = Math.max(plot.x, Math.min(plot.x + plot.width - w, cx - w / 2));
  const by = Math.max(plot.y, Math.min(plot.y + plot.height - h, (a.y + b.y) / 2 - h - 6));
  const ring = { fill: 'background' as const, stroke: 'focus' as const, strokeWidth: 2 };
  return [
    { kind: 'line', sceneId: 'measure/line', paint: { stroke: 'focus', strokeWidth: 2 }, x1: a.x, y1: a.y, x2: b.x, y2: b.y },
    { kind: 'marker', sceneId: 'measure/start', paint: ring, x: a.x, y: a.y, size: 8, symbol: 'circle' },
    { kind: 'marker', sceneId: 'measure/end', paint: ring, x: b.x, y: b.y, size: 8, symbol: 'circle' },
    { kind: 'rect', sceneId: 'measure/box', paint: { fill: 'background', stroke: 'focus', strokeWidth: 1 }, x: bx, y: by, width: w, height: h, radius: 4 },
    { kind: 'text', sceneId: 'measure/text', paint: { fill: 'text' }, x: bx + w / 2, y: by + PAD_Y + m.ascent, text: label, font: 'tick-label', anchor: 'middle', baseline: 'alphabetic' },
  ];
}

export const measureKit: MeasureKit = { read, draw };
