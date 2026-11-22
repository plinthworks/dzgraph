/**
 * Pie and donut (pie-donut.md), the first polar types (ADR 0007): slices from the top, clockwise, in data order; the
 * smallest join « Autres »; labels outside with a leader line, or the legend when they do not fit; a donut's hole
 * holds the total. The type places itself (`place`) and draws from its own placement (`marks`).
 */
import type { SeriesBase } from '../options.js';
import type { MarkContext, MarkSet, Placement, PlaceInput, PlacedLegendItem, SeriesModel, SeriesType } from '../series-type.js';
import type { ColorToken, Primitive, TextPrimitive } from '../scene.js';
import type { Problem } from '../problem.js';
import { readXYData } from '../data.js';
import { formatShare, formatValue } from '../format.js';
import { isPointShown } from '../view.js';
import { PathBuilder, sceneId } from './shared.js';

interface PieBase {
  /** Group the smallest slices into « Autres » (pie-donut.md 7). Default `true`. */
  readonly others?: boolean | undefined;
}
export interface PieSeriesOptions extends SeriesBase<'pie', PieData>, PieBase {}
export interface DonutSeriesOptions extends SeriesBase<'donut', PieData>, PieBase {
  /** The hole, as a share of the radius, from 0 to 0.9. Default 0.6 (pie-donut.md 3). */
  readonly hole?: number | undefined;
  /** What the hole says: by default the total and « Total »; `false`: nothing. */
  readonly center?: false | { readonly label?: string | undefined; readonly value?: string | undefined } | undefined;
}

/** Slices: `[['Pommes', 120], …]`, points `{ name, y, key }`, or values alone (named by their place). */
export type PieData = readonly (readonly [string, number | null])[] | readonly { readonly name?: string | undefined; readonly y: number | null; readonly key?: string | undefined }[] | readonly (number | null)[];

declare module '../options.js' {
  interface SeriesOptionsByType {
    pie: PieSeriesOptions;
    donut: DonutSeriesOptions;
  }
}

/** More slices than this and the smallest join « Autres »; so do those under the share below (owner 2026-11-21). */
const MAX_SLICES = 7;
const MIN_SHARE = 0.02;
const HOLE = 0.6;
/** How far a pointed slice comes out (pie-donut.md 12), kept free around the pie. */
const POP = 6;
const FADED = 0.35;
/** A leader line: out from the edge along the slice's middle, then across to its label. */
const LEADER_OUT = 10;
const LEADER_ACROSS = 12;
const LABEL_GAP = 4;
/** Room kept around measured text (spike S2), and between two labels (axes.md 15). */
const LABEL_PAD = 2;
const LABEL_SPACE = 2;

/** One slice as placed: its point (« Autres » is one past the data), its angles, its share and colour. */
interface Slice {
  readonly index: number;
  readonly value: number;
  readonly share: number;
  /** Radians, clockwise from twelve o'clock, start ≤ end. */
  readonly start: number;
  readonly end: number;
  readonly color: ColorToken;
}

interface Label {
  readonly index: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'end';
  /** From the slice's edge, out, then across to the label. */
  readonly leader: readonly (readonly [number, number])[];
}

export interface PiePlacement extends Placement {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly inner: number;
  readonly slices: readonly Slice[];
  readonly labels: readonly Label[];
  readonly center: readonly { readonly text: string; readonly font: 'title' | 'tick-label'; readonly y: number }[];
}

function readPie(data: unknown, path: string, seriesId: string) {
  const raw = readXYData(data, path, seriesId);
  const n = raw.count;
  // A pair's first item is the slice's name; a point's `name` is read by the data reader.
  const texts = raw.x.kind === 'values' ? raw.x.texts : null;
  const names = texts && texts.some((t) => t !== null) ? texts : raw.names;
  const y = raw.y.slice();
  // A part of a whole cannot be negative (pie-donut.md 4).
  let first = -1;
  let count = 0;
  for (let i = 0; i < n; i++) if (y[i]! < 0) {
    if (count++ === 0) first = i;
    y[i] = Number.NaN;
  }
  const problems: Problem[] = [...raw.problems];
  if (count) problems.push({ code: 'invalid-data', path: `${path}[${first}]`, seriesId, detail: `count=${count}` });
  return { columns: { x: Float64Array.from({ length: n }, (_, i) => i), y }, keys: raw.keys, names, problems };
}

/** The slices shown, « Autres » last, and their angles (pie-donut.md 2, 4, 6, 7). */
function slicesOf(s: SeriesModel, view: PlaceInput['view'], group: boolean, anticlockwise: boolean): { slices: Slice[]; members: number[]; total: number } {
  const y = s.columns.y;
  const shown: number[] = [];
  for (let i = 0; i < y.length; i++) if (y[i]! > 0 && isPointShown(s.id, i, view)) shown.push(i);
  const total = shown.reduce((a, i) => a + y[i]!, 0);
  let kept = shown;
  let members: number[] = [];
  if (group && total > 0) {
    const bySize = [...shown].sort((a, b) => y[b]! - y[a]! || a - b);
    const out = new Set(bySize.length > MAX_SLICES ? bySize.slice(MAX_SLICES - 1) : []);
    for (const i of shown) if (y[i]! / total < MIN_SHARE) out.add(i);
    // A group of one is not made: that slice stays itself.
    if (out.size >= 2) {
      members = shown.filter((i) => out.has(i));
      kept = shown.filter((i) => !out.has(i));
    }
  }
  const parts: { index: number; value: number; color: ColorToken }[] = kept.map((i) => ({ index: i, value: y[i]!, color: sliceColor(i) }));
  if (members.length) parts.push({ index: y.length, value: members.reduce((a, i) => a + y[i]!, 0), color: 'others' });
  const slices: Slice[] = [];
  let at = 0;
  for (const p of parts) {
    const sweep = total > 0 ? (p.value / total) * 2 * Math.PI : 0;
    const [start, end] = anticlockwise ? [2 * Math.PI - at - sweep, 2 * Math.PI - at] : [at, at + sweep];
    slices.push({ index: p.index, value: p.value, share: total > 0 ? p.value / total : Number.NaN, start, end, color: p.color });
    at += sweep;
  }
  return { slices, members, total };
}

/**
 * A slice's colour: the palette by its place in the data (pie-donut.md 6), so hiding a slice repaints no other; past
 * the palette's eight colours, from the start again (as series do).
 */
const sliceColor = (i: number): ColorToken => `series-${(i % PALETTE_SIZE) + 1}`;
const PALETTE_SIZE = 8;

/** A point on the circle of radius `r` at an angle clockwise from twelve o'clock. */
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

/**
 * Labels in two columns beside the pie, each at its slice's middle height, moved apart so none overlaps; null when a
 * column cannot hold its labels in the height.
 */
function placeLabels(slices: readonly Slice[], texts: ReadonlyMap<number, string>, cx: number, cy: number, r: number, box: PlaceInput['box'], lineH: number, dir: 'ltr' | 'rtl'): Label[] | null {
  const out: Label[] = [];
  for (const side of [1, -1] as const) {
    const col = slices
      .map((s) => ({ s, mid: (s.start + s.end) / 2 }))
      .filter(({ mid }) => (Math.sin(mid) >= 0 ? 1 : -1) === side)
      .map(({ s, mid }) => {
        const [ex, ey] = polar(cx, cy, r, mid);
        const [ox, oy] = polar(cx, cy, r + LEADER_OUT, mid);
        return { s, ex, ey, ox, oy, y: oy };
      })
      .sort((a, b) => a.oy - b.oy);
    const step = lineH + LABEL_SPACE;
    const top = box.y + lineH / 2;
    const bottom = box.y + box.height - lineH / 2;
    if (col.length && (col.length - 1) * step > bottom - top) return null;
    // Down from the top, then back up from the bottom: each label at least a line from the one before it.
    for (let k = 0; k < col.length; k++) col[k]!.y = Math.max(col[k]!.y, k ? col[k - 1]!.y + step : top);
    for (let k = col.length - 1; k >= 0; k--) col[k]!.y = Math.min(col[k]!.y, k < col.length - 1 ? col[k + 1]!.y - step : bottom);
    const x = cx + side * (r + LEADER_OUT + LEADER_ACROSS);
    // The label's text runs away from the pie: its start on the pie's side in left to right, its end in right to left.
    const anchor: 'start' | 'end' = (side === 1) === (dir === 'ltr') ? 'start' : 'end';
    for (const c of col) out.push({ index: c.s.index, text: texts.get(c.s.index)!, x: x + side * LABEL_GAP, y: c.y, anchor, leader: [[c.ex, c.ey], [c.ox, c.oy], [x, c.y]] });
  }
  return out.sort((a, b) => slices.findIndex((s) => s.index === a.index) - slices.findIndex((s) => s.index === b.index));
}

function placePie(input: PlaceInput, hole: number, group: boolean, center: DonutSeriesOptions['center'] | null): PiePlacement {
  const { series: s, box, view, text, measureText, locale } = input;
  const names = (i: number) => (i === s.columns.y.length ? text.others : (s.names?.[i] ?? text.pointName(i + 1)));
  const anticlockwise = input.mirror && input.dir === 'rtl';
  const { slices, members, total } = slicesOf(s, view, group, anticlockwise);
  const texts = new Map(slices.map((sl) => [sl.index, text.sliceLabel(names(sl.index), formatShare(sl.share, locale))]));
  const m = measureText('', 'data-label');
  const lineH = m.ascent + m.descent;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const whole = Math.max(0, Math.min(box.width, box.height) / 2 - POP);
  let radius = whole;
  let labels: Label[] = [];
  let needsLegend = false;
  if (input.labels && slices.length) {
    // The pie shrinks to make room for the widest label on each side, down to a third of the smaller side.
    const widest = Math.max(...[...texts.values()].map((t) => measureText(t, 'data-label').width)) + LABEL_PAD;
    const fit = Math.min(whole, box.width / 2 - LEADER_OUT - LEADER_ACROSS - LABEL_GAP - widest - LABEL_PAD);
    const placed = fit >= Math.min(box.width, box.height) / 6 ? placeLabels(slices, texts, cx, cy, fit, box, lineH, input.dir) : null;
    if (placed) {
      radius = fit;
      labels = placed;
    } else needsLegend = true;
  }
  const inner = radius * hole;
  // A donut's centre: the total and « Total », or the app's words (pie-donut.md 3).
  const words: { text: string; font: 'title' | 'tick-label'; y: number }[] = [];
  if (hole > 0 && center !== false && slices.length) {
    const value = center?.value ?? formatValue(total, locale);
    const label = center?.label ?? text.total;
    const vm = measureText(value, 'title');
    const lm = measureText(label, 'tick-label');
    const h = vm.ascent + vm.descent + 2 + lm.ascent + lm.descent;
    words.push({ text: value, font: 'title', y: cy - h / 2 + (vm.ascent + vm.descent) / 2 });
    words.push({ text: label, font: 'tick-label', y: cy + h / 2 - (lm.ascent + lm.descent) / 2 });
  }
  const byIndex = new Map(slices.map((sl) => [sl.index, sl]));
  const legend: PlacedLegendItem[] = [];
  const y = s.columns.y;
  for (let i = 0; i < y.length; i++) {
    if (!(y[i]! > 0)) continue;
    legend.push({ index: i, name: names(i), color: sliceColor(i), hidden: !isPointShown(s.id, i, view) });
  }
  return {
    cx,
    cy,
    radius,
    inner,
    slices,
    labels,
    center: words,
    legend,
    needsLegend,
    order: slices.map((sl) => sl.index),
    anchor(index) {
      const sl = byIndex.get(index);
      if (!sl) return null;
      // Halfway through the ring (a pie's: halfway out), on the slice's middle.
      const [x, ay] = polar(cx, cy, (radius + inner) / 2, (sl.start + sl.end) / 2);
      return { x, y: ay };
    },
    share: (index) => byIndex.get(index)?.share ?? Number.NaN,
    members: (index) => (index === y.length && members.length ? members : null),
    name: names,
  };
}

function pieMarks(ctx: MarkContext<SeriesBase<string, unknown>, 'polar'>): MarkSet[] {
  const p = ctx.frame.placement as PiePlacement;
  const s = ctx.series;
  const arcs: Primitive[] = p.slices.map((sl) => {
    // Pointed at: brought out along its middle; the others fade (pie-donut.md 12).
    const lit = ctx.highlight === sl.index;
    const mid = (sl.start + sl.end) / 2;
    const [dx, dy] = lit ? [POP * Math.sin(mid), -POP * Math.cos(mid)] : [0, 0];
    const faded = ctx.highlight !== null && !lit;
    return {
      kind: 'arc',
      sceneId: sceneId('s', s.id, 'slice', sl.index),
      paint: { fill: sl.color, stroke: 'background', strokeWidth: 2, ...(faded ? { opacity: FADED } : {}) },
      cx: p.cx + dx,
      cy: p.cy + dy,
      innerRadius: p.inner,
      outerRadius: p.radius,
      startAngle: sl.start,
      endAngle: sl.end,
      point: { seriesId: s.id, index: sl.index },
    };
  });
  const out: MarkSet[] = [];
  if (arcs.length) out.push({ layer: 'series', role: 'marks', items: arcs });
  const leaders: Primitive[] = p.labels.map((l) => {
    const b = new PathBuilder();
    l.leader.forEach(([x, y], k) => (k ? b.lineTo(x, y) : b.moveTo(x, y)));
    return { kind: 'path', sceneId: sceneId('s', s.id, 'leader', l.index), paint: { stroke: 'text-muted', strokeWidth: 1 }, path: b.build() };
  });
  const texts: TextPrimitive[] = p.labels.map((l) => ({ kind: 'text', sceneId: sceneId('s', s.id, 'label', l.index), paint: { fill: 'text' }, x: l.x, y: l.y, text: l.text, font: 'data-label', anchor: l.anchor, baseline: 'middle', dir: ctx.dir }));
  const centre: TextPrimitive[] = p.center.map((c, k) => ({ kind: 'text', sceneId: sceneId('s', s.id, 'center', k), paint: { fill: k ? 'text-muted' : 'text' }, x: p.cx, y: c.y, text: c.text, font: c.font, anchor: 'middle', baseline: 'middle', dir: ctx.dir }));
  if (leaders.length) out.push({ layer: 'labels', role: 'path', items: leaders });
  if (texts.length || centre.length) out.push({ layer: 'labels', role: 'labels', items: [...texts, ...centre] });
  return out;
}

const checkBool = (o: Readonly<Record<string, unknown>>, k: string, path: string): Problem[] => (o[k] === undefined || typeof o[k] === 'boolean' ? [] : [{ code: 'invalid-option', path: `${path}.${k}` }]);

export const pie: SeriesType<PieSeriesOptions, 'polar'> = {
  name: 'pie',
  system: 'polar',
  sign: 'square',
  optionNames: { others: true },
  check: (o, path) => checkBool(o, 'others', path),
  readData: readPie,
  bounds: () => ({ x: null, y: null }),
  place: (input) => placePie(input, 0, (input.series.options as PieSeriesOptions).others !== false, null),
  marks: pieMarks,
};

export const donut: SeriesType<DonutSeriesOptions, 'polar'> = {
  name: 'donut',
  system: 'polar',
  sign: 'square',
  optionNames: { others: true, hole: true, center: true },
  check: (o, path) => {
    const out = checkBool(o, 'others', path);
    const h = o['hole'];
    if (h !== undefined && !(typeof h === 'number' && h >= 0 && h <= 0.9)) out.push({ code: 'invalid-option', path: `${path}.hole` });
    const c = o['center'];
    const ok = c === undefined || c === false || (typeof c === 'object' && c !== null && !Array.isArray(c) && Object.entries(c).every(([k, v]) => (k === 'label' || k === 'value') && (v === undefined || typeof v === 'string')));
    if (!ok) out.push({ code: 'invalid-option', path: `${path}.center` });
    return out;
  },
  readData: readPie,
  bounds: () => ({ x: null, y: null }),
  place: (input) => {
    const o = input.series.options as DonutSeriesOptions;
    const hole = typeof o.hole === 'number' && o.hole >= 0 && o.hole <= 0.9 ? o.hole : HOLE;
    const c = o.center;
    const center = c === false || (typeof c === 'object' && c !== null) ? c : undefined;
    return placePie(input, hole, o.others !== false, center);
  },
  marks: pieMarks,
};
