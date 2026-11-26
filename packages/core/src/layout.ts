/**
 * Layout (layout.md, axes.md, legend.md, direction.md): where the title, the legend, the axes and the plot area go,
 * the axes' scales and ticks, every label measured and placed. Pure: the text is measured by the function given, the
 * translated words are given. Physical sides only through dir.ts.
 *
 * The axes depend on each other (a y axis's width on its labels, its labels on its ticks, its ticks on the plot's
 * height, the plot's height on the x axis's labels…): the sizes are settled by a few passes until they stop changing.
 */
import { NO_COMPARES, type CompareMode, type Compares, type SeriesCompare } from './compare.js';
import { yWithin } from './x-buckets.js';
import type { ColorToken, FontRole, Rect, TextMeasurer } from './scene.js';
import type { Problem } from './problem.js';
import type { Formatter } from './options.js';
import type { InstantMs } from './time.js';
import type { Placement, Scale, SeriesModel, SeriesType } from './series-type.js';
import type { AxisModel, ChartModel } from './model.js';
import { edgeX, sideOf, type Dir, type XSide } from './dir.js';
import { categoryScale, linearScale, logScale } from './scale.js';
import { alignedTicks, logTicks, numericTicks, tickTarget, type Ticks } from './ticks.js';
import { formatLogTicks, formatPercentTicks, formatTicks } from './format.js';
import { rangeOf } from './series/shared.js';
import { stacksOf, type Stacked, type Stacks } from './stack.js';
import { isShown, pointKey, type View } from './view.js';
import { rangeMinMax } from './decimate.js';
import type { NavigatorLayout } from './navigator.js';

/** The words layout writes, translated by the DOM layer. */
export interface LayoutText {
  /** A series without a name: « Série 1 »… (`place` counts from 1). */
  seriesName(place: number): string;
  noData: string;
  ellipsis: string;
  /** For polar charts (ADR 0007): a point without a name, by its place; « Autres »; the word under a donut's total. */
  pointName?: (place: number) => string;
  others?: string;
  total?: string;
  /** A slice's label from its name and share (pie-donut.md 9): the words' order is the language's (review 7). */
  sliceLabel?: (name: string, share: string) => string;
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
  /**
   * With two value axes in use, the signs of each one's visible series, before its title (combined.md 5): their
   * centres, in series order.
   */
  readonly signs: readonly { readonly seriesId: string; readonly x: number; readonly y: number }[];
  /** A time axis's second tier (time-axis.md 7): the larger unit, at its first tick and where it changes. */
  readonly second: readonly PlacedText[];
}

export interface LegendItemLayout {
  /** What the item hides and shows: its series' id, or a point's key (a slice, ADR 0007). */
  readonly key: string;
  readonly seriesId: string;
  /** A point's item (a slice): its index and colour; null for a series' item. */
  readonly point: { readonly index: number; readonly color: ColorToken } | null;
  /** Its full name, for its button (the label may end with « … »). */
  readonly name: string;
  /** The whole item (sign and name): the target of a click or a focus ring. */
  readonly box: Rect;
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
  /** The navigator under the plot, when asked (navigator.md). */
  readonly navigator: NavigatorLayout | null;
  /** The row the range buttons go in, above the plot (range-buttons.md 1); the DOM places its buttons there. */
  readonly rangeBar: Rect | null;
  /** The piles of the stacked visible series (stacking.md): where each point's segment starts and ends. */
  readonly stacks: Stacks;
  /** The comparison of each compared series (compare.md): its affine, its baseline; and those without one. */
  readonly compare: Compares;
  /** Where each polar series placed itself (ADR 0007), by series id. */
  readonly placements: ReadonlyMap<string, Placement>;
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
/** An axis's signs (combined.md 5): 8 px each, 12 px apart, 6 px from the title. */
const AXIS_SIGN = 8;
const AXIS_SIGN_PITCH = 12;
const AXIS_SIGN_GAP = 6;
/** Between the x axis's labels and the navigator; the range buttons' row and the gap under it. */
const NAV_GAP = 14;
const RANGE_BAR = 24;
const RANGE_BAR_GAP = 8;
/** Between a time axis's two rows of labels. */
const SECOND_GAP = 2;
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
  const stacks = stacksOf(input.model, input.view);
  const compares = input.model.kit.compare?.of(input.model, input.view) ?? NO_COMPARES;
  if (W < MIN_WIDTH || H < MIN_HEIGHT) {
    // Too small for axes (layout.md 5): the plot alone.
    return { width: W, height: H, dir, plot: { x: MARGIN, y: MARGIN, width: Math.max(0, W - 2 * MARGIN), height: Math.max(0, H - 2 * MARGIN) }, title: [], subtitle: null, axes: [], legend: null, noData: null, problems: [], navigator: null, rangeBar: null, stacks, compare: compares, placements: new Map() };
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
    result = attempt(input, a, stacks, compares);
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

function attempt(input: LayoutInput, opts: Options, stacks: Stacks, compares: Compares): ChartLayout {
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

  // A polar chart (ADR 0007): its series places itself, first in the whole room, with its labels.
  const polarSeries = model.system === 'polar' ? model.series.find((s) => isShown(s, input.view) && typeOf(input, s)?.place) : undefined;
  const placeIn = (box: Rect, labels: boolean): Placement | null => {
    const type = polarSeries ? typeOf(input, polarSeries) : undefined;
    if (!polarSeries || !type?.place) return null;
    const t = input.text;
    return type.place({ series: polarSeries, box, labels, view: input.view, dir, mirror: model.mirror, locale: input.locale, measureText, text: { seriesName: t.seriesName, pointName: t.pointName ?? t.seriesName, others: t.others ?? t.ellipsis, total: t.total ?? '', sliceLabel: t.sliceLabel ?? ((name, share) => `${name} ${share}`) } });
  };
  const firstPlace = placeIn({ x: minX, y: top, width: maxX - minX, height: bottom - top }, true);
  // A polar series hidden (from the start, or by the app): its own item stays, the only way back (review 9).
  const hiddenPolar = model.system === 'polar' && !polarSeries ? model.series[0] : undefined;
  const pointItems = firstPlace && polarSeries
    ? firstPlace.legend.map((i) => ({ key: pointKey(polarSeries.id, i.index), seriesId: polarSeries.id, point: { index: i.index, color: i.color }, name: i.name, hidden: i.hidden }))
    : hiddenPolar
      ? [{ key: hiddenPolar.id, seriesId: hiddenPolar.id, point: null, name: hiddenPolar.name ?? input.text.seriesName(hiddenPolar.rank + 1), hidden: true }]
      : undefined;
  // Its legend shows when asked, or by default when its labels did not fit (pie-donut.md 11), or it is hidden.
  const legendWanted = model.legend !== null && (model.system !== 'polar' || !model.legend.auto || (firstPlace?.needsLegend ?? false) || hiddenPolar !== undefined);

  // Legend (legend.md): its room, before the axes.
  let legend: ChartLayout['legend'] = null;
  if (opts.legend && model.legend && legendWanted && model.series.length > 0) {
    const side = model.legend.position === 'start' || model.legend.position === 'end';
    const xAxisGuess = TICK + LABEL_GAP + lineHeight('tick-label');
    const budget = side ? bottom - top : Math.min(H / 3, bottom - top - MIN_PLOT_SHARE * H - xAxisGuess - LEGEND_GAP);
    const placed = placeLegend(input, side ? Math.min(inner.width / 4, inner.width) : inner.width, budget, side, widthOf, lineHeight('legend'), ellipsize, pointItems);
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

  if (model.system === 'polar') {
    // No axes: the series has the room left, labelled unless its legend shows because its labels did not fit.
    const plot: Rect = { x: minX, y: top, width: Math.max(0, maxX - minX), height: Math.max(0, bottom - top) };
    const placement = legend && firstPlace?.needsLegend ? placeIn(plot, false) : legend ? placeIn(plot, true) : firstPlace;
    const placements = new Map<string, Placement>(placement && polarSeries ? [[polarSeries.id, placement]] : []);
    // A gauge without a value still draws its track and its dash (gauge.md 5, review 4).
    const empty = !placement || (placement.order.length === 0 && !placement.meter);
    const noData = empty ? { text: text.noData, x: plot.x + plot.width / 2, y: plot.y + plot.height / 2, font: 'tick-label' as const, anchor: 'middle' as const, baseline: 'middle' as const, dir } : null;
    return { width: W, height: H, dir, plot, title, subtitle, axes: [], legend, noData, problems: [], navigator: null, rangeBar: null, stacks, compare: compares, placements };
  }

  // The navigator (navigator.md 1): a strip and its labels at the bottom, above a bottom legend; the range buttons'
  // row (range-buttons.md 1) at the top, under the title. Charts along x only (columns, lines, areas, scatters).
  const xModel = model.xAxes[0];
  const along = model.orientation === 'vertical' && xModel !== undefined;
  // The model asks for a navigator only when its module came (normalize.ts): the kit is there.
  const navKit = model.navigator ? model.kit.navigator : null;
  let navTop: number | null = null;
  if (along && navKit) {
    navTop = bottom - navKit.strip - 2 - lineHeight('tick-label');
    bottom = navTop - NAV_GAP;
  }
  let barTop: number | null = null;
  if (along && (model.rangeButtons ?? (model.navigator && xModel.scale === 'time'))) {
    barTop = top;
    top += RANGE_BAR + RANGE_BAR_GAP;
  }

  // Axes: settled in passes (sizes depend on each other).
  const problems: Problem[] = [];
  // No value to show: no series, or only gaps (axes.md 6, review 14b).
  // Every series hidden counts as none: the plot says there is nothing to show (legend-interaction.md 4).
  const empty = model.series.every((s) => !isShown(s, input.view) || !s.columns.y.some((v) => !Number.isNaN(v)));
  const axes = settleAxes(input, { top, bottom, minX, maxX }, opts, empty, problems, stacks, compares);
  // A series compared without a baseline is not drawn; said once, by series, never with a value (compare.md 6).
  for (const s of model.series) if (compares.missing.has(s.id)) problems.push({ code: 'no-baseline', path: `series[${s.rank}]`, seriesId: s.id });

  const noData = empty ? { text: text.noData, x: axes.plot.x + axes.plot.width / 2, y: axes.plot.y + axes.plot.height / 2, font: 'tick-label' as const, anchor: 'middle' as const, baseline: 'middle' as const, dir } : null;
  const p = axes.plot;
  const xLayout = axes.layouts.find((a) => a.dimension === 'x');
  const reversed = xLayout ? xLayout.scale.map(1) < xLayout.scale.map(0) : false;
  const nav = navTop !== null && xModel && navKit ? navKit.layout(model, xModel.id, { x: p.x, y: navTop, width: p.width, height: navKit.strip }, reversed, input.locale, 'tick-label', widthOf, dir) : null;
  const rangeBar = barTop !== null ? { x: p.x, y: barTop, width: p.width, height: RANGE_BAR } : null;
  return { width: W, height: H, dir, plot: p, title, subtitle, axes: axes.layouts, legend, noData, problems, navigator: nav, rangeBar, stacks, compare: compares, placements: new Map() };
}

/** Shortens `s` with an ellipsis to fit `max` px; `force` adds the ellipsis even if it fits (a cut list). */
const typeOf = (input: LayoutInput, s: SeriesModel) => input.types.find((t) => t.name === s.type);

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
  readonly key: string;
  readonly seriesId: string;
  readonly point: LegendItemLayout['point'];
  readonly name: string;
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
  /** A polar chart's items, one per point (ADR 0007); absent: one per series. */
  points?: readonly Omit<LegendEntry, 'text' | 'width'>[],
): { rows: LegendEntry[][]; boxWidth: number; boxHeight: number } | null {
  const rowH = Math.max(lineH, SIGN_HEIGHT);
  const labelMax = maxWidth - SIGN_WIDTH - SIGN_GAP;
  const entries: LegendEntry[] = (points ?? input.model.series.map((s) => ({ key: s.id, seriesId: s.id, point: null, name: s.name ?? input.text.seriesName(s.rank + 1), hidden: !isShown(s, input.view) }))).map((e) => {
    const text = ellipsize(e.name, labelMax, 'legend');
    return { ...e, text, width: SIGN_WIDTH + SIGN_GAP + widthOf(text, 'legend') };
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
        key: e.key,
        seriesId: e.seriesId,
        point: e.point,
        name: e.name,
        box: { x: ix, y, width: e.width, height: rowH },
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
  /** An x axis's visible range, when zoomed (zoom-pan.md): its ends, exactly. */
  readonly zoom: { readonly min: number; readonly max: number } | null;
}

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly minX: number;
  readonly maxX: number;
}

function settleAxes(input: LayoutInput, box: Box, opts: Options, empty: boolean, problems: Problem[], stacks: Stacks, compares: Compares): { plot: Rect; layouts: AxisLayout[] } {
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
        // A value axis fits the points in view when their x axis is zoomed (zoom-pan.md 6).
        const zoomedRaw = kind === 'y' ? input.view?.range?.[s.xAxis] : undefined;
        // A category axis shows whole categories, rounded as the axis rounds them (zoom-pan.md 10, review 1).
        const zoomedX = zoomedRaw && model.xAxes.find((x) => x.id === s.xAxis)?.scale === 'category' ? { min: Math.round(zoomedRaw.min), max: Math.round(zoomedRaw.max) } : zoomedRaw;
        // A stacked series reaches as far as its segments do (stacking.md 8).
        const pile = kind === 'y' ? stacks.get(s.id) : undefined;
        // A log axis fits the positive values themselves: zero is not on it (log-scale.md 8).
        const log = a.scale === 'log';
        const zeroBased = !log && typeOf.get(s.type)?.zeroBased === true;
        // A compared series (compare.md): its raw extent through its affine, zero kept in compared values.
        const cmp = kind === 'y' ? compares.series.get(s.id) : undefined;
        if (kind === 'y' && compares.missing.has(s.id)) continue;
        const b = cmp ? comparedBounds(s, cmp, zoomedX ?? null, zeroBased) : pile ? pileBounds(s, pile, zoomedX ?? null) : zoomedX ? visibleY(s, zoomedX, zeroBased) : log ? rangeOf(kind === 'x' ? s.columns.x : s.columns.y) : boundsOf(s)[kind];
        if (b) {
          min = Math.min(min, b.min);
          max = Math.max(max, b.max);
        }
        if (kind === 'x' && typeOf.get(s.type)?.roundX) round = true;
      }
      const zoom = kind === 'x' ? (input.view?.range?.[a.id] ?? null) : null;
      plans.push({ model: a, dimension: kind, index, edge, across, data: min <= max ? { min, max } : null, round, primary: index === 0, zoom });
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
    const out = layoutAxes(input, plans, plot, opts, empty, reported, compares);
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
function layoutAxes(input: LayoutInput, plans: readonly AxisPlan[], plot: Rect, opts: Options, empty: boolean, problems: Problem[], compares: Compares) {
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
  // With two value axes in use, each shows its series' signs (combined.md 5).
  const visible = model.series.filter((s) => isShown(s, input.view));
  const valueAxesInUse = model.yAxes.filter((y) => visible.some((s) => s.yAxis === y.id)).length;

  for (const p of plans) {
    const a = p.model;
    const length = p.across ? plot.width : plot.height;
    const signIds = p.dimension === 'y' && valueAxesInUse >= 2 ? visible.filter((s) => s.yAxis === a.id).map((s) => s.id) : [];
    const headed = titles && (a.title !== null || signIds.length > 0);
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

    let secondTier: { index: number; text: string }[] = [];
    const time = input.model.kit.time;
    if (a.scale === 'time' && time) {
      // Time (time-axis.md 3–7): the data's ends, ticks on the zone's wall clock, the target lowered while labels overlap.
      const zone = a.zone ?? 'UTC';
      let lo = p.zoom?.min ?? a.min ?? p.data?.min ?? 0;
      let hi = p.zoom?.max ?? a.max ?? p.data?.max ?? lo + 86_400_000;
      // One value only (axes.md 5): centred, a step on each side — the period around an aggregated one (a single
      // year shows 2025–2027, never milliseconds of 1 January), else a day.
      if (hi === lo) {
        const by = a.period;
        if (by && 'period' in by) [lo, hi] = [time.periodStart(lo - 1, by.period, zone), time.periodAfter(time.periodStart(lo, by.period, zone), by.period, zone)];
        else {
          const step = by ? by.step : 86_400_000;
          [lo, hi] = [lo - step, lo + step];
        }
      }
      let target = a.ticks.target ?? tickTarget(length, p.across ? 'across' : 'upright');
      const format = safeFormat(a.ticks.format as Formatter<InstantMs> | null, path, problems, locale, 0);
      for (;;) {
        const t = time.ticks(lo, hi, target, zone);
        const named = time.labels(t, locale, zone);
        const texts = t.values.map((v, i) => (format ? format(v as InstantMs) : null) ?? named.labels[i]!);
        const span = linearScale([lo, hi], range);
        const fits = p.across ? acrossFits(t.values.map((v) => span.map(v)), texts, widthOf, labelFont) : uprightFits(t.values.map((v) => span.map(v)), LH);
        if (fits || target <= 2 || a.ticks.target !== null) {
          ticks = t.values.map((v, i) => ({ value: v, text: texts[i]! }));
          secondTier = p.across ? named.second : [];
          break;
        }
        target--;
      }
      scale = linearScale([lo, hi === lo ? lo + 1 : hi], range);
    } else if (a.scale === 'log') {
      // Log (log-scale.md 3–7): powers of ten, ticks per decade by room; a bound the app gives is kept exactly.
      const min = p.zoom?.min ?? a.min;
      const max = p.zoom?.max ?? a.max;
      const lo = min ?? p.data?.min ?? (max !== null ? max / 10 : 1);
      const hi = max ?? p.data?.max ?? (min !== null ? min * 10 : 10);
      const both = min !== null && max !== null;
      let target = a.ticks.target ?? tickTarget(length, p.across ? 'across' : 'upright');
      let t: Ticks;
      for (;;) {
        if (both || !p.round) t = logTicks(lo, hi, target, 'inside');
        else {
          const r = logTicks(lo, hi, target, 'loose');
          const tmin = min ?? r.min;
          const tmax = max ?? r.max;
          t = { min: tmin, max: tmax, step: r.step, values: r.values.filter((v) => v >= tmin * (1 - 1e-9) && v <= tmax * (1 + 1e-9)) };
        }
        const span = logScale([t.min, t.max], range);
        const texts = numberLabels(t, a, path, problems, locale, p.dimension === 'y' ? compares.axes.get(a.id) : undefined, model);
        const fits = p.across ? acrossFits(t.values.map((v) => span.map(v)), texts, widthOf, labelFont) : uprightFits(t.values.map((v) => span.map(v)), LH);
        if (fits || target <= 2 || a.ticks.target !== null) {
          ticks = t.values.map((v, i) => ({ value: v, text: texts[i]! }));
          break;
        }
        target--;
      }
      scale = logScale([t.min, t.max], range);
    } else if (a.scale === 'category') {
      const cats = a.categories ?? [];
      // Zoomed: whole categories (zoom-pan.md 10), the first and last shown in full.
      const first = p.zoom ? Math.max(0, Math.round(p.zoom.min)) : 0;
      const last = p.zoom ? Math.min(cats.length - 1, Math.round(p.zoom.max)) : cats.length - 1;
      scale = categoryScale(Math.max(1, last - first + 1), range, first);
      const format = safeFormat(a.ticks.format as Formatter<string> | null, path, problems, locale, 1);
      ticks = cats.slice(first, last + 1).map((c, k) => ({ value: first + k, text: format ? format(c) : c }));
    } else {
      // A bound the app gives is kept; one on the wrong side of the data is reported and left out (axes.md 4). A
      // zoomed x axis shows its visible range, exactly.
      let min = p.zoom?.min ?? a.min;
      let max = p.zoom?.max ?? a.max;
      const where = `${p.dimension}Axis[${p.index}]`;
      if (p.data && min !== null && max === null && min >= p.data.max) {
        problems.push({ code: 'invalid-option', path: `${where}.min` });
        min = null;
      }
      if (p.data && max !== null && min === null && max <= p.data.min) {
        problems.push({ code: 'invalid-option', path: `${where}.max` });
        max = null;
      }
      let lo = min ?? p.data?.min ?? 0;
      let hi = max ?? p.data?.max ?? 1;
      // Zero alone on an x axis (axes.md 5): centred, −1 to 1; 0–1 is a value axis's, whose columns start at zero.
      if (p.dimension === 'x' && min === null && max === null && lo === 0 && hi === 0) [lo, hi] = [-1, 1];
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
        const texts = numberLabels(t, a, path, problems, locale, p.dimension === 'y' ? compares.axes.get(a.id) : undefined, model);
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
      const max = (input.width * (1 - MIN_PLOT_SHARE) - 2 * MARGIN) / upright - TICK - LABEL_GAP - LABEL_PAD - (headed ? lh('axis-title') + AXIS_TITLE_GAP : 0);
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
    const titleH = headed ? lh('axis-title') + AXIS_TITLE_GAP : 0;
    let room: number;
    const secondShown = showLabels && secondTier.length > 0 && (p.edge === 'bottom' || p.edge === 'top');
    const secondH = secondShown ? LH + SECOND_GAP : 0;
    if (p.across) {
      const labelsH = !shown.length ? 0 : rotate ? (widest + LH) * SIN45 : LH;
      room = Math.ceil(out + labelsH + secondH + titleH);
    } else room = Math.ceil(out + (shown.length ? widest + LABEL_PAD : 0) + titleH);
    sizes.set(p, room);

    let title: PlacedText | null = null;
    const signs: { seriesId: string; x: number; y: number }[] = [];
    if (headed) {
      const th = lh('axis-title');
      // The title and the signs before it, as one run centred on the plot's side (combined.md 5).
      const w = a.title !== null ? widthOf(a.title, 'axis-title') : 0;
      const block = signIds.length ? signIds.length * AXIS_SIGN_PITCH - (AXIS_SIGN_PITCH - AXIS_SIGN) : 0;
      const run = w + (w && block ? AXIS_SIGN_GAP : 0) + block;
      if (p.edge === 'bottom' || p.edge === 'top') {
        const y = p.edge === 'bottom' ? plot.y + plot.height + room - th : plot.y - room;
        // Along the reading direction: the signs first, then the title.
        const ltr = dir === 'ltr';
        const first = plot.x + plot.width / 2 + (ltr ? -run / 2 : run / 2);
        const towards = ltr ? 1 : -1;
        signIds.forEach((id, k) => signs.push({ seriesId: id, x: first + towards * (AXIS_SIGN / 2 + k * AXIS_SIGN_PITCH), y: y + th / 2 }));
        if (a.title) title = { text: a.title, x: first + towards * (run - w / 2), y, font: 'axis-title', anchor: 'middle', baseline: 'top', dir };
      } else {
        // Turned to read upwards: what comes before the title is below it.
        const outer = p.edge === 'x-min' ? plot.x - room + th / 2 : plot.x + plot.width + room - th / 2;
        const top = plot.y + plot.height / 2 - run / 2;
        if (a.title) title = { text: a.title, x: outer, y: top + w / 2, font: 'axis-title', anchor: 'middle', baseline: 'middle', rotate: -90, dir };
        const start = top + w + (w && block ? AXIS_SIGN_GAP : 0);
        signIds.forEach((id, k) => signs.push({ seriesId: id, x: outer, y: start + AXIS_SIGN / 2 + k * AXIS_SIGN_PITCH }));
      }
    }
    const grid = a.ticks.grid ?? (p.dimension === 'y' && p.primary);
    // The second tier, under (or over) the first row, starting at its tick, along the reading direction.
    // Each label's ink runs from its tick toward later times (rightward unless the axis is mirrored or reversed),
    // slides inside the chart at the end (the 2 px text margin, spike S2), and is left out if it would overlap the
    // previous one.
    const second: PlacedText[] = [];
    if (secondShown) {
      const rightward = scale.map(1) >= scale.map(0);
      const anchor = rightward === (dir === 'ltr') ? 'start' : 'end';
      const y = p.edge === 'bottom' ? plot.y + plot.height + out + LH + SECOND_GAP : plot.y - out - LH - SECOND_GAP;
      let reach = rightward ? -Infinity : Infinity;
      for (const t of secondTier) {
        const w = widthOf(t.text, labelFont);
        const lo = rightward ? Math.min(at[t.index]!, input.width - LABEL_PAD - w) : Math.max(at[t.index]! - w, LABEL_PAD);
        if (rightward ? lo < reach + LABEL_PAD : lo + w > reach - LABEL_PAD) continue;
        reach = rightward ? lo + w : lo;
        second.push({ text: t.text, x: rightward ? lo : lo + w, y, font: labelFont, anchor, baseline: p.edge === 'bottom' ? 'top' : 'bottom', dir });
      }
    }
    layouts.push({ id: a.id, dimension: p.dimension, edge: p.edge, scale, ticks: tickLayouts, grid, title, signs, second });
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
function numberLabels(t: Ticks, a: AxisModel, path: string, problems: Problem[], locale: string | undefined, compared: CompareMode | undefined, model: ChartModel): string[] {
  const cmp = compared && model.kit.compare;
  const defaults = cmp ? cmp.ticks(t.values, compared, locale) : a.stacking === 'percent' ? formatPercentTicks(t.values, locale) : a.scale === 'log' ? formatLogTicks(t.values, locale) : formatTicks(t.values, t.step, locale);
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

/** The lowest and highest ends of a stacked series' segments, within an x range when zoomed; zero always in. */
function pileBounds(s: SeriesModel, pile: Stacked, r: { readonly min: number; readonly max: number } | null): { min: number; max: number } {
  const { x } = s.columns;
  let min = 0;
  let max = 0;
  for (let i = 0; i < x.length; i++) {
    if (r && (x[i]! < r.min || x[i]! > r.max)) continue;
    const a = pile.base[i]!;
    const b = pile.top[i]!;
    if (Number.isNaN(a)) continue;
    min = Math.min(min, a, b);
    max = Math.max(max, a, b);
  }
  return { min, max };
}

/** A compared series' extent (compare.md 1): its raw one (in view when zoomed) through its affine; zero kept for zero-based types. */
function comparedBounds(s: SeriesModel, c: SeriesCompare, zoom: { readonly min: number; readonly max: number } | null, zeroBased: boolean): { min: number; max: number } | null {
  const raw = zoom ? visibleY(s, zoom, false) : rangeOf(s.columns.y);
  if (!raw) return null;
  const a = c.a * raw.min + c.c;
  const b = c.a * raw.max + c.c;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return zeroBased ? { min: Math.min(0, min), max: Math.max(0, max) } : { min, max };
}

/**
 * The lowest and highest value of a series' points within an x range (zoom-pan.md 6), zero kept for zero-based types:
 * a sorted series through its pyramid, an unsorted one through its buckets on x (x-buckets.ts).
 */
function visibleY(s: SeriesModel, r: { readonly min: number; readonly max: number }, zeroBased: boolean): { min: number; max: number } | null {
  const { x, y } = s.columns;
  let b: { min: number; max: number } | null = null;
  if (s.sorted) {
    let lo = 0;
    let hi = x.length;
    while (lo < hi) {
      const m = (lo + hi) >>> 1;
      if (x[m]! < r.min) lo = m + 1;
      else hi = m;
    }
    let end = lo;
    hi = x.length;
    while (end < hi) {
      const m = (end + hi) >>> 1;
      if (x[m]! <= r.max) end = m + 1;
      else hi = m;
    }
    b = rangeMinMax(y, lo, end);
  } else b = yWithin(x, y, r.min, r.max);
  return b && zeroBased ? { min: Math.min(0, b.min), max: Math.max(0, b.max) } : b;
}
