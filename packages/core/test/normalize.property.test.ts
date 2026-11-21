// The two promises of reading options, for any input (fast-check): it never throws, and no value from the data ever
// reaches a Problem (a chart may plot health records). Step 1.4.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalize } from '../src/normalize.js';
import { types } from './helpers/types.js';

/** Values only the data holds: if one shows up in a Problem, data leaked. */
const SECRET_TEXT = 'Zq-secret-7731';
const SECRET_NUMBER = 987654.321;

const secretValue = fc.oneof(fc.constant(SECRET_TEXT), fc.constant(SECRET_NUMBER), fc.constant(-SECRET_NUMBER), fc.constant(`${SECRET_TEXT}-key`));
const anyValue = fc.oneof(fc.anything(), secretValue, fc.double(), fc.constant(null), fc.constant(Number.NaN), fc.constant(Infinity));
const point = fc.oneof(anyValue, fc.tuple(anyValue, anyValue), fc.record({ x: anyValue, y: anyValue, key: anyValue, name: anyValue }, { requiredKeys: [] }));
const data = fc.oneof(fc.array(point, { maxLength: 30 }), fc.record({ x: fc.array(anyValue, { maxLength: 10 }), y: fc.array(anyValue, { maxLength: 10 }), key: fc.array(anyValue, { maxLength: 10 }) }, { requiredKeys: ['y'] }), anyValue);
const series = fc.record(
  {
    type: fc.oneof(fc.constantFrom('line', 'column', 'bar', 'pie'), fc.anything()),
    id: fc.oneof(fc.string(), fc.anything()),
    name: fc.anything(),
    data,
    color: fc.anything(),
    xAxis: fc.anything(),
    yAxis: fc.anything(),
    marker: fc.anything(),
    initiallyHidden: fc.anything(),
  },
  { requiredKeys: ['type', 'data'] },
);
const options = fc.oneof(
  fc.record({ series: fc.array(series, { maxLength: 5 }), xAxis: fc.anything(), yAxis: fc.anything(), legend: fc.anything(), title: fc.anything(), locale: fc.anything(), dir: fc.anything(), aspectRatio: fc.anything() }, { requiredKeys: ['series'] }),
  fc.anything(),
);

describe('normalize, for any input', () => {
  it('never throws, and always gives a model with at least one axis of each kind', () => {
    fc.assert(
      fc.property(options, (o) => {
        const { model } = normalize(o, types);
        expect(model.xAxes.length).toBeGreaterThan(0);
        expect(model.yAxes.length).toBeGreaterThan(0);
      }),
      { numRuns: 600 },
    );
  });

  it('never puts a value of the data in a Problem', () => {
    fc.assert(
      fc.property(options, (o) => {
        const text = JSON.stringify(normalize(o, types).problems);
        expect(text).not.toContain(SECRET_TEXT);
        expect(text).not.toContain(String(SECRET_NUMBER));
      }),
      { numRuns: 600 },
    );
  });

  it('survives an object whose getter throws', () => {
    const hostile = { get series(): never { throw new Error('boom'); } };
    expect(normalize(hostile, types).problems).toEqual([{ code: 'invalid-option', path: '' }]);
  });
});
