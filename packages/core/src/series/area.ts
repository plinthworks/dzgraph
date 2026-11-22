/** Areas (line-area.md 6): a line with its surface filled down to zero, translucent, the line on top. */
import type { SeriesBase } from '../options.js';
import type { SeriesType } from '../series-type.js';
import { lineMarks } from './line.js';
import { rangeOf, withZero } from './shared.js';

export interface AreaSeriesOptions extends SeriesBase<'area'> {
  readonly marker?: boolean | undefined;
  /** Stacks the area on the other areas of the same stack (stacking.md 1); `true`: the stack `default`. */
  readonly stack?: boolean | string | undefined;
}

declare module '../options.js' {
  interface SeriesOptionsByType {
    area: AreaSeriesOptions;
  }
}

export const area: SeriesType<AreaSeriesOptions, 'cartesian'> = {
  name: 'area',
  system: 'cartesian',
  zeroBased: true,
  sign: 'square',
  sortedX: true,
  stackable: true,
  optionNames: { marker: true, stack: true },
  check: (o, path) => (o['marker'] === undefined || typeof o['marker'] === 'boolean' ? [] : [{ code: 'invalid-option', path: `${path}.marker` }]),
  // Zero is on the axis (axes.md 1): the fill reaches it.
  bounds: (s) => ({ x: rangeOf(s.columns.x), y: withZero(rangeOf(s.columns.y)) }),
  marks: (ctx) => lineMarks(ctx, 'area', 0),
};
