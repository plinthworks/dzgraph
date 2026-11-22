/**
 * The tooltip's content, as data (hover-tooltip.md 6): a heading, then one row per series in series order. The DOM
 * layer writes it as text, never as HTML.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout, LayoutText } from './layout.js';
import type { ColorToken, MarkerSymbol, PointRef } from './scene.js';
import type { SeriesModel } from './series-type.js';
import { formatValue } from './format.js';
import { formatInstant } from './time.js';
import { symbolOf } from './series/shared.js';

export interface TooltipRow {
  readonly seriesId: string;
  readonly name: string;
  readonly value: string;
  readonly color: ColorToken;
  readonly symbol: MarkerSymbol;
}

export interface Tooltip {
  readonly heading: string;
  readonly rows: readonly TooltipRow[];
}

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
  if (axis?.scale === 'time') return formatInstant(x, locale, axis.zone ?? 'UTC');
  return formatValue(x, locale);
}

export const seriesName = (s: SeriesModel, text: Pick<LayoutText, 'seriesName'>) => s.name ?? text.seriesName(s.rank + 1);

export function tooltipOf(model: ChartModel, _layout: ChartLayout, hit: { readonly points: readonly PointRef[] }, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): Tooltip {
  const rows: TooltipRow[] = [];
  let heading = '';
  for (const p of hit.points) {
    const s = model.series.find((o) => o.id === p.seriesId);
    if (!s) continue;
    if (!heading) heading = xLabel(model, s, p.index, locale);
    rows.push({ seriesId: s.id, name: seriesName(s, text), value: formatValue(s.columns.y[p.index]!, locale), color: s.color, symbol: symbolOf(s.rank) });
  }
  return { heading, rows };
}
