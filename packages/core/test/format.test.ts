// Tick labels (axes.md 10–12): the chart's locale through Intl, one count of decimals per axis, short forms past
// 10 000. Runs in node and in every browser engine (Intl differs, spike S4). Expectations written by hand from CLDR's
// published forms: French groups with a narrow no-break space (U+202F) and writes « k » and « M » after one.
import { describe, it, expect } from 'vitest';
import { formatTicks } from '../src/format.js';

const NNBSP = ' ';
const NBSP = ' ';

describe('formatTicks', () => {
  it('English: groups, the fewest decimals that tell ticks apart, the same for all', () => {
    expect(formatTicks([0, 0.5, 1, 1.5], 0.5, 'en-US')).toEqual(['0.0', '0.5', '1.0', '1.5']);
    expect(formatTicks([0, 2000, 4000, 6000], 2000, 'en-US')).toEqual(['0', '2,000', '4,000', '6,000']);
    expect(formatTicks([0, 0.25, 0.5], 0.25, 'en-US')).toEqual(['0.00', '0.25', '0.50']);
  });

  it('French: decimal comma, narrow no-break space between groups', () => {
    expect(formatTicks([1234.5, 1235], 0.5, 'fr-FR')).toEqual([`1${NNBSP}234,5`, `1${NNBSP}235,0`]);
  });

  it('past 10 000, short forms of the locale', () => {
    expect(formatTicks([0, 5000, 10000, 15000], 5000, 'en-US')).toEqual(['0', '5K', '10K', '15K']);
    expect(formatTicks([0, 2500000, 5000000], 2500000, 'en-US')).toEqual(['0', '2.5M', '5.0M']);
    expect(formatTicks([0, 20000, 40000], 20000, 'fr-FR')).toEqual(['0', `20${NBSP}k`, `40${NBSP}k`]);
  });

  it('scientific notation for numbers too small or too large to read in full (axes.md 12)', () => {
    expect(formatTicks([1.5e-75, 2e-75, 2.5e-75], 5e-76, 'en-US')).toEqual(['1.5E-75', '2.0E-75', '2.5E-75']);
    // 5E15 and 1E16 are told apart without decimals (axes.md 11: the fewest).
    expect(formatTicks([0, 5e15, 1e16], 5e15, 'en-US')).toEqual(['0', '5E15', '1E16']);
  });

  it('never writes minus zero', () => {
    expect(formatTicks([-1, -0, 1], 1, 'en-US')).toEqual(['-1', '0', '1']);
  });
});
