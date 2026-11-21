// Layout (layout.md, axes.md, legend.md, direction.md): where the title, the legend, the axes and the plot area go.
// Step 1.6. A fixed-width fake font makes every expectation computable by hand: tick labels and legend 6 px a
// character, title 10 px, line height 12 px (title 18 px). Constants from layout.ts: margin 8, title gap 8, legend
// gap 12, sign 16 × 12 + 6, item gap 16, tick 5, label gap 3, label padding 2.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout, type ChartLayout } from '../src/layout.js';
import { types } from './helpers/types.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (text, font) => ({ width: [...text].length * PER_CHAR[font], ascent: font === 'title' ? 14 : 9, descent: font === 'title' ? 4 : 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

function lay(options: unknown, width = 600, height = 400, dir: 'ltr' | 'rtl' = 'ltr'): ChartLayout {
  const { model } = normalize(options, types);
  return layout({ model, types, width, height, dir, measureText, text, locale: 'en-US' });
}
const axis = (l: ChartLayout, id: string) => l.axes.find((a) => a.id === id)!;
const labels = (l: ChartLayout, id: string) => axis(l, id).ticks.map((t) => t.label?.text ?? null);

const ONE_LINE = { series: [{ type: 'line', data: [13, 40, 87, 60, 20] }] };

describe('layout: the plot area (layout.md 2)', () => {
  it('one line series: margin, y axis at the start, x axis at the bottom', () => {
    const l = lay(ONE_LINE);
    // y labels 0…100, widest « 100 » 18 px: 18 + 2 + 3 + 5 = 28; x axis 5 + 3 + 12 = 20.
    expect(l.plot).toEqual({ x: 36, y: 8, width: 556, height: 364 });
    expect(labels(l, 'y')).toEqual(['0', '20', '40', '60', '80', '100']);
    expect(labels(l, 'x')).toEqual(['0', '1', '2', '3', '4']);
    expect(axis(l, 'y').edge).toBe('x-min');
    expect(axis(l, 'x').edge).toBe('bottom');
  });

  it('ticks sit on the plot\'s edges: y 0 at the bottom, x from the first point to the last (axes.md 2–3)', () => {
    const l = lay(ONE_LINE);
    const y = axis(l, 'y').ticks;
    const x = axis(l, 'x').ticks;
    expect([y[0]!.at, y[5]!.at]).toEqual([372, 8]);
    expect([x[0]!.at, x[4]!.at]).toEqual([36, 592]);
  });

  it('labels: y right against the axis, x centred under their tick', () => {
    const l = lay(ONE_LINE);
    expect(axis(l, 'y').ticks[0]!.label).toMatchObject({ text: '0', x: 28, y: 372, anchor: 'end', baseline: 'middle' });
    expect(axis(l, 'x').ticks[0]!.label).toMatchObject({ text: '0', x: 36, y: 380, anchor: 'middle', baseline: 'top' });
  });

  it('gridlines from the value axis only, by default (axes.md 16)', () => {
    const l = lay(ONE_LINE);
    expect([axis(l, 'y').grid, axis(l, 'x').grid]).toEqual([true, false]);
  });
});

describe('layout: title and legend (layout.md 2–3, legend.md 1–3)', () => {
  const OPTIONS = { title: 'Ventes', series: [{ type: 'line', name: 'A', data: [13, 40, 87, 60, 20] }, { type: 'line', name: 'B', data: [20, 30, 50, 70, 80] }] };

  it('the title on top, the legend under, the plot between', () => {
    const l = lay(OPTIONS);
    // Title 8–26, gap 8 → 34. Legend row 380–392, gap 12 → axes end at 368; x axis 20 → plot ends at 348.
    // Plot height 314 → target 5 → ticks every 25.
    expect(l.plot).toEqual({ x: 36, y: 34, width: 556, height: 314 });
    expect(labels(l, 'y')).toEqual(['0', '25', '50', '75', '100']);
    expect(l.title[0]).toMatchObject({ text: 'Ventes', x: 8, y: 8, anchor: 'start', baseline: 'top', font: 'title' });
  });

  it('legend items: sign then name, centred, in series order', () => {
    const l = lay(OPTIONS);
    // Each item 16 + 6 + 6 = 28; row 28 + 16 + 28 = 72, from 8 + (584 − 72) / 2 = 264.
    expect(l.legend!.box).toEqual({ x: 264, y: 380, width: 72, height: 12 });
    expect(l.legend!.items.map((i) => [i.seriesId, i.sign.x, i.label.x, i.label.text])).toEqual([['#1', 264, 286, 'A'], ['#2', 308, 330, 'B']]);
    expect(l.legend!.items[0]!.label).toMatchObject({ y: 386, anchor: 'start', baseline: 'middle', font: 'legend' });
  });

  it('a series without a name takes its translated place name (legend.md 4)', () => {
    const l = lay({ series: [{ type: 'line', data: [1] }, { type: 'line', data: [2] }] });
    expect(l.legend!.items.map((i) => i.label.text)).toEqual(['Série 1', 'Série 2']);
  });
});

describe('layout: right to left (direction.md)', () => {
  it('the y axis at the start, now on the right; x still runs left to right', () => {
    const l = lay(ONE_LINE, 600, 400, 'rtl');
    expect(l.plot).toEqual({ x: 8, y: 8, width: 556, height: 364 });
    expect(axis(l, 'y').edge).toBe('x-max');
    // « end » of a right-to-left label is its left edge: the label starts right of the axis.
    expect(axis(l, 'y').ticks[0]!.label).toMatchObject({ x: 572, anchor: 'end', dir: 'rtl' });
    expect([axis(l, 'x').ticks[0]!.at, axis(l, 'x').ticks[4]!.at]).toEqual([8, 564]);
  });

  it('mirror runs x from right to left (D.10)', () => {
    const l = lay({ ...ONE_LINE, mirror: true }, 600, 400, 'rtl');
    expect([axis(l, 'x').ticks[0]!.at, axis(l, 'x').ticks[4]!.at]).toEqual([564, 8]);
  });

  it('legend items flow from the start: the first series rightmost', () => {
    const l = lay({ series: [{ type: 'line', name: 'A', data: [1] }, { type: 'line', name: 'B', data: [2] }] }, 600, 400, 'rtl');
    const [a, b] = l.legend!.items;
    expect(a!.sign.x).toBeGreaterThan(b!.sign.x);
    expect(a!.label.x).toBeLessThan(a!.sign.x);
  });
});

describe('layout: category labels across (axes.md 13–15)', () => {
  const columns = (names: readonly string[]) => ({ series: [{ type: 'column', data: names.map((n, i) => [n, i + 1]) }] });

  it('short labels stay level, one under each band', () => {
    const l = lay(columns(['Jan', 'Feb', 'Mar']));
    expect(labels(l, 'x')).toEqual(['Jan', 'Feb', 'Mar']);
    expect(axis(l, 'x').ticks.every((t) => !t.label?.rotate)).toBe(true);
  });

  it('labels too wide for their band turn by 45°', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Category-${String(i).padStart(5, 'A')}`);
    const l = lay(columns(names));
    expect(labels(l, 'x')).toEqual(names);
    expect(axis(l, 'x').ticks[0]!.label).toMatchObject({ rotate: -45, anchor: 'end' });
  });

  it('still too many: every third label, the first one shown, the same step all along', () => {
    const names = Array.from({ length: 60 }, (_, i) => `C${i}`);
    const shown = labels(lay(columns(names)), 'x').map((t, i) => (t === null ? null : i)).filter((i) => i !== null);
    expect(shown).toEqual(Array.from({ length: 20 }, (_, i) => i * 3));
  });

  it('a label too long even turned ends with « … » within a third of the height', () => {
    const long = 'L'.repeat(60);
    const l = lay(columns(['a', long, 'b']));
    // Turned, a label of w px takes (w + 12) × sin 45° in height: within 400 / 3, w ≤ 176: 28 letters and « … ».
    expect(labels(l, 'x')[1]).toBe(`${'L'.repeat(28)}…`);
  });
});

describe('layout: bars (columns-bars.md 4)', () => {
  const BARS = { series: [{ type: 'bar', data: [['A', 10], ['B', 20], ['C', 30]] }] };

  it('categories down the start side, the first on top; values along the bottom from the start', () => {
    const l = lay(BARS);
    expect(axis(l, 'x').edge).toBe('x-min');
    expect(axis(l, 'y').edge).toBe('bottom');
    const cats = axis(l, 'x').ticks;
    expect(cats[0]!.at).toBeLessThan(cats[2]!.at);
    const vals = axis(l, 'y').ticks;
    expect(vals[0]!.value).toBe(0);
    expect(vals[0]!.at).toBe(l.plot.x);
  });

  it('right to left: bars grow from the right', () => {
    const l = lay(BARS, 600, 400, 'rtl');
    expect(axis(l, 'x').edge).toBe('x-max');
    expect(axis(l, 'y').ticks[0]!.at).toBe(l.plot.x + l.plot.width);
  });
});

describe('layout: two value axes (axes.md 9)', () => {
  it('the second on the far side, on the first one\'s gridlines, without its own', () => {
    const l = lay({ series: [{ type: 'line', data: [13, 87] }, { type: 'line', data: [1000, 4800], yAxis: 'y2' }], yAxis: [{}, { opposite: true }] });
    expect(axis(l, 'y2').edge).toBe('x-max');
    // Pixels, to a billionth (the scene snaps them to the pixel grid at step 1.8).
    const first = axis(l, 'y').ticks.map((t) => t.at);
    const second = axis(l, 'y2').ticks.map((t) => t.at);
    expect(second.length).toBe(first.length);
    second.forEach((v, i) => expect(v).toBeCloseTo(first[i]!, 9));
    expect(axis(l, 'y2').grid).toBe(false);
  });
});

describe('layout: little room, no data, a failing formatter', () => {
  it('too small for axes (under 120 × 80): only the plot (layout.md 5)', () => {
    const l = lay({ title: 'T', series: [{ type: 'line', data: [1, 2] }, { type: 'line', data: [3] }] }, 100, 60);
    expect(l.plot).toEqual({ x: 8, y: 8, width: 84, height: 44 });
    expect([l.axes.length, l.title.length, l.legend]).toEqual([0, 0, null]);
  });

  it('the plot keeps 40 % of the height: the legend gives way first (layout.md 4)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ type: 'line', name: `Series ${i}`, data: [i] }));
    const l = lay({ title: 'A title', series: many }, 600, 200);
    expect(l.plot.height).toBeGreaterThanOrEqual(80);
    expect(l.legend!.items.length).toBeLessThan(30);
    expect(l.legend!.items.at(-1)!.label.text.endsWith('…')).toBe(true);
  });

  it('no data: axes without labels, the plot says so (axes.md 6)', () => {
    const l = lay({ series: [{ type: 'line', data: [] }] });
    expect(axis(l, 'y').ticks.every((t) => t.label === null)).toBe(true);
    expect(l.noData).toMatchObject({ text: 'Aucune donnée', anchor: 'middle', baseline: 'middle', x: l.plot.x + l.plot.width / 2 });
  });

  it('a formatter that throws: the default label, one Problem', () => {
    const l = lay({ ...ONE_LINE, yAxis: { ticks: { format: () => { throw new Error('app bug'); } } } });
    expect(labels(l, 'y')).toEqual(['0', '20', '40', '60', '80', '100']);
    expect(l.problems).toEqual([{ code: 'callback-failed', path: 'yAxis[0].ticks.format' }]);
  });
});
