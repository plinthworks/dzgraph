/**
 * Layout (layout.md, axes.md, legend.md, direction.md): where the title, the legend, the axes and the plot area go,
 * the axes' scales and ticks, every label measured and placed. Pure: the text is measured by the function given, the
 * translated words are given. Physical sides only through dir.ts.
 *
 * The axes depend on each other (a y axis's width on its labels, its labels on its ticks, its ticks on the plot's
 * height, the plot's height on the x axis's labels…): the sizes are settled by a few passes until they stop changing.
 */
import type { FontRole, Rect, TextMeasurer } from './scene.js';
import type { Problem } from './problem.js';
import type { Formatter } from './options.js';
import type { InstantMs } from './time.js';
import type { Scale, SeriesModel, SeriesType } from './series-type.js';
import type { AxisModel, ChartModel } from './model.js';
import { edgeX, sideOf, type Dir, type XSide } from './dir.js';
import { categoryScale, linearScale } from './scale.js';
import { alignedTicks, numericTicks, tickTarget, type Ticks } from './ticks.js';
import { formatTicks } from './format.js';
import { isShown, type View } from './view.js';

/** The words layout writes, translated by the DOM layer. */
export interface LayoutText {
  /** A series without a name: « Série 1 »… (`place` counts from 1). */
  seriesName(place: number): string;
  noData: string;
  ellipsis: string;
}

export interface LayoutInput {
  readonly model: ChartModel;
  readonly types: readonly SeriesType[];
  readonly width: number;
  readonly height: number;
  /** Resolved by the DOM layer: the model's `dir`, else the element's. */
  readonly dir: Dir;
  readonly measureText: TextMeasurer;
  readonly text: LayoutText;
  readonly locale: string | undefined;
  /** What the user changed (hidden series…); absent: the options' starting state. */
  readonly view?: View;
}

export interface PlacedText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: FontRole;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly baseline: 'top' | 'middle' | 'alphabetic' | 'bottom';
  readonly rotate?: number;
  readonly dir: Dir;
}

export interface TickLayout {
  readonly value: number;
  /** Position along the axis, in pixels (x for an axis across, y for an upright one). */
  readonly at: number;
  /** Null when the label is skipped (too many to show) or there is no data. */
  readonly label: PlacedText | null;
}

export interface AxisLayout {
  readonly id: string;
  /** Which of the chart's two dimensions it measures (GLOSSARY: Axis). */
  readonly dimension: 'x' | 'y';
  /** The plot's edge it sits on. */
  readonly edge: 'bottom' | 'top' | XSide;
  readonly scale: Scale;
  readonly ticks: readonly TickLayout[];
  /** Gridlines across the plot from its ticks. */
  readonly grid: boolean;
  readonly title: PlacedText | null;
}

export interface LegendItemLayout {
  readonly seriesId: string;
  readonly sign: Rect;
  readonly label: PlacedText;
  readonly hidden: boolean;
}

export interface ChartLayout {
  readonly width: number;
  readonly height: number;
  readonly dir: Dir;
  readonly plot: Rect;
  /** The title's lines (at most two). */
  readonly title: readonly PlacedText[];
  readonly subtitle: PlacedText | null;
  readonly axes: readonly AxisLayout[];
  readonly legend: { readonly box: Rect; readonly items: readonly LegendItemLayout[] } | null;
  readonly noData: PlacedText | null;
  readonly problems: readonly Problem[];
}

// Spacing, in CSS pixels (layout.md, legend.md).
const MARGIN = 8;
const TITLE_GAP = 8;
const SUBTITLE_GAP = 2;
const LEGEND_GAP = 12;
const SIGN_WIDTH = 16;
const SIGN_HEIGHT = 12;
const SIGN_GAP = 6;
const ITEM_GAP = 16;
const ROW_GAP = 6;
const TICK = 5;
const LABEL_GAP = 3;
const AXIS_TITLE_GAP = 6;
/** Room kept around measured text (spike S2: WebKit draws SVG text up to 1.8 px wider than measured). */
const LABEL_PAD = 2;
/** The least space between two labels' boxes (axes.md 15). */
const LABEL_SPACE = 2;
const SIN45 = Math.SQRT1_2;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;
/** The plot keeps at least this share of the chart (layout.md 4). */
const MIN_PLOT_SHARE = 0.4;

/** Lays the chart out. */
export function layout(input: LayoutInput): ChartLayout {
  const { width: W, height: H, dir } = input;
  if (W < MIN_WIDTH || H < MIN_HEIGHT) {
    // Too small for axes (layout.md 5): the plot alone.
    return { width: W, height: H, dir, plot: { x: MARGIN, y: MARGIN, width: Math.max(0, W - 2 * MARGIN), height: Math.max(0, H - 2 * MARGIN) }, title: [], subtitle: null, axes: [], legend: null, noData: null, problems: [] };
  }
  // Give way, in order, until the plot keeps its share (layout.md 4): axis titles, the legend, the title, then the
  // labels of the second axes, then every label (the ticks stay).
  const attempts: Options[] = [
    { axisTitles: true, legend: true, title: true, labels: 'all' },
    { axisTitles: false, legend: true, title: true, labels: 'all' },
    { axisTitles: false, legend: false, title: true, labels: 'all' },
    { axisTitles: false, legend: false, title: false, labels: 'all' },
    { axisTitles: false, legend: false, title: false, labels: 'primary' },
    { axisTitles: false, legend: false, title: false, labels: 'none' },
  ];
  let result: ChartLayout | null = null;
  for (const a of attempts) {
    result = attempt(input, a);
    if (result.plot.height >= MIN_PLOT_SHARE * H && result.plot.width >= MIN_PLOT_SHARE * W) break;
  }
  return result!;
}

interface Options {
  readonly axisTitles: boolean;
  readonly legend: boolean;
  readonly title: boolean;
  /** Which axes show labels: all, the first of each kind only, none. */
  readonly labels: 'all' | 'primary' | 'none';
}

function attempt(input: LayoutInput, opts: Options): ChartLayout {
  const { model, width: W, height: H, dir, measureText, text } = input;
  const lineHeight = (font: FontRole) => {
    const m = measureText('', font);
    return m.ascent + m.descent;
  };
  const widthOf = (s: string, font: FontRole) => measureText(s, font).width;
  const ellipsize = (s: string, max: number, font: FontRole, force = false) => fit(s, max, font, widthOf, text.ellipsis, force);
  const inner: Rect = { x: MARGIN, y: MARGIN, width: W - 2 * MARGIN, height: H - 2 * MARGIN };
  let top = inner.y;
  let bottom = inner.y + inner.height;
  let minX = inner.x;
  let maxX = inner.x + inner.width;

  // Title and subtitle (layout.md 3).
  const title: PlacedText[] = [];
  let subtitle: PlacedText | null = null;
  if (opts.title && model.title) {
    const align = model.title.align;
    const anchorX = align === 'center' ? inner.x + inner.width / 2 : edgeX(inner, dir, align);
    const anchorOf = align === 'center' ? 'middle' : align;
    const th = lineHeight('title');
    for (const line of wrap(model.title.text, inner.width, 2, widthOf, ellipsize)) {
      title.push({ text: line, x: anchorX, y: top, font: 'title', anchor: anchorOf, baseline: 'top', dir });
      top += th;
    }
    if (model.title.subtitle) {
      top += SUBTITLE_GAP;
      subtitle = { text: ellipsize(model.title.subtitle, inner.width, 'subtitle'), x: anchorX, y: top, font: 'subtitle', anchor: anchorOf, baseline: 'top', dir };
      top += lineHeight('subtitle');
    }
    top += TITLE_GAP;
  }

  // Legend (legend.md): its room, before the axes.
  let legend: ChartLayout['legend'] = null;
  if (opts.legend && model.legend && model.series.length > 0) {
    const side = model.legend.position === 'start' || model.legend.position === 'end';
    const xAxisGuess = TICK + LABEL_GAP + lineHeight('tick-label');
    const budget = side ? bottom - top : Math.min(H / 3, bottom - top - MIN_PLOT_SHARE * H - xAxisGuess - LEGEND_GAP);
    const placed = placeLegend(input, side ? Math.min(inner.width / 4, inner.width) : inner.width, budget, side, widthOf, lineHeight('legend'), ellipsize);
    if (placed) {
      const { rows, boxWidth, boxHeight } = placed;
      let bx: number;
      let by: number;
      if (side) {
        const s = sideOf(dir, model.legend.position as 'start' | 'end');
        bx = s === 'x-min' ? minX : maxX - boxWidth;
        by = top;
        if (s === 'x-min') minX += boxWidth + LEGEND_GAP;
        else maxX -= boxWidth + LEGEND_GAP;
      } else if (model.legend.position === 'top') {
        bx = inner.x;
        by = top;
        top += boxHeight + LEGEND_GAP;
      } else {
        bx = inner.x;
        by = bottom - boxHeight;
        bottom = by - LEGEND_GAP;
      }
      legend = arrangeLegend(rows, { x: bx, y: by, width: side ? boxWidth : inner.width, height: boxHeight }, model.legend.align, dir);
    }
  }

  // Axes: settled in passes (sizes depend on each other).
  const problems: Problem[] = [];
  // No value to show: no series, or only gaps (axes.md 6, review 14b).
  const empty = model.series.every((s) => !s.columns.y.some((v) => !Number.isNaN(v)));
  const axes = settleAxes(input, { top, bottom, minX, maxX }, opts, empty, problems);

  const noData = empty ? { text: text.noData, x: axes.plot.x + axes.plot.width / 2, y: axes.plot.y + axes.plot.height / 2, font: 'tick-label' as const, anchor: 'middle' as const, baseline: 'middle' as const, dir } : null;
  return { width: W, height: H, dir, plot: axes.plot, title, subtitle, axes: axes.layouts, legend, noData, problems };
}

/** Shortens `s` with an ellipsis to fit `max` px; `force` adds the ellipsis even if it fits (a cut list). */
function fit(s: string, max: number, font: FontRole, widthOf: (s: string, f: FontRole) => number, ellipsis: string, force: boolean): string {
  if (!force && widthOf(s, font) <= max) return s;
  const chars = [...s];
  let lo = 0;
  let hi = force ? chars.length : chars.length - 1;
  // The longest prefix that fits with the ellipsis.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (widthOf(chars.slice(0, mid).join('') + ellipsis, font) <= max) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('').trimEnd() + ellipsis;
}

/** Words onto at most `lines` lines of `max` px; the last one ends with an ellipsis if text remains. */
function wrap(s: string, max: number, lines: number, widthOf: (s: string, f: FontRole) => number, ellipsize: (s: string, max: number, f: FontRole) => string): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (widthOf(next, 'title') <= max || !line) {
      line = next;
      continue;
    }
    if (out.length === lines - 1) {
      out.push(ellipsize(`${line} ${words.slice(i).join(' ')}`, max, 'title'));
      return out;
    }
    out.push(line);
    line = words[i]!;
  }
  if (line) out.push(line);
  // Any line still too wide (a single long word) ends with « … » too (review 11).
  return out.slice(0, lines).map((l) => ellipsize(l, max, 'title'));
}

interface LegendEntry {
  readonly seriesId: string;
  readonly text: string;
  readonly width: number;
  readonly hidden: boolean;
}

/** The legend's rows that fit `budget` px of height, or null when not even one does. */
function placeLegend(
  input: LayoutInput,
  maxWidth: number,
  budget: number,
  side: boolean,
  widthOf: (s: string, f: FontRole) => number,
  lineH: number,
  ellipsize: (s: string, max: number, f: FontRole, force?: boolean) => string,
): { rows: LegendEntry[][]; boxWidth: number; boxHeight: number } | null {
  const rowH = Math.max(lineH, SIGN_HEIGHT);
  const labelMax = maxWidth - SIGN_WIDTH - SIGN_GAP;
  const entries: LegendEntry[] = input.model.series.map((s) => {
    const name = ellipsize(s.name ?? input.text.seriesName(s.rank + 1), labelMax, 'legend');
    return { seriesId: s.id, text: name, width: SIGN_WIDTH + SIGN_GAP + widthOf(name, 'legend'), hidden: !isShown(s, input.view) };
  });
  const rows: LegendEntry[][] = [];
  if (side) for (const e of entries) rows.push([e]);
  else {
    let row: LegendEntry[] = [];
    let w = 0;
    for (const e of entries) {
      const add = row.length ? ITEM_GAP + e.width : e.width;
      if (row.length && w + add > maxWidth) {
        rows.push(row);
        row = [e];
        w = e.width;
      } else {
        row.push(e);
        w += add;
      }
    }
    if (row.length) rows.push(row);
  }
  const fits = Math.floor((budget + ROW_GAP) / (rowH + ROW_GAP));
  if (fits < 1) return null;
  if (rows.length > fits) {
    rows.length = fits;
    // The last visible item ends with « … »: more items exist (legend.md 5).
    const last = rows[fits - 1]!;
    const e = last[last.length - 1]!;
    const label = ellipsize(e.text, widthOf(e.text, 'legend'), 'legend', true);
    last[last.length - 1] = { ...e, text: label, width: SIGN_WIDTH + SIGN_GAP + widthOf(label, 'legend') };
  }
  const rowWidth = (r: LegendEntry[]) => r.reduce((a, e, i) => a + e.width + (i ? ITEM_GAP : 0), 0);
  return { rows, boxWidth: Math.max(...rows.map(rowWidth)), boxHeight: rows.length * rowH + (rows.length - 1) * ROW_GAP };
}

/** Places the rows inside the legend's area: each row aligned, items from the start of the reading direction. */
function arrangeLegend(rows: LegendEntry[][], area: Rect, align: 'start' | 'center' | 'end', dir: Dir): NonNullable<ChartLayout['legend']> {
  const rowH = rows.length ? (area.height - (rows.length - 1) * ROW_GAP) / rows.length : 0;
  const items: LegendItemLayout[] = [];
  let minX = Infinity;
  let maxW = 0;
  rows.forEach((row, r) => {
    const w = row.reduce((a, e, i) => a + e.width + (i ? ITEM_GAP : 0), 0);
    const x0 = align === 'center' ? area.x + (area.width - w) / 2 : sideOf(dir, align) === 'x-min' ? area.x : area.x + area.width - w;
    minX = Math.min(minX, x0);
    maxW = Math.max(maxW, w);
    const y = area.y + r * (rowH + ROW_GAP);
    let offset = 0;
    for (const e of row) {
      // The item's box [ix, ix + width], counted from the row's start side.
      const ix = dir === 'ltr' ? x0 + offset : x0 + w - offset - e.width;
      const signX = dir === 'ltr' ? ix : ix + e.width - SIGN_WIDTH;
      const labelX = dir === 'ltr' ? signX + SIGN_WIDTH + SIGN_GAP : signX - SIGN_GAP;
      items.push({
        seriesId: e.seriesId,
        sign: { x: signX, y: y + (rowH - SIGN_HEIGHT) / 2, width: SIGN_WIDTH, height: SIGN_HEIGHT },
        label: { text: e.text, x: labelX, y: y + rowH / 2, font: 'legend', anchor: 'start', baseline: 'middle', dir },
        hidden: e.hidden,
      });
      offset += e.width + ITEM_GAP;
    }
  });
  return { box: { x: minX, y: area.y, width: maxW, height: area.height }, items };
}

/** An axis as the passes see it. */
interface AxisPlan {
  readonly model: AxisModel;
  readonly dimension: 'x' | 'y';
  /** Its index in the options (`xAxis[i]`), for problems. */
  readonly index: number;
  readonly edge: 'bottom' | 'top' | XSide;
  /** Whether it runs across the screen (its ticks along x). */
  readonly across: boolean;
  readonly data: { min: number; max: number } | null;
  readonly round: boolean;
  /** The first value axis of its kind: the others align to it and draw no gridlines (axes.md 9). */
  readonly primary: boolean;
}

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly minX: number;
  readonly maxX: number;
}

function settleAxes(input: LayoutInput, box: Box, opts: Options, empty: boolean, problems: Problem[]): { plot: Rect; layouts: AxisLayout[] } {
  const { model, dir } = input;
  const horizontal = model.orientation === 'horizontal';
  const visible = model.series.filter((s) => isShown(s, input.view));
  const typeOf = new Map(input.types.map((t) => [t.name as string, t]));
  const boundsOf = (s: SeriesModel) => typeOf.get(s.type)?.bounds(s) ?? { x: null, y: null };

  const plans: AxisPlan[] = [];
  const plan = (kind: 'x' | 'y', axes: readonly AxisModel[]) =>
    axes.forEach((a, index) => {
      // x runs across in columns, upright in bars; y the other way.
      const across = (kind === 'x') !== horizontal;
      const edge = across ? (a.opposite ? 'top' : 'bottom') : sideOf(dir, a.opposite ? 'end' : 'start');
      let min = Infinity;
      let max = -Infinity;
      let round = kind === 'y';
      for (const s of visible) {
        if ((kind === 'x' ? s.xAxis : s.yAxis) !== a.id) continue;
        const b = boundsOf(s)[kind];
        if (b) {
          min = Math.min(min, b.min);
          max = Math.max(max, b.max);
        }
        if (kind === 'x' && typeOf.get(s.type)?.roundX) round = true;
      }
      plans.push({ model: a, dimension: kind, index, edge, across, data: min <= max ? { min, max } : null, round, primary: index === 0 });
    });
  plan('x', model.xAxes);
  plan('y', model.yAxes);

  // Sizes start from a guess and are recomputed until they settle.
  const size = new Map<AxisPlan, number>();
  const m = input.measureText('', 'tick-label');
  for (const p of plans) size.set(p, p.across ? TICK + LABEL_GAP + m.ascent + m.descent : 0);
  let plot: Rect = { x: 0, y: 0, width: 0, height: 0 };
  let layouts: AxisLayout[] = [];
  /** Room kept at x-min for turned labels, grown pass by pass until the first one fits. */
  let inset = 0;
  for (let pass = 0; pass < 8; pass++) {
    plot = plotRect({ ...box, minX: box.minX + inset }, plans, size);
    const reported: Problem[] = [];
    const out = layoutAxes(input, plans, plot, opts, empty, reported);
    layouts = out.layouts;
    let changed = false;
    if (out.overhang > 0.25) {
      inset += out.overhang;
      changed = true;
    }
    for (const p of plans) {
      const s = out.sizes.get(p)!;
      if (s !== size.get(p)) changed = true;
      size.set(p, s);
    }
    if (!changed) {
      problems.push(...reported);
      break;
    }
    if (pass === 7) problems.push(...reported);
  }
  return { plot, layouts };
}

function plotRect(box: Box, plans: readonly AxisPlan[], size: Map<AxisPlan, number>): Rect {
  let { top, bottom, minX, maxX } = box;
  for (const p of plans) {
    const s = size.get(p) ?? 0;
    if (p.edge === 'bottom') bottom -= s;
    else if (p.edge === 'top') top += s;
    else if (p.edge === 'x-min') minX += s;
    else maxX -= s;
  }
  // Never outside the chart's box, even when the axes ask for more room than there is.
  const x = Math.round(Math.min(minX, box.maxX));
  const y = Math.round(Math.min(top, box.bottom));
  return { x, y, width: Math.max(0, Math.round(Math.max(maxX, minX)) - x), height: Math.max(0, Math.round(Math.max(bottom, top)) - y) };
}

/** Lays every axis out for this plot rectangle; returns the room each needs. */
function layoutAxes(input: LayoutInput, plans: readonly AxisPlan[], plot: Rect, opts: Options, empty: boolean, problems: Problem[]) {
  const titles = opts.axisTitles;
  const { model, dir, measureText, locale } = input;
  const lh = (f: FontRole) => {
    const m = measureText('', f);
    return m.ascent + m.descent;
  };
  const widthOf = (s: string, f: FontRole) => measureText(s, f).width;
  const sizes = new Map<AxisPlan, number>();
  const layouts: AxisLayout[] = [];
  /** How far a turned label still reaches past the chart's x-min edge. */
  let overhang = 0;
  /** The first y axis's ticks: the second ones sit on its gridlines (axes.md 9). */
  let primaryTicks: Ticks | null = null;

  for (const p of plans) {
    const a = p.model;
    const length = p.across ? plot.width : plot.height;
    // Ranges on screen (direction.md 3–4): across, x runs left to right unless mirrored in RTL, and values (bars)
    // grow from the start; upright, values grow upwards and categories (bars) run down from the top.
    let range: [number, number];
    if (p.across) {
      const fromStart = p.dimension === 'y' ? true : dir === 'rtl' && model.mirror;
      range = fromStart && dir === 'rtl' ? [plot.x + plot.width, plot.x] : [plot.x, plot.x + plot.width];
    } else range = p.dimension === 'x' ? [plot.y, plot.y + plot.height] : [plot.y + plot.height, plot.y];
    if (a.reversed) range = [range[1], range[0]];

    const labelFont: FontRole = 'tick-label';
    const LH = lh(labelFont);
    const path = `${p.dimension}Axis[${p.index}].ticks.format`;
    let scale: Scale;
    let ticks: { value: number; text: string | null }[] = [];

    if (a.scale === 'category') {
      const cats = a.categories ?? [];
      scale = categoryScale(cats.length, range);
      const format = safeFormat(a.ticks.format as Formatter<string> | null, path, problems, locale, 1);
      ticks = cats.map((c, i) => ({ value: i, text: format ? format(c) : c }));
    } else {
      // A bound the app gives is kept; one on the wrong side of the data is reported and left out (axes.md 4).
      let min = a.min;
      let max = a.max;
      const where = `${p.dimension}Axis[${p.index}]`;
      if (p.data && min !== null && max === null && min >= p.data.max) {
        problems.push({ code: 'invalid-option', path: `${where}.min` });
        min = null;
      }
      if (p.data && max !== null && min === null && max <= p.data.min) {
        problems.push({ code: 'invalid-option', path: `${where}.max` });
        max = null;
      }
      const lo = min ?? p.data?.min ?? 0;
      const hi = max ?? p.data?.max ?? 1;
      const both = min !== null && max !== null;
      let target = a.ticks.target ?? tickTarget(length, p.across ? 'across' : 'upright');
      let t: Ticks;
      // Fewer ticks while their labels overlap (axes.md 14).
      for (;;) {
        if (!p.primary && p.dimension === 'y' && primaryTicks && !both) t = alignTo(primaryTicks, lo, hi);
        else if (both || !p.round) t = numericTicks(lo, hi, target, 'inside');
        else {
          // Rounded outwards, then the bound the app gave put back exactly; ticks past it dropped (review 7).
          const r = numericTicks(lo, hi, target, 'loose');
          const tmin = min ?? r.min;
          const tmax = max ?? r.max;
          t = { min: tmin, max: tmax, step: r.step, values: r.values.filter((v) => v >= tmin - 1e-9 * r.step && v <= tmax + 1e-9 * r.step) };
        }
        const texts = numberLabels(t, a, path, problems, locale);
        const fits = p.across ? acrossFits(t.values.map((v) => scaleAt(t, range, v)), texts, widthOf, labelFont) : uprightFits(t.values.map((v) => scaleAt(t, range, v)), LH);
        if (fits || target <= 2 || a.ticks.target !== null || (!p.primary && p.dimension === 'y')) {
          ticks = t.values.map((v, i) => ({ value: v, text: texts[i]! }));
          break;
        }
        target--;
      }
      scale = linearScale(p.data || min !== null || max !== null ? [t.min, t.max] : [0, 1], range);
      if (p.primary && p.dimension === 'y') primaryTicks = t;
    }

    // Labels: placement, rotation, skipping, ellipsis.
    const at = ticks.map((t) => scale.map(t.value));
    const showLabels = !(empty && a.scale !== 'category') && (opts.labels === 'all' || (opts.labels === 'primary' && p.primary));
    let rotate = false;
    let every = 1;
    let texts = ticks.map((t) => t.text);
    if (a.scale === 'category' && p.across) {
      const band = scale.bandwidth;
      const widest = Math.max(0, ...texts.map((s) => (s ? widthOf(s, labelFont) : 0)));
      const turnedNeed = LH / SIN45 + LABEL_SPACE;
      if (band < widest + LABEL_PAD + LABEL_SPACE) {
        rotate = true;
        if (band < turnedNeed) every = Math.ceil(turnedNeed / band - 1e-9);
        // Turned, a label of w px takes (w + LH) × sin 45° in height: within a third of the chart.
        const maxW = input.height / 3 / SIN45 - LH;
        texts = texts.map((s) => (s ? fit(s, maxW, labelFont, widthOf, input.text.ellipsis, false) : s));
      }
    } else if (a.scale === 'category' && !p.across) {
      const band = scale.bandwidth;
      if (band < LH + LABEL_SPACE) every = Math.ceil((LH + LABEL_SPACE) / band - 1e-9);
    }

    // Upright axes share what the plot does not need (layout.md 4): wider labels end with « … ».
    if (!p.across) {
      const upright = plans.filter((q) => !q.across).length;
      const max = (input.width * (1 - MIN_PLOT_SHARE) - 2 * MARGIN) / upright - TICK - LABEL_GAP - LABEL_PAD - (titles && a.title ? lh('axis-title') + AXIS_TITLE_GAP : 0);
      texts = texts.map((s) => (s ? fit(s, Math.max(max, 0), labelFont, widthOf, input.text.ellipsis, false) : s));
    }
    const lineX = p.edge === 'x-min' ? plot.x : plot.x + plot.width;
    const out = TICK + LABEL_GAP;
    const tickLayouts: TickLayout[] = ticks.map((t, i) => {
      const s = texts[i];
      if (!showLabels || s === null || s === undefined || i % every !== 0) return { value: t.value, at: at[i]!, label: null };
      let label: PlacedText;
      if (p.edge === 'bottom' || p.edge === 'top') {
        const y = p.edge === 'bottom' ? plot.y + plot.height + out : plot.y - out;
        if (rotate) {
          label = { text: s, x: at[i]!, y, font: labelFont, anchor: dir === 'ltr' ? 'end' : 'start', baseline: 'middle', rotate: -45, dir };
          // A turned label reaches back towards x-min: the plot moves over until the furthest one fits.
          overhang = Math.max(overhang, (widthOf(s, labelFont) + LH) * SIN45 - at[i]!);
        } else {
          // A level label stays inside the chart: one at the very end slides in (the bars' last value), keeping the
          // margin text needs beyond its measure (spike S2: SVG text drawn up to 2 px wider in Firefox and WebKit).
          const half = widthOf(s, labelFont) / 2 + LABEL_PAD;
          const x = Math.min(Math.max(at[i]!, half), input.width - half);
          label = { text: s, x, y, font: labelFont, anchor: 'middle', baseline: p.edge === 'bottom' ? 'top' : 'bottom', dir };
        }
      } else {
        // Against the axis: the label's edge nearest the axis sits at `x`. Beside an axis on the x-min side that is
        // the label's right edge (`end` of LTR text, `start` of RTL text); on the x-max side, its left edge.
        const onMin = p.edge === 'x-min';
        const anchor = onMin === (dir === 'ltr') ? 'end' : 'start';
        label = { text: s, x: lineX + (onMin ? -out : out), y: at[i]!, font: labelFont, anchor, baseline: 'middle', dir };
      }
      return { value: t.value, at: at[i]!, label };
    });

    // Room taken (axes.md 17: the title beyond the labels).
    const shown = tickLayouts.filter((t) => t.label).map((t) => widthOf(t.label!.text, labelFont));
    const widest = shown.length ? Math.max(...shown) : 0;
    const titleH = titles && a.title ? lh('axis-title') + AXIS_TITLE_GAP : 0;
    let room: number;
    if (p.across) {
      const labelsH = !shown.length ? 0 : rotate ? (widest + LH) * SIN45 : LH;
      room = Math.ceil(out + labelsH + titleH);
    } else room = Math.ceil(out + (shown.length ? widest + LABEL_PAD : 0) + titleH);
    sizes.set(p, room);

    let title: PlacedText | null = null;
    if (titles && a.title) {
      const th = lh('axis-title');
      if (p.edge === 'bottom') title = { text: a.title, x: plot.x + plot.width / 2, y: plot.y + plot.height + room - th, font: 'axis-title', anchor: 'middle', baseline: 'top', dir };
      else if (p.edge === 'top') title = { text: a.title, x: plot.x + plot.width / 2, y: plot.y - room, font: 'axis-title', anchor: 'middle', baseline: 'top', dir };
      else {
        const outer = p.edge === 'x-min' ? plot.x - room + th / 2 : plot.x + plot.width + room - th / 2;
        title = { text: a.title, x: outer, y: plot.y + plot.height / 2, font: 'axis-title', anchor: 'middle', baseline: 'middle', rotate: -90, dir };
      }
    }
    const grid = a.ticks.grid ?? (p.dimension === 'y' && p.primary);
    layouts.push({ id: a.id, dimension: p.dimension, edge: p.edge, scale, ticks: tickLayouts, grid, title });
  }
  return { layouts, sizes, overhang: Math.max(0, overhang) };
}

/**
 * A second value axis on the first one's gridlines (axes.md 9): as many ticks, its own round step covering [lo, hi],
 * and its ends set so each tick falls where the first axis's does — even when the first's ends are fixed between
 * ticks (review 8).
 */
function alignTo(first: Ticks, lo: number, hi: number): Ticks {
  const n = first.values.length;
  if (n < 2 || !(first.step > 0)) return numericTicks(lo, hi, Math.max(n, 2), 'loose');
  const own = alignedTicks(lo, hi, n);
  const k = own.step / first.step;
  return { min: own.values[0]! - (first.values[0]! - first.min) * k, max: own.values[n - 1]! + (first.max - first.values[n - 1]!) * k, step: own.step, values: own.values };
}

function scaleAt(t: Ticks, range: [number, number], v: number): number {
  return linearScale([t.min, t.max], range).map(v);
}

/** Labels across overlap when two neighbours' boxes (with their padding) come closer than LABEL_SPACE. */
function acrossFits(at: readonly number[], texts: readonly (string | null)[], widthOf: (s: string, f: FontRole) => number, font: FontRole): boolean {
  for (let i = 1; i < at.length; i++) {
    const w1 = texts[i - 1] ? widthOf(texts[i - 1]!, font) : 0;
    const w2 = texts[i] ? widthOf(texts[i]!, font) : 0;
    if (Math.abs(at[i]! - at[i - 1]!) < (w1 + w2) / 2 + LABEL_PAD + LABEL_SPACE) return false;
  }
  return true;
}

function uprightFits(at: readonly number[], lineH: number): boolean {
  for (let i = 1; i < at.length; i++) if (Math.abs(at[i]! - at[i - 1]!) < lineH + LABEL_SPACE) return false;
  return true;
}

/** An axis's number labels: the app's formatter, or the locale's (format.ts). */
function numberLabels(t: Ticks, a: AxisModel, path: string, problems: Problem[], locale: string | undefined): string[] {
  const defaults = formatTicks(t.values, t.step, locale);
  const format = safeFormat(a.ticks.format as Formatter<number> | Formatter<InstantMs> | null, path, problems, locale, t.step);
  if (!format) return defaults;
  return t.values.map((v, i) => format(v as number & InstantMs) ?? defaults[i]!);
}

/**
 * An app formatter, made safe: if it throws or returns something else than a string, its label falls back to the
 * default and one Problem is reported for the axis (`callback-failed`), never with the value.
 */
function safeFormat<V>(format: Formatter<V> | null, path: string, problems: Problem[], locale: string | undefined, step: number): ((v: V) => string | null) | null {
  if (!format) return null;
  const context = { locale: locale ?? '', step };
  let reported = false;
  return (v: V) => {
    try {
      const s = format(v, context);
      if (typeof s === 'string') return s;
    } catch {
      // Reported below, once.
    }
    if (!reported) {
      reported = true;
      if (!problems.some((p) => p.path === path)) problems.push({ code: 'callback-failed', path });
    }
    return null;
  };
}
