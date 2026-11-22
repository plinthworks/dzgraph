/**
 * The crosshair (crosshair.md), lent to the core by the `crosshair` module (ADR 0006): lines through a place of the
 * plot and, at each axis's edge, a tag with the axis's value there. Pure: the DOM asks it for primitives at the
 * pointer (or the focused point) and paints them over the chart.
 */
import type { ChartModel } from './model.js';
import type { AxisLayout, ChartLayout } from './layout.js';
import type { Primitive, TextMeasurer } from './scene.js';
import { formatReading } from './format.js';
import { xValueLabel } from './tooltip.js';
import { crisp } from './compose.js';

/** Between a tag and the plot; inside a tag, across and along. */
const GAP = 2;
const PAD_X = 4;
const PAD_Y = 2;

export interface CrosshairKit {
  /** The crosshair's primitives at a place of the scene; null outside the plot or on a polar chart. */
  readonly draw: (model: ChartModel, layout: ChartLayout, at: { readonly x: number; readonly y: number }, measureText: TextMeasurer, locale: string | undefined) => Primitive[] | null;
}

/** An axis's value written to a tenth of its ticks' step (crosshair.md 2); a category by name, a time in its zone; a compared one as compared. */
function reading(model: ChartModel, layout: ChartLayout, a: AxisLayout, v: number, locale: string | undefined): string {
  // A compared axis reads as its labels do: a signed difference, a signed percent, base 100 (compare.md 3).
  const compared = a.dimension === 'y' ? layout.compare.axes.get(a.id) : undefined;
  if (compared && model.kit.compare) return model.kit.compare.format(v, compared, locale);
  const axis = (a.dimension === 'x' ? model.xAxes : model.yAxes).find((o) => o.id === a.id);
  if (a.dimension === 'x' && (axis?.scale === 'category' || axis?.scale === 'time')) return xValueLabel(model, a.id, v, locale);
  if (axis?.scale === 'log') return formatReading(Number(v.toPrecision(3)), 20, locale);
  const step = a.ticks.length > 1 ? Math.abs(a.ticks[1]!.value - a.ticks[0]!.value) : 0;
  const decimals = step > 0 ? Math.max(0, Math.ceil(-Math.log10(step)) + 1) : 2;
  return formatReading(v, decimals, locale);
}

function draw(model: ChartModel, layout: ChartLayout, at: { readonly x: number; readonly y: number }, measureText: TextMeasurer, locale: string | undefined): Primitive[] | null {
  const { plot } = layout;
  if (model.system !== 'cartesian' || !model.crosshair) return null;
  if (at.x < plot.x || at.x > plot.x + plot.width || at.y < plot.y || at.y > plot.y + plot.height) return null;
  const out: Primitive[] = [];
  const lines = new Set<'across' | 'down'>();
  const tags: Primitive[] = [];
  const paint = { stroke: 'axis-line' as const, strokeWidth: 1, dash: [3, 3] };
  for (const a of layout.axes) {
    if (a.dimension === 'y' && !model.crosshair.horizontal) continue;
    // An axis along the plot's bottom or top reads the pointer's x; one beside it, its y.
    const across = a.edge === 'bottom' || a.edge === 'top';
    const value = a.scale.invert(across ? at.x : at.y);
    const text = reading(model, layout, a, value, locale);
    const m = measureText(text, 'tick-label');
    const w = m.width + 2 * PAD_X;
    const h = m.ascent + m.descent + 2 * PAD_Y;
    let bx: number;
    let by: number;
    if (across) {
      lines.add('down');
      bx = Math.max(0, Math.min(layout.width - w, at.x - w / 2));
      by = a.edge === 'bottom' ? plot.y + plot.height + GAP : plot.y - GAP - h;
    } else {
      lines.add('across');
      bx = a.edge === 'x-min' ? plot.x - GAP - w : plot.x + plot.width + GAP;
      by = Math.max(0, Math.min(layout.height - h, at.y - h / 2));
    }
    const id = `crosshair/${a.dimension}/${a.id}`;
    tags.push({ kind: 'rect', sceneId: `${id}/box`, paint: { fill: 'background', stroke: 'axis-line', strokeWidth: 1 }, x: bx, y: by, width: w, height: h });
    // On its alphabetic baseline, centred in the box (compose.ts: the one baseline every painter draws alike).
    tags.push({ kind: 'text', sceneId: `${id}/text`, paint: { fill: 'text' }, x: bx + w / 2, y: by + PAD_Y + m.ascent, text, font: 'tick-label', anchor: 'middle', baseline: 'alphabetic' });
  }
  if (lines.has('down')) out.push({ kind: 'line', sceneId: 'crosshair/down', paint, x1: crisp(at.x), y1: plot.y, x2: crisp(at.x), y2: plot.y + plot.height });
  if (lines.has('across')) out.push({ kind: 'line', sceneId: 'crosshair/across', paint, x1: plot.x, y1: crisp(at.y), x2: plot.x + plot.width, y2: crisp(at.y) });
  return [...out, ...tags];
}

export const crosshairKit: CrosshairKit = { draw };
