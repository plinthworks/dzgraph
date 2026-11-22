/**
 * Linked charts (linked-charts.md): what is explored in one chart shows in the others — the x pointed at, the visible
 * range, the points selected, the drill level. Built on the charts' events and methods; a chart told by the group does
 * not tell it again (a flag while the group applies a change).
 */
import type { Chart } from './chart.js';

export interface LinkOptions {
  /** The x pointed at, shown in the others (by value). */
  readonly crosshair?: boolean;
  /** The visible range on x, set on the others. */
  readonly zoom?: 'x';
  /** The points selected, selected in the others by key, or by x value. */
  readonly selection?: 'key' | 'x';
  /** The drill level, gone to in the others. */
  readonly drill?: boolean;
}

/** Links charts; returns the function that unlinks them. */
export function linkCharts(charts: readonly Chart[], options: LinkOptions): () => void {
  let applying = false;
  const offs: (() => void)[] = [];
  /** Applies a change to every chart but its source, without listening to what it tells meanwhile. */
  const others = (from: Chart, apply: (c: Chart) => void) => {
    if (applying) return;
    applying = true;
    try {
      for (const c of charts) if (c !== from) apply(c);
    } finally {
      applying = false;
    }
  };
  for (const c of charts) {
    if (options.crosshair) offs.push(c.on('pointHover', (d) => others(c, (o) => o.showX(d.point && d.x !== undefined ? d.x : null))));
    if (options.zoom) offs.push(c.on('rangeChange', (d) => others(c, (o) => o.setRange(d.range))));
    if (options.selection) {
      const by = options.selection;
      offs.push(
        c.on('selectionChange', (d) =>
          others(c, (o) => {
            const values: (string | number)[] = [];
            for (const s of d.series)
              if (by === 'key') for (const key of s.keys ?? []) key != null && values.push(key);
              else values.push(...s.xs);
            o.selectBy(by, values);
          }),
        ),
      );
    }
    if (options.drill) offs.push(c.on('drill', (d) => others(c, (o) => o.setView({ drill: d.path }))));
  }
  return () => offs.splice(0).forEach((off) => off());
}

