// The Phase 1 code review's findings (2026-11-21), each reproduced first, then fixed. Numbers are the review's.
import { describe, it, expect } from 'vitest';
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { area, bar, column, line, scatter } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout, type ChartLayout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { formatTicks } from '../src/format.js';
import { readXYData } from '../src/data.js';

const types = [line, area, column, bar, scatter];
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

function run(options: unknown, width = 600, height = 400): { l: ChartLayout; scene: Scene; problems: string[] } {
  const { model, problems } = normalize(options, types);
  const l = layout({ model, types, width, height, dir: 'ltr', measureText, text, locale: 'en-US' });
  return { l, scene: composeScene({ model, types, layout: l, measureText }), problems: [...problems, ...l.problems].map((p) => `${p.code} ${p.path}`) };
}
const axis = (l: ChartLayout, id: string) => l.axes.find((a) => a.id === id)!;
const seriesItems = (s: Scene) => s.layers.find((l) => l.id === 'series')!.groups.flatMap((g) => g.items);

describe('review 2: an x axis and a y axis with one id', () => {
  it('is reported; each series keeps its own axes', () => {
    const r = run({ xAxis: { id: 'main' }, yAxis: { id: 'main' }, series: [{ type: 'line', data: [[0, 100], [10, 200]] }] });
    expect(r.problems).toContain('duplicate-id yAxis[0].id');
    for (const p of seriesItems(r.scene)) if (p.kind === 'marker') expect(p.y).toBeLessThanOrEqual(400);
  });
});

describe('review 3: a null among pairs or points', () => {
  it('is a gap without an x: the axis does not reach 0, the series stays sorted', () => {
    const d = readXYData([[1000, 1], null, [1002, 3]], 'p', 's');
    expect(d.sorted).toBe(true);
    if (d.x.kind === 'values') expect(Number.isNaN(d.x.numbers[1]!)).toBe(true);
    const r = run({ series: [{ type: 'line', data: [[1000, 1], null, [1002, 3]] }] });
    expect(axis(r.l, 'x').ticks[0]!.value).toBeGreaterThanOrEqual(1000);
  });
});

describe('review 4: a point without a usable x inside a sorted line', () => {
  it('is a gap; the points after it are still drawn', () => {
    const r = run({ series: [{ type: 'line', data: [[0, 1], [1, 2], [2, 3], [Infinity, 4], [Infinity, 4], [6, 5]] }] });
    const path = seriesItems(r.scene).find((p) => p.kind === 'path');
    expect(path?.kind).toBe('path');
    if (path?.kind !== 'path') return;
    const xs = path.path.coords.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBe(r.l.plot.x + r.l.plot.width);
  });
});

describe('review 5: columns past the axis\'s bounds', () => {
  it('stay inside the plot', () => {
    const r = run({ yAxis: { min: 50 }, series: [{ type: 'column', data: [60, 70] }] });
    const { plot } = r.l;
    for (const p of seriesItems(r.scene))
      if (p.kind === 'rect') {
        expect(p.y).toBeGreaterThanOrEqual(plot.y);
        expect(p.y + p.height).toBeLessThanOrEqual(plot.y + plot.height);
      }
  });
});

describe('review 6: short forms in locales that count otherwise', () => {
  it('Japanese counts in ten thousands: labels still tell ticks apart', () => {
    const labels = formatTicks([10000, 12000, 14000, 16000, 18000, 20000], 2000, 'ja');
    expect(new Set(labels).size).toBe(6);
  });

  it('German does not shorten thousands: no needless decimals', () => {
    const labels = formatTicks([0, 5000, 10000, 15000], 5000, 'de-DE');
    expect(labels.some((l) => l.includes(','))).toBe(false);
  });
});

describe('review 7: one bound given', () => {
  it('the other end is still rounded (axes.md 2, 4)', () => {
    const r = run({ yAxis: { min: 0 }, series: [{ type: 'line', data: [13, 87] }] });
    expect(axis(r.l, 'y').ticks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('a bound on the wrong side of the data is reported and left out', () => {
    const r = run({ yAxis: { min: 50 }, series: [{ type: 'line', data: [1, 10] }] });
    expect(r.problems).toContain('invalid-option yAxis[0].min');
    const ticks = axis(r.l, 'y').ticks.map((t) => t.value);
    expect(ticks[0]).toBeLessThanOrEqual(1);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(10);
  });
});

describe('review 8: a second axis beside a first with fixed bounds', () => {
  it('still sits on the first one\'s gridlines (axes.md 9)', () => {
    const r = run({ yAxis: [{ min: 0, max: 90 }, { opposite: true }], series: [{ type: 'line', data: [10, 80] }, { type: 'line', yAxis: 'y2', data: [1000, 4800] }] });
    const first = axis(r.l, 'y').ticks.map((t) => t.at);
    const second = axis(r.l, 'y2').ticks.map((t) => t.at);
    expect(second.length).toBe(first.length);
    second.forEach((v, i) => expect(v).toBeCloseTo(first[i]!, 6));
  });
});

describe('review 9: a category axis with fewer categories than points', () => {
  it('gets a band per point, the extra ones named by their position, reported', () => {
    const r = run({ xAxis: { scale: 'category', categories: ['a'] }, series: [{ type: 'column', id: 's', data: [1, 2, 3] }] });
    expect(axis(r.l, 'x').ticks.map((t) => t.label?.text)).toEqual(['a', '1', '2']);
    expect(r.problems).toContain('invalid-data series[0].data[1]');
    for (const p of seriesItems(r.scene)) if (p.kind === 'rect') expect(p.x + p.width).toBeLessThanOrEqual(r.l.plot.x + r.l.plot.width);
  });
});

describe('review 10: x going backwards in a line', () => {
  it('is reported once (line-area.md 8)', () => {
    expect(run({ series: [{ type: 'line', data: [[2, 1], [1, 1], [0, 1]] }] }).problems).toEqual(['unsorted-x series[0].data']);
    expect(run({ series: [{ type: 'scatter', data: [[2, 1], [1, 1]] }] }).problems).toEqual([]);
  });
});

describe('review 11: a title of one long word', () => {
  it('ends with « … » within the chart (layout.md 3)', () => {
    const r = run({ title: 'W'.repeat(60), series: [] }, 200, 300);
    const t = r.l.title[0]!;
    expect(t.text.endsWith('…')).toBe(true);
    expect(measureText(t.text, 'title').width).toBeLessThanOrEqual(200 - 16);
  });
});

describe('review 14b: a series of gaps only', () => {
  it('is no data (axes.md 6)', () => {
    expect(run({ series: [{ type: 'line', data: [null, null] }] }).l.noData).not.toBeNull();
  });
});

describe('review 1: a locale Intl refuses', () => {
  it('formats in the default locale instead of throwing', () => {
    expect(formatTicks([0, 1], 1, 'en_US')).toEqual(formatTicks([0, 1], 1, undefined));
  });
});

describe('architecture check (2026-11-21): seams for the next phases', () => {
  it('a scale accepted early is drawn once its phase comes: log since Phase 4, no longer reported', () => {
    const r = run({ yAxis: { scale: 'log' }, series: [{ type: 'line', data: [1, 10, 100] }] });
    expect(r.problems).not.toContain('not-available yAxis[0].scale');
  });

  it('the view hides a series without touching the options (legend clicks, Phase 2)', () => {
    const { model } = normalize({ series: [{ type: 'line', id: 'a', data: [1, 2] }, { type: 'line', id: 'b', data: [100, 200] }] }, types);
    const view = { hidden: new Set(['b']) };
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view });
    // Only « a » counts for the axis, and only it is drawn; « b » keeps its legend item, greyed.
    expect(axis(l, 'y').ticks.at(-1)!.value).toBeLessThan(100);
    const scene = composeScene({ model, types, layout: l, measureText, view });
    expect(scene.layers.find((x) => x.id === 'series')!.groups.every((g) => g.sceneId.startsWith('s/a/'))).toBe(true);
    expect(l.legend!.items.map((i) => [i.seriesId, i.hidden])).toEqual([['a', false], ['b', true]]);
  });

  it('every type in one import, for apps that do not count bytes (ADR 0005)', async () => {
    const { allTypes } = await import('@dzgraph/core');
    expect(allTypes.map((t) => t.name)).toEqual(['line', 'area', 'column', 'bar', 'scatter', 'pie', 'donut', 'gauge']);
  });
});
