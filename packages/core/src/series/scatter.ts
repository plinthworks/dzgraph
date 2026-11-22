/** Scatter plots (scatter.md): a translucent marker per point, both axes fitted and rounded. */
import type { SeriesBase } from '../options.js';
import type { SeriesType } from '../series-type.js';
import type { MarkerPrimitive } from '../scene.js';
import { isGap, placer, rangeOf, sceneId, symbolOf } from './shared.js';
import { CANVAS_THRESHOLD } from '../points-batch.js';

export interface ScatterSeriesOptions extends SeriesBase<'scatter'> {}

declare module '../options.js' {
  interface SeriesOptionsByType {
    scatter: ScatterSeriesOptions;
  }
}

const SIZE = 8;
/** Slightly translucent, so piles of points read as darker (scatter.md 2). */
const OPACITY = 0.8;

export const scatter: SeriesType<ScatterSeriesOptions, 'cartesian'> = {
  name: 'scatter',
  system: 'cartesian',
  roundX: true,
  sign: 'marker',
  optionNames: {},
  check: () => [],
  bounds: (s) => ({ x: rangeOf(s.columns.x), y: rangeOf(s.columns.y) }),
  marks: (ctx) => {
    const s = ctx.series;
    const symbol = symbolOf(s.rank);
    const paint = { fill: s.color, opacity: OPACITY };
    // Past the Canvas threshold, one batch in data units (ADR 0008): a frame of zoom builds nothing per point.
    if (s.columns.x.length > CANVAS_THRESHOLD) {
      const { x, y, orientation } = ctx.frame;
      const items = [{ kind: 'points' as const, sceneId: sceneId('s', s.id, 'points'), seriesId: s.id, paint, x: s.columns.x, y: s.columns.y, mapX: x.affine, mapY: y.affine, swapped: orientation === 'horizontal', size: SIZE, symbol }];
      return [{ layer: 'series', role: 'marks', items }];
    }
    const at = placer(ctx);
    const items: MarkerPrimitive[] = [];
    for (let i = 0; i < s.columns.x.length; i++) {
      if (isGap(s, i)) continue;
      const [x, y] = at(s.columns.x[i]!, s.columns.y[i]!);
      items.push({ kind: 'marker', sceneId: sceneId('s', s.id, 'm', i), paint, x, y, size: SIZE, symbol, point: { seriesId: s.id, index: i } });
    }
    return items.length ? [{ layer: 'series', role: 'marks', items }] : [];
  },
};
