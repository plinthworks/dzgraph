// Stand-in series types for the core's tests: the real ones arrive at step 1.7. They check one option each, so the
// tests can see a type's own checks reported with the right path, and give the bounds the real types will.
import type { Problem, SeriesBase } from '@dzgraph/core';
import type { Bounds, SeriesModel, SeriesType } from '@dzgraph/core/internal';

interface TestLineOptions extends SeriesBase<'line'> {
  readonly marker?: boolean | undefined;
}
interface TestColumnOptions extends SeriesBase<'column'> {}
interface TestBarOptions extends SeriesBase<'bar'> {}
interface TestScatterOptions extends SeriesBase<'scatter'> {}

const noProblems: readonly Problem[] = [];

/** The smallest and largest finite values of a column, or null. */
function range(a: Float64Array): Bounds | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of a) if (!Number.isNaN(v)) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? { min, max } : null;
}
const withZero = (b: Bounds | null): Bounds | null => (b ? { min: Math.min(0, b.min), max: Math.max(0, b.max) } : null);
const xy = (s: SeriesModel) => ({ x: range(s.columns.x), y: range(s.columns.y) });
const xyZero = (s: SeriesModel) => ({ x: range(s.columns.x), y: withZero(range(s.columns.y)) });

export const line: SeriesType<TestLineOptions, 'cartesian'> = {
  name: 'line',
  system: 'cartesian',
  sign: 'square',
  optionNames: { marker: true },
  check: (o, path) => (o['marker'] === undefined || typeof o['marker'] === 'boolean' ? noProblems : [{ code: 'invalid-option', path: `${path}.marker` }]),
  bounds: xy,
  marks: () => [],
};

export const column: SeriesType<TestColumnOptions, 'cartesian'> = {
  name: 'column',
  system: 'cartesian',
  sign: 'square',
  optionNames: {},
  check: () => noProblems,
  bounds: xyZero,
  marks: () => [],
};

export const bar: SeriesType<TestBarOptions, 'cartesian'> = {
  name: 'bar',
  system: 'cartesian',
  sign: 'square',
  orientation: 'horizontal',
  optionNames: {},
  check: () => noProblems,
  bounds: xyZero,
  marks: () => [],
};

export const scatter: SeriesType<TestScatterOptions, 'cartesian'> = {
  name: 'scatter',
  system: 'cartesian',
  sign: 'square',
  roundX: true,
  optionNames: {},
  check: () => noProblems,
  bounds: xy,
  marks: () => [],
};

export const types = [line, column, bar, scatter];
