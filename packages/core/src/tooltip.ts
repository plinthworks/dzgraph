/**
 * The tooltip's content, as data (hover-tooltip.md 6): a heading, then one row per series in series order. The DOM
 * layer writes it as text, never as HTML.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout, LayoutText } from './layout.js';
import type { ColorToken, MarkerSymbol, PointRef } from './scene.js';
import type { SeriesModel } from './series-type.js';
import { formatShare, formatValue } from './format.js';
import { symbolOf } from './series/shared.js';

export interface TooltipRow {
  readonly seriesId: string;
  readonly name: string;
  readonly value: string;
  readonly color: ColorToken;
  readonly symbol: MarkerSymbol;
  /** A stacked point's share of its pile (stacking.md 14). */
  readonly share?: string;
}

export interface Tooltip {
  readonly heading: string;
  readonly rows: readonly TooltipRow[];
  /** The pile's total, when every row is of one pile (stacking.md 14). */
  readonly total?: string;
  /** Points left out of a long list (« Autres »'s tenth and after, pie-donut.md 8). */
  readonly more?: number;
  /** A gauge's scale and the threshold it falls in, written by the DOM's words (gauge.md 7, review 7). */
  readonly range?: { readonly min: string; readonly max: string };
  readonly threshold?: string;
}

/** « Autres » lists its largest slices, up to this many (pie-donut.md 8). */
const MAX_MEMBERS = 10;

/** How a point's x reads: its name, its category, or its value. */
export function xLabel(model: ChartModel, s: SeriesModel, index: number, locale: string | undefined): string {
  const name = s.names?.[index];
  if (name) return name;
  return xValueLabel(model, s.xAxis, s.columns.x[index]!, locale);
}

/** How a value on an x axis reads: a category's name, a date in the axis's zone, or a number (zoom-pan.md 8). */
export function xValueLabel(model: ChartModel, axisId: string, x: number, locale: string | undefined): string {
  const axis = model.xAxes.find((a) => a.id === axisId);
  if (axis?.scale === 'category') return axis.categories?.[Math.round(x)] ?? String(x);
  const time = model.kit.time;
  if (axis?.scale === 'time' && time) return time.format(x, locale, axis.zone ?? 'UTC');
  return formatValue(x, locale);
}

export const seriesName = (s: SeriesModel, text: Pick<LayoutText, 'seriesName'>) => s.name ?? text.seriesName(s.rank + 1);

export function tooltipOf(model: ChartModel, layout: ChartLayout, hit: { readonly points: readonly PointRef[] }, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): Tooltip {
  const rows: TooltipRow[] = [];
  let heading = '';
  // The one pile every row belongs to, if any: its total closes the tooltip.
  let pileOf: string | null | undefined;
  let total = Number.NaN;
  for (const p of hit.points) {
    const s = model.series.find((o) => o.id === p.seriesId);
    if (!s) continue;
    // A polar point (ADR 0007): its name, value and share; « Autres » lists the slices it holds.
    const placement = layout.placements.get(s.id);
    if (placement) {
      // A gauge: its value, then its scale and the threshold it falls in.
      const m = placement.meter;
      if (m) return { heading: placement.name(p.index), rows: [{ seriesId: s.id, name: seriesName(s, text), value: formatValue(m.value, locale), color: s.color, symbol: symbolOf(s.rank) }], range: { min: formatValue(m.min, locale), max: formatValue(m.max, locale) }, ...(m.threshold ? { threshold: m.threshold } : {}) };
      const members = placement.members(p.index);
      const colorOf = (i: number) => placement.legend.find((l) => l.index === i)?.color ?? s.color;
      const row = (i: number, share: number) => ({ seriesId: s.id, name: placement.name(i), value: formatValue(s.columns.y[i]!, locale), color: colorOf(i), symbol: symbolOf(s.rank), ...(Number.isNaN(share) ? {} : { share: formatShare(share, locale) }) });
      if (!members) return { heading: placement.name(p.index), rows: [{ ...row(p.index, placement.share(p.index)), name: seriesName(s, text) }] };
      const largest = [...members].sort((a, b) => s.columns.y[b]! - s.columns.y[a]! || a - b);
      const total = largest.reduce((a, i) => a + s.columns.y[i]!, 0) / placement.share(p.index);
      const shown = largest.slice(0, MAX_MEMBERS);
      return { heading: placement.name(p.index), rows: shown.map((i) => row(i, s.columns.y[i]! / total)), ...(largest.length > shown.length ? { more: largest.length - shown.length } : {}) };
    }
    if (!heading) heading = xLabel(model, s, p.index, locale);
    const pile = layout.stacks.get(s.id);
    const share = pile?.share[p.index];
    const key = pile ? JSON.stringify([s.type, s.xAxis, s.yAxis, s.stack]) : null;
    pileOf = pileOf === undefined || pileOf === key ? key : null;
    if (pile) total = pile.total[p.index]!;
    rows.push({ seriesId: s.id, name: seriesName(s, text), value: formatValue(s.columns.y[p.index]!, locale), color: s.color, symbol: symbolOf(s.rank), ...(share !== undefined && !Number.isNaN(share) ? { share: formatShare(share, locale) } : {}) });
  }
  // One pile: its segments from its far end down (review 8: by where each ends, negatives below), then its total.
  if (pileOf) {
    const end = (r: TooltipRow) => {
      const p = hit.points.find((q) => q.seriesId === r.seriesId)!;
      return layout.stacks.get(r.seriesId)!.top[p.index]!;
    };
    return { heading, rows: [...rows].sort((a, b) => end(b) - end(a)), total: formatValue(total, locale) };
  }
  return { heading, rows };
}
