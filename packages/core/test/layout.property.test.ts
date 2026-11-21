// Layout's promises for any options and any size (fast-check): it never throws, the plot stays inside the chart, and
// from the smallest size that shows axes on, the plot keeps 40 % of each side (layout.md 4–5). Step 1.6.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { TextMeasurer } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { types } from './helpers/types.js';

const measureText: TextMeasurer = (text, font) => ({ width: [...text].length * (font === 'title' ? 10 : 6), ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

const word = fc.string({ minLength: 0, maxLength: 40 });
const value = fc.oneof(fc.double({ min: -1e12, max: 1e12, noNaN: true }), fc.constant(null));
const series = fc.record({
  type: fc.constantFrom('line', 'column', 'scatter', 'bar'),
  name: fc.option(word, { nil: undefined }),
  data: fc.oneof(fc.array(value, { maxLength: 40 }), fc.array(fc.tuple(word, value), { maxLength: 40 })),
  yAxis: fc.constantFrom(undefined, 'y', 'y2'),
});
const options = fc.record({
  title: fc.option(word, { nil: undefined }),
  series: fc.array(series, { maxLength: 12 }),
  yAxis: fc.constantFrom(undefined, [{}, { opposite: true, title: 'Second' }]),
  xAxis: fc.constantFrom(undefined, { title: 'Months' }),
  legend: fc.constantFrom(undefined, true, { position: 'end' }, { position: 'top', align: 'start' }),
  mirror: fc.boolean(),
});

describe('layout, for any options and size', () => {
  it('never throws; the plot stays inside; past the smallest size it keeps 40 % of each side', () => {
    fc.assert(
      fc.property(options, fc.integer({ min: 40, max: 1600 }), fc.integer({ min: 40, max: 1000 }), fc.constantFrom('ltr', 'rtl'), (o, width, height, dir) => {
        const { model } = normalize(o, types);
        const l = layout({ model, types, width, height, dir: dir as 'ltr' | 'rtl', measureText, text, locale: 'fr-FR' });
        expect(l.plot.x).toBeGreaterThanOrEqual(0);
        expect(l.plot.y).toBeGreaterThanOrEqual(0);
        expect(l.plot.x + l.plot.width).toBeLessThanOrEqual(width);
        expect(l.plot.y + l.plot.height).toBeLessThanOrEqual(height);
        // No label leaves the chart across (the bars' last value, a turned category's first letters).
        for (const ax of l.axes)
          for (const t of ax.ticks) {
            const lab = t.label;
            if (!lab || (ax.edge !== 'bottom' && ax.edge !== 'top')) continue;
            const w = measureText(lab.text, lab.font).width;
            if (lab.rotate) expect(lab.x - (w + 12) * Math.SQRT1_2).toBeGreaterThanOrEqual(-0.5);
            else {
              expect(lab.x - w / 2).toBeGreaterThanOrEqual(-0.5);
              expect(lab.x + w / 2).toBeLessThanOrEqual(width + 0.5);
            }
          }
        if (width >= 120 && height >= 80) {
          expect(l.plot.width).toBeGreaterThanOrEqual(0.4 * width - 1);
          expect(l.plot.height).toBeGreaterThanOrEqual(0.4 * height - 1);
        }
      }),
      { numRuns: 400 },
    );
  });
});
