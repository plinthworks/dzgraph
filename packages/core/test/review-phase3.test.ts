// Phase 3 code review findings, each a failing case first. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalizeFull as normalize } from './helpers/kit.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { clampRange, extentOf } from '../src/zoom.js';
import { timeTicks, wallOf } from '../src/time.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

describe('review 1: a category zoom fits the value axis to the categories it shows', () => {
  it('a range of 1.4 to 3.6 shows categories 1 to 4, and the axis holds the bar at 4', () => {
    const { model } = normalize({ xAxis: { scale: 'category', categories: ['a', 'b', 'c', 'd', 'e'] }, series: [{ type: 'column', data: [1, 2, 3, 2, 90] }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view: { range: { x: { min: 1.4, max: 3.6 } } } });
    expect(l.axes.find((a) => a.id === 'x')!.ticks.map((t) => t.label?.text)).toEqual(['b', 'c', 'd', 'e']);
    expect(l.axes.find((a) => a.id === 'y')!.ticks.at(-1)!.value).toBeGreaterThanOrEqual(90);
  });
});

describe('review 3: a scatter narrower than one unit can be zoomed', () => {
  it('x from 0 to 0.5: the narrowest range is not the whole', () => {
    const { model } = normalize({ series: [{ type: 'scatter', data: [[0, 1], [0.5, 2], [0.2, 3]] }] }, types);
    const e = extentOf(model, 'x')!;
    expect(clampRange({ min: 0.1, max: 0.2 }, e)).toEqual({ min: 0.1, max: 0.2 });
  });
});

describe('review 4: a day the clock skipped gives no tick twice', () => {
  it('Pacific/Apia skipped 30 December 2011', () => {
    const t = timeTicks(utc(2011, 12, 28, 10), utc(2011, 12, 31, 20), 3, 'Pacific/Apia');
    expect(t.unit).toBe('day');
    expect(new Set(t.values).size).toBe(t.values.length);
  });
});

describe('review 5: minute steps in zones a quarter or three quarters of an hour off', () => {
  it('Kathmandu (+5:45): ten-minute ticks fall on :00, :10, :20…', () => {
    const t = timeTicks(utc(2026, 3, 5, 6, 0), utc(2026, 3, 5, 7, 0), 6, 'Asia/Kathmandu');
    expect([t.unit, t.step]).toEqual(['minute', 10]);
    expect(t.values.map((v) => wallOf(v, 'Asia/Kathmandu').mi)).toEqual([50, 0, 10, 20, 30, 40]);
  });
});

describe('review 11: the navigator draws an unsorted series without its points lacking x', () => {
  it('a NaN x is left out, the rest in x order', () => {
    const { model } = normalize({ navigator: true, series: [{ type: 'scatter', id: 's', data: { x: Float64Array.of(3, Number.NaN, 1, 2), y: Float64Array.of(30, 99, 10, 20) } }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const scene = composeScene({ model, types, layout: l, measureText });
    const path = scene.layers.find((x) => x.id === 'navigator')!.groups.flatMap((g) => g.items).find((p) => p.sceneId === 'nav/series/s')!;
    expect(path.kind === 'path' && [...path.path.commands]).toEqual([0, 1, 1]);
    const nav = l.navigator!;
    const xs = path.kind === 'path' ? [path.path.coords[0], path.path.coords[2], path.path.coords[4]] : [];
    expect(xs).toEqual([nav.map(1), nav.map(2), nav.map(3)]);
  });
});
