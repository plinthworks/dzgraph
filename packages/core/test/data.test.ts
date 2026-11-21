// Reading a series' x/y data, in every shape the options accept (options.ts DataInput), into columns. Bad input never
// throws: it becomes gaps and one Problem per kind of fault, never carrying a value (CLAUDE.md). Step 1.4.
import { describe, it, expect } from 'vitest';
import { readXYData } from '../src/data.js';

const nums = (a: Float64Array | null) => (a ? [...a].map((v) => (Number.isNaN(v) ? 'gap' : v)) : null);

describe('readXYData: the four shapes', () => {
  it('values only: y from the values, x from their position', () => {
    const r = readXYData([12, 15, null, 9], 'series[0].data', 's');
    expect(r.count).toBe(4);
    expect(r.x).toEqual({ kind: 'index' });
    expect(nums(r.y)).toEqual([12, 15, 'gap', 9]);
    expect(r.keys).toBeNull();
    expect(r.problems).toEqual([]);
  });

  it('pairs: numbers or strings along x', () => {
    const r = readXYData([[1, 10], [2, null], ['Q3', 30]], 'series[0].data', 's');
    expect(r.x.kind).toBe('values');
    if (r.x.kind !== 'values') return;
    expect(nums(r.x.numbers)).toEqual([1, 2, 'gap']);
    expect(r.x.texts).toEqual([null, null, 'Q3']);
    expect(nums(r.y)).toEqual([10, 'gap', 30]);
  });

  it('points written out, with keys and names', () => {
    const r = readXYData([{ x: 1, y: 2, key: 'a', name: 'Lyon' }, { y: 3, key: 'b' }], 'series[0].data', 's');
    expect(r.x.kind).toBe('values');
    if (r.x.kind !== 'values') return;
    // A point without x takes its position.
    expect(nums(r.x.numbers)).toEqual([1, 1]);
    expect(nums(r.y)).toEqual([2, 3]);
    expect(r.keys).toEqual(['a', 'b']);
    expect(r.names).toEqual(['Lyon', null]);
  });

  it('columns: typed arrays are read as they are, NaN being a gap without a Problem', () => {
    const y = new Float64Array([1, Number.NaN, 3]);
    const r = readXYData({ x: new Float64Array([10, 20, 30]), y }, 'series[0].data', 's');
    expect(nums(r.y)).toEqual([1, 'gap', 3]);
    expect(r.y).toBe(y);
    expect(r.problems).toEqual([]);
  });

  it('columns: plain arrays, keys beside them', () => {
    const r = readXYData({ y: [1, null], key: ['k1', 'k2'] }, 'series[0].data', 's');
    expect(r.x).toEqual({ kind: 'index' });
    expect(nums(r.y)).toEqual([1, 'gap']);
    expect(r.keys).toEqual(['k1', 'k2']);
  });

  it('an empty array is an empty series', () => {
    const r = readXYData([], 'series[0].data', 's');
    expect(r.count).toBe(0);
    expect(r.problems).toEqual([]);
  });
});

describe('readXYData: faults become gaps and one Problem each, without values', () => {
  it('non-finite numbers in an array the app wrote: one Problem for the series, its count', () => {
    const r = readXYData([1, Number.NaN, Infinity, 4, -Infinity], 'series[1].data', 'sales');
    expect(nums(r.y)).toEqual([1, 'gap', 'gap', 4, 'gap']);
    expect(r.problems).toEqual([{ code: 'non-finite-value', path: 'series[1].data[1]', seriesId: 'sales', detail: 'count=3' }]);
  });

  it('Infinity in a typed column is reported (NaN is how a column writes a gap; Infinity is not)', () => {
    const r = readXYData({ y: new Float64Array([1, Infinity]) }, 'series[0].data', 's');
    expect(nums(r.y)).toEqual([1, 'gap']);
    expect(r.problems.map((p) => p.code)).toEqual(['non-finite-value']);
  });

  it('entries in none of the shapes: gaps, one invalid-data with the first place and the count', () => {
    const r = readXYData([1, 'two', { y: 3 }, [4], true], 'series[0].data', 's');
    expect(r.count).toBe(5);
    expect(nums(r.y)).toEqual([1, 'gap', 'gap', 'gap', 'gap']);
    expect(r.problems).toEqual([{ code: 'invalid-data', path: 'series[0].data[1]', seriesId: 's', detail: 'count=4' }]);
  });

  it('a point without y, or a y that is not a number', () => {
    const r = readXYData([{ x: 1 }, { x: 2, y: '3' }, { x: 3, y: 3 }], 'series[0].data', 's');
    expect(nums(r.y)).toEqual(['gap', 'gap', 3]);
    expect(r.problems).toEqual([{ code: 'invalid-data', path: 'series[0].data[0]', seriesId: 's', detail: 'count=2' }]);
  });

  it('data that is neither an array nor columns: an empty series', () => {
    for (const bad of [undefined, null, 42, 'abc', { x: [1] }, () => 1]) {
      const r = readXYData(bad, 'series[0].data', 's');
      expect(r.count).toBe(0);
      expect(r.problems).toEqual([{ code: 'invalid-data', path: 'series[0].data', seriesId: 's' }]);
    }
  });

  it('columns of different lengths: cut to the shortest, reported', () => {
    const r = readXYData({ x: [1, 2, 3], y: [10, 20] }, 'series[0].data', 's');
    expect(r.count).toBe(2);
    expect(r.problems).toEqual([{ code: 'invalid-data', path: 'series[0].data.x', seriesId: 's', detail: 'length' }]);
  });

  it('a duplicate key: the later point loses it, one Problem', () => {
    const r = readXYData([{ y: 1, key: 'a' }, { y: 2, key: 'b' }, { y: 3, key: 'a' }, { y: 4, key: 'a' }], 'series[0].data', 's');
    expect(r.keys).toEqual(['a', 'b', null, null]);
    expect(r.problems).toEqual([{ code: 'duplicate-key', path: 'series[0].data[2].key', seriesId: 's', detail: 'count=2' }]);
  });

  it('a key that is not a string is left out, reported as invalid-data', () => {
    const r = readXYData([{ y: 1, key: 7 }], 'series[0].data', 's');
    expect(r.keys).toEqual([null]);
    expect(r.problems).toEqual([{ code: 'invalid-data', path: 'series[0].data[0].key', seriesId: 's', detail: 'count=1' }]);
  });
});

describe('readXYData: order along x', () => {
  it('sorted when x never goes backwards (gaps do not count)', () => {
    expect(readXYData([[1, 1], [1, 2], [3, null], [5, 1]], 'p', 's').sorted).toBe(true);
    expect(readXYData([1, 2, 3], 'p', 's').sorted).toBe(true);
    expect(readXYData([[2, 1], [1, 1]], 'p', 's').sorted).toBe(false);
  });
});
