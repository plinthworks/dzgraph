// The gauge (gauge.md, ADR 0007): one value on a half ring, filled along the reading direction, its value, scale and
// threshold written, read by screen readers as a meter, one row in the table. Phase 4 step 6. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { tooltipOf } from '../src/tooltip.js';
import { dataTable, pointLabel } from '../src/a11y.js';
import { appearFrom } from '../src/interpolate.js';
import type { ArcPrimitive, Primitive } from '../src/scene.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…', pointName: (n: number) => `Slice ${n}`, others: 'Others', total: 'Total' };
function build(series: object, dir: 'ltr' | 'rtl' = 'ltr') {
  const { model, problems } = normalize({ series: [{ type: 'gauge', id: 'g', name: 'Load', ...series }] }, types);
  const l = layout({ model, types, width: 600, height: 400, dir, measureText, text, locale: 'en-US' });
  const scene = composeScene({ model, types, layout: l, measureText });
  const all: Primitive[] = scene.layers.flatMap((x) => x.groups.flatMap((g) => g.items));
  const arcs = all.filter((p): p is ArcPrimitive => p.kind === 'arc');
  const texts = all.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
  return { model, problems, l, scene, arcs, texts };
}
const H = Math.PI / 2;
const turn = (a: ArcPrimitive) => [+(a.startAngle / H).toFixed(6), +(a.endAngle / H).toFixed(6)];

describe('reading (gauge.md 1, 12)', () => {
  it('a number, or one in an array; the scale 0–100 by default', () => {
    for (const data of [72, [72]]) {
      const { model, problems } = build({ data });
      expect(problems).toEqual([]);
      expect(Array.from(model.series[0]!.columns.y)).toEqual([72]);
    }
  });

  it('a scale whose min is not below its max is reported, the defaults used', () => {
    const { problems, arcs } = build({ data: 50, min: 10, max: 10 });
    expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].min' }]);
    expect(turn(arcs.find((a) => a.point)!)).toEqual([-1, 0]);
  });
});

describe('drawn (gauge.md 2–6)', () => {
  it('a half ring: the track whole, the value from the start, a quarter of the radius thick', () => {
    const { arcs, texts } = build({ data: 72 });
    const track = arcs.find((a) => !a.point && a.paint.fill === 'track')!;
    const value = arcs.find((a) => a.point)!;
    expect(turn(track)).toEqual([-1, 1]);
    expect(turn(value)).toEqual([-1, 0.44]);
    expect(value.paint.fill).toBe('series-1');
    expect(value.innerRadius).toBeCloseTo(value.outerRadius * 0.75, 6);
    expect(texts).toEqual(expect.arrayContaining(['72', '0', '100']));
  });

  it('right to left: it fills from the right end', () => {
    expect(turn(build({ data: 72 }, 'rtl').arcs.find((a) => a.point)!)).toEqual([-0.44, 1]);
  });

  it('past the scale: full, the real value written; no value: an empty track and a dash', () => {
    const over = build({ data: 150 });
    expect(turn(over.arcs.find((a) => a.point)!)).toEqual([-1, 1]);
    expect(over.texts).toContain('150');
    const none = build({ data: null });
    expect(none.arcs.some((a) => a.point)).toBe(false);
    expect(none.texts).toContain('—');
  });

  it('thresholds: a thin ring outside, one segment each; the value\'s written under it', () => {
    const { arcs, texts } = build({ data: 85, thresholds: [{ from: 0, to: 80, label: 'Normal', color: 'calm' }, { from: 80, to: 100, label: 'High', color: 'alert' }] });
    const value = arcs.find((a) => a.point)!;
    const ring = arcs.filter((a) => !a.point && a.paint.fill !== 'track');
    expect(ring.map((a) => [a.paint.fill, ...turn(a)])).toEqual([['color-calm', -1, 0.6], ['color-alert', 0.6, 1]]);
    expect(ring[0]!.innerRadius).toBeGreaterThan(value.outerRadius);
    expect(texts).toContain('High');
  });

  it('a bad threshold is reported and left out', () => {
    const { problems } = build({ data: 1, thresholds: [{ from: 5, to: 2 }] });
    expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].thresholds[0]' }]);
  });
});

describe('read (gauge.md 7–11)', () => {
  const G = { data: 85, thresholds: [{ from: 80, to: 100, label: 'High', color: 'alert' }] };

  it('the tooltip: the value, then the scale and the threshold', () => {
    const { model, l } = build(G);
    const t = tooltipOf(model, l, { points: [{ seriesId: 'g', index: 0 }] }, 'en-US', text);
    expect([t.heading, t.rows.map((r) => r.value), t.range, t.threshold]).toEqual(['Load', ['85'], { min: '0', max: '100' }, 'High']);
  });

  it('a meter for screen readers: value, bounds, threshold', () => {
    const { model, l } = build(G);
    expect(pointLabel(model, l, { seriesId: 'g', index: 0 }, 'en-US', text)).toEqual({ series: 'Load', x: 'Load', y: '85', meter: { min: '0', max: '100', threshold: 'High', now: 85, low: 0, high: 100 }, position: 1, count: 1 });
  });

  it('one row in the table: value, bounds, threshold', () => {
    const { model, l } = build(G);
    const t = dataTable(model, l, undefined, 'en-US', { ...text, meter: { min: 'Minimum', max: 'Maximum', threshold: 'Threshold' } });
    expect([t.columns, t.rows]).toEqual([['Load', 'Minimum', 'Maximum', 'Threshold'], [['Load', '85', '0', '100', 'High']]]);
  });

  it('appearing: the value fills from the scale\'s start; the track is there at once', () => {
    const { scene } = build({ data: 72 });
    const start = appearFrom(scene).layers.flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p): p is ArcPrimitive => p.kind === 'arc');
    expect(start.map(turn)).toEqual([[-1, 1], [-1, -1]]);
  });
});

describe('the summary (gauge.md 9)', () => {
  it('names the gauge, its value, bounds and threshold', async () => {
    const { summary } = await import('../src/a11y.js');
    const { model, l } = build({ data: 85, thresholds: [{ from: 80, to: 100, label: 'High' }] });
    expect(summary(model, l, undefined, 'en-US', text).meter).toEqual({ name: 'Load', value: '85', min: '0', max: '100', threshold: 'High' });
  });
});

// A richer gauge (gauge.md 13–18, owner 2026-11-24): the owner's example, a scale from −2000 to 2000.
const WIDE = { min: -2000, max: 2000 };
const lines = (scene: ReturnType<typeof build>['scene']) => scene.layers.flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p) => p.kind === 'line') as Extract<Primitive, { kind: 'line' }>[];

describe('origin (gauge.md 13)', () => {
  it('the fill runs from the origin to the value, either way; it grows from the origin', () => {
    // at(v) = (v + 2000) / 4000: −1000 → a quarter of the half turn, 0 → its middle (twelve o'clock).
    const below = build({ ...WIDE, origin: 0, data: -1000 }).arcs.find((a) => a.point)!;
    expect([...turn(below), below.grows]).toEqual([-0.5, 0, 'end']);
    const above = build({ ...WIDE, origin: 0, data: 1000 }).arcs.find((a) => a.point)!;
    expect([...turn(above), above.grows]).toEqual([0, 0.5, 'start']);
  });

  it('right to left: the same, mirrored', () => {
    const below = build({ ...WIDE, origin: 0, data: -1000 }, 'rtl').arcs.find((a) => a.point)!;
    expect([...turn(below), below.grows]).toEqual([0, 0.5, 'start']);
  });

  it('appearing: the fill opens from the origin', () => {
    const { scene } = build({ ...WIDE, origin: 0, data: -1000 });
    const start = appearFrom(scene).layers.flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p): p is ArcPrimitive => p.kind === 'arc');
    expect(start.map(turn)).toEqual([[-1, 1], [0, 0]]);
  });

  it('an origin off the scale, or not a number, is reported; the fill starts at min', () => {
    for (const origin of [5000, 'zero']) {
      const { problems, arcs } = build({ ...WIDE, origin, data: 0 });
      expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].origin' }]);
      expect(turn(arcs.find((a) => a.point)!)).toEqual([-1, 0]);
    }
  });
});

describe('ticks (gauge.md 14)', () => {
  it('a tick every step, a longer one with its number every `labels`; the ends not written twice', () => {
    const { scene, texts } = build({ ...WIDE, data: 300, ticks: { step: 100, labels: 500 } });
    const ticks = lines(scene);
    // −2000, −1900 … 2000: 41 ticks, 9 of them labelled.
    expect(ticks).toHaveLength(41);
    const length = (l: (typeof ticks)[number]) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    const long = ticks.filter((l) => length(l) > length(ticks[1]!) + 0.5);
    expect(long).toHaveLength(9);
    expect(ticks.every((l) => l.paint.stroke === 'tick')).toBe(true);
    for (const n of ['-2,000', '-1,500', '-1,000', '-500', '0', '500', '1,000', '1,500', '2,000']) expect(texts.filter((t) => t === n), n).toHaveLength(1);
    expect(texts).toContain('300');
  });

  it('ticks sit on the multiples of the step, inside the arc, from the reading direction\'s start', () => {
    const ticks = lines(build({ min: -50, max: 50, data: 0, ticks: { step: 25 } }).scene);
    expect(ticks).toHaveLength(5);
    // The first tick (−50) at nine o'clock in left to right: its outer end on the arc's inner edge, left of the centre.
    const cx = (ticks[2]!.x1 + ticks[2]!.x2) / 2;
    expect(ticks[0]!.x1).toBeLessThan(cx);
    const rtl = lines(build({ min: -50, max: 50, data: 0, ticks: { step: 25 } }, 'rtl').scene);
    expect(rtl[0]!.x1).toBeGreaterThan(cx);
  });

  it('numbers that would overlap one placed are left out', () => {
    // 41 numbers around a 280 px arc: far more than fit; never two overlapping (6 px a character, 12 px high).
    const { scene } = build({ ...WIDE, data: 0, ticks: { step: 100, labels: 100 } });
    const nums = scene.layers.flatMap((l) => l.groups.flatMap((g) => g.items)).filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text' && p.font === 'tick-label');
    expect(nums.length).toBeGreaterThan(3);
    expect(nums.length).toBeLessThan(41);
    const box = (t: (typeof nums)[number]) => ({ x0: t.x - (t.text.length * 6) / 2, x1: t.x + (t.text.length * 6) / 2, y0: t.y - 6, y1: t.y + 6 });
    for (const [i, a] of nums.entries())
      for (const b of nums.slice(i + 1)) {
        const [p, q] = [box(a), box(b)];
        expect(p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1, `${a.text} over ${b.text}`).toBe(false);
      }
  });

  it('a step that is not a positive number, or too many ticks, is reported and draws none', () => {
    for (const step of [0, -5, 'x', 1]) {
      const { problems, scene } = build({ ...WIDE, data: 0, ticks: { step } });
      expect(problems, String(step)).toEqual([{ code: 'invalid-option', path: 'series[0].ticks.step' }]);
      expect(lines(scene)).toHaveLength(0);
    }
  });

  it('labels not a multiple of the step: reported, ticks without numbers, the ends still written', () => {
    const { problems, scene, texts } = build({ ...WIDE, data: 0, ticks: { step: 100, labels: 250 } });
    expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].ticks.labels' }]);
    expect(lines(scene)).toHaveLength(41);
    expect(texts.filter((t) => t === '-2,000' || t === '2,000')).toHaveLength(2);
    expect(texts).not.toContain('1,000');
  });
});

describe('thresholds on the track (gauge.md 15, 16)', () => {
  const ZONES = { ...WIDE, origin: 0, thresholdsOn: 'track', thresholds: [{ from: -2000, to: -1500, color: 'cold', label: 'Cold' }, { from: -500, to: 500, color: 'calm', label: 'Normal' }] };

  it('the zones paint the arc itself, the whole thickness; no outer ring', () => {
    const { arcs } = build({ ...ZONES, data: 1200 });
    const track = arcs.find((a) => a.paint.fill === 'track')!;
    const zones = arcs.filter((a) => !a.point && a.paint.fill !== 'track');
    expect(zones.map((a) => [a.paint.fill, ...turn(a)])).toEqual([['color-cold', -1, -0.75], ['color-calm', -0.25, 0.25]]);
    for (const z of zones) expect([z.innerRadius, z.outerRadius]).toEqual([track.innerRadius, track.outerRadius]);
  });

  it('the value: half the thickness, centred, edged with the background', () => {
    const { arcs } = build({ ...ZONES, data: 1200 });
    const track = arcs.find((a) => a.paint.fill === 'track')!;
    const value = arcs.find((a) => a.point)!;
    const t = track.outerRadius - track.innerRadius;
    expect(value.innerRadius).toBeCloseTo(track.innerRadius + t / 4, 6);
    expect(value.outerRadius).toBeCloseTo(track.outerRadius - t / 4, 6);
    expect([value.paint.stroke, value.paint.strokeWidth]).toEqual(['background', 2]);
    expect(turn(value)).toEqual([0, 0.6]);
  });

  it('each zone named outside the arc; the value\'s zone still named under the value', () => {
    expect(build({ ...ZONES, data: 1200 }).texts.filter((t) => t === 'Cold' || t === 'Normal')).toEqual(['Cold', 'Normal']);
    // In « Normal »: once by its zone, once under the value.
    expect(build({ ...ZONES, data: 100 }).texts.filter((t) => t === 'Normal')).toHaveLength(2);
  });

  it('`ring` is the default; another word is reported and the ring kept', () => {
    const { problems, arcs } = build({ ...ZONES, thresholdsOn: 'band', data: 0 });
    expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].thresholdsOn' }]);
    const value = arcs.find((a) => a.point)!;
    expect(arcs.filter((a) => !a.point && a.paint.fill !== 'track').every((a) => a.innerRadius > value.outerRadius)).toBe(true);
  });
});

// A gauge as a bar (gauge.md 19–24, owner 2026-11-24): the same options on a straight bar, across or upright.
type Rect = Extract<Primitive, { kind: 'rect' }>;
// The series layer's rects: the chart's own background is a rect too, in another layer.
const rectsOf = (scene: ReturnType<typeof build>['scene']) => scene.layers.filter((x) => x.id === 'series').flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p): p is Rect => p.kind === 'rect');
function bar(series: object, dir: 'ltr' | 'rtl' = 'ltr') {
  const b = build({ shape: 'bar', ...series }, dir);
  const rects = rectsOf(b.scene);
  return { ...b, rects, track: rects.find((r) => r.paint.fill === 'track')!, value: rects.find((r) => r.point) };
}

describe('the bar (gauge.md 19–21)', () => {
  it('across: a 24 px track, the value from the origin to the value, either way; no arc', () => {
    // at(v) = (v + 2000) / 4000: 0 → the middle, −1000 → a quarter.
    const { arcs, track, value, problems } = bar({ ...WIDE, origin: 0, data: -1000 });
    expect(problems).toEqual([]);
    expect(arcs).toHaveLength(0);
    expect(track.height).toBe(24);
    expect(track.width).toBeGreaterThan(400);
    expect(value!.x).toBeCloseTo(track.x + track.width / 4, 6);
    expect(value!.width).toBeCloseTo(track.width / 4, 6);
    expect([value!.y, value!.height, value!.roundEnd, value!.paint.fill]).toEqual([track.y, 24, 'x-min', 'series-1']);
    const up = bar({ ...WIDE, origin: 0, data: 1000 });
    expect(up.value!.x).toBeCloseTo(up.track.x + up.track.width / 2, 6);
    expect(up.value!.roundEnd).toBe('x-max');
  });

  it('across, right to left: min on the right, mirrored', () => {
    const { track, value } = bar({ ...WIDE, origin: 0, data: -1000 }, 'rtl');
    expect(value!.x).toBeCloseTo(track.x + track.width / 2, 6);
    expect(value!.width).toBeCloseTo(track.width / 4, 6);
    expect(value!.roundEnd).toBe('x-max');
  });

  it('upright: min at the bottom in both directions, 24 px wide', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { track, value } = bar({ ...WIDE, orientation: 'vertical', origin: 0, data: 1000 }, dir);
      expect(track.width, dir).toBe(24);
      expect(track.height).toBeGreaterThan(200);
      expect(value!.y).toBeCloseTo(track.y + track.height / 4, 6);
      expect(value!.height).toBeCloseTo(track.height / 4, 6);
      expect([value!.x, value!.width, value!.roundEnd]).toEqual([track.x, 24, 'y-min']);
    }
  });

  it('no value: the track alone and a dash; past the scale: full', () => {
    const none = bar({ data: null });
    expect([none.value, none.texts.includes('—')]).toEqual([undefined, true]);
    const over = bar({ data: 150 });
    expect([over.value!.x, over.value!.width]).toEqual([over.track.x, over.track.width]);
    expect(over.texts).toContain('150');
  });

  it('another shape, or orientation, is reported: the arc, or the bar across', () => {
    const odd = build({ shape: 'ring', data: 5 });
    expect(odd.problems).toEqual([{ code: 'invalid-option', path: 'series[0].shape' }]);
    expect(odd.arcs.some((a) => a.point)).toBe(true);
    const side = bar({ orientation: 'diagonal', data: 5 });
    expect(side.problems).toEqual([{ code: 'invalid-option', path: 'series[0].orientation' }]);
    expect(side.track.height).toBe(24);
  });

  it('the scale\'s ends written under the bar\'s ends, min first in the reading direction', () => {
    const at = (dir: 'ltr' | 'rtl') => {
      const b = bar({ data: 40 }, dir);
      const x = (t: string) => b.scene.layers.flatMap((l) => l.groups.flatMap((g) => g.items)).find((p) => p.kind === 'text' && p.text === t) as Extract<Primitive, { kind: 'text' }>;
      return { min: x('0'), max: x('100'), track: b.track };
    };
    const l = at('ltr');
    expect(l.min.x).toBeCloseTo(l.track.x, 6);
    expect(l.max.x).toBeCloseTo(l.track.x + l.track.width, 6);
    expect(l.min.y).toBeGreaterThan(l.track.y + l.track.height);
    const r = at('rtl');
    expect(r.min.x).toBeCloseTo(r.track.x + r.track.width, 6);
  });
});

describe('the bar\'s ticks and thresholds (gauge.md 21–23)', () => {
  const ZONES = { ...WIDE, origin: 0, thresholdsOn: 'track', thresholds: [{ from: -2000, to: -1500, color: 'cold', label: 'Cold' }, { from: -500, to: 500, color: 'calm', label: 'Normal' }] };

  it('across: ticks under the bar, pointing down, each number once', () => {
    const { scene, texts, track } = bar({ ...WIDE, data: 300, ticks: { step: 100, labels: 500 } });
    const ticks = lines(scene);
    expect(ticks).toHaveLength(41);
    expect(ticks.every((l) => l.x1 === l.x2 && l.y1 === track.y + track.height && l.y2 > l.y1)).toBe(true);
    expect(ticks[0]!.x1).toBeCloseTo(track.x, 6);
    expect(ticks.filter((l) => l.y2 - l.y1 > 6)).toHaveLength(9);
    for (const n of ['-2,000', '-1,500', '-1,000', '-500', '0', '500', '1,000', '1,500', '2,000']) expect(texts.filter((t) => t === n), n).toHaveLength(1);
  });

  it('upright: ticks on the inline-end side, the bottom one at min', () => {
    const l = bar({ ...WIDE, orientation: 'vertical', data: 0, ticks: { step: 500 } });
    const ticks = lines(l.scene);
    expect(ticks).toHaveLength(9);
    expect(ticks.every((t) => t.y1 === t.y2 && t.x1 === l.track.x + l.track.width && t.x2 > t.x1)).toBe(true);
    expect(ticks[0]!.y1).toBeCloseTo(l.track.y + l.track.height, 6);
    const r = bar({ ...WIDE, orientation: 'vertical', data: 0, ticks: { step: 500 } }, 'rtl');
    expect(lines(r.scene).every((t) => t.x1 === r.track.x && t.x2 < t.x1)).toBe(true);
  });

  it('numbers that would overlap one placed are left out', () => {
    // 41 numbers on 100: far more than fit across ~550 px; never two overlapping.
    const { scene } = bar({ ...WIDE, data: 0, ticks: { step: 100, labels: 100 } });
    const nums = scene.layers.flatMap((l) => l.groups.flatMap((g) => g.items)).filter((p) => p.kind === 'text' && /^-?[\d,]+$/.test(p.text) && p.text !== '0' || (p.kind === 'text' && p.text === '0' && p.font === 'tick-label')) as Extract<Primitive, { kind: 'text' }>[];
    expect(nums.length).toBeGreaterThan(3);
    expect(nums.length).toBeLessThan(41);
    const sorted = nums.map((t) => [t.x - (t.text.length * 6) / 2, t.x + (t.text.length * 6) / 2]).sort((a, b) => a[0]! - b[0]!);
    for (let k = 1; k < sorted.length; k++) expect(sorted[k]![0]).toBeGreaterThanOrEqual(sorted[k - 1]![1]!);
  });

  it('on the track: the zones paint the bar, the value half its thickness, edged; each zone named', () => {
    const { rects, track, value, texts } = bar({ ...ZONES, data: 1200 });
    const zones = rects.filter((r) => !r.point && r.paint.fill !== 'track');
    expect(zones.map((z) => z.paint.fill)).toEqual(['color-cold', 'color-calm']);
    expect(zones[0]!.x).toBeCloseTo(track.x, 6);
    expect(zones[0]!.width).toBeCloseTo(track.width / 8, 6);
    expect(zones[1]!.x).toBeCloseTo(track.x + (track.width * 3) / 8, 6);
    for (const z of zones) expect([z.y, z.height, z.paint.stroke]).toEqual([track.y, 24, 'background']);
    expect([value!.y, value!.height, value!.paint.stroke, value!.paint.strokeWidth]).toEqual([track.y + 6, 12, 'background', 2]);
    expect(texts.filter((t) => t === 'Cold' || t === 'Normal')).toEqual(['Cold', 'Normal']);
  });

  it('as a ring: a thin strip above the bar, away from the ticks', () => {
    const { rects, track } = bar({ ...ZONES, thresholdsOn: 'ring', data: 0 });
    const zones = rects.filter((r) => !r.point && r.paint.fill !== 'track');
    expect(zones).toHaveLength(2);
    for (const z of zones) expect([z.height, z.y + z.height]).toEqual([6, track.y - 3]);
  });

  it('a zone label near an end stays inside the chart', () => {
    const { scene } = bar({ ...ZONES, data: 0, thresholds: [{ from: -2000, to: -1990, label: 'A long name at the edge', color: 'cold' }] });
    const t = scene.layers.flatMap((l) => l.groups.flatMap((g) => g.items)).find((p) => p.kind === 'text' && p.text === 'A long name at the edge') as Extract<Primitive, { kind: 'text' }>;
    expect(t.x - (23 * 6) / 2).toBeGreaterThanOrEqual(0);
  });
});

describe('the bar, read and appearing (gauge.md 24)', () => {
  it('the value grows from the origin; the track and zones are there at once', () => {
    const { scene, track } = bar({ ...WIDE, origin: 0, data: -1000, thresholdsOn: 'track', thresholds: [{ from: -2000, to: -1500 }] });
    const start = rectsOf(appearFrom(scene));
    const zone = start.find((r) => !r.point && r.paint.fill !== 'track')!;
    expect([start.find((r) => r.paint.fill === 'track')!.width, zone.width]).toEqual([track.width, track.width / 8]);
    const v = start.find((r) => r.point)!;
    expect(v.x).toBeCloseTo(track.x + track.width / 2, 6);
    expect(v.width).toBe(0);
  });

  it('a meter for screen readers, as the arc', () => {
    const { model, l } = bar({ data: 85, thresholds: [{ from: 80, to: 100, label: 'High' }] });
    expect(pointLabel(model, l, { seriesId: 'g', index: 0 }, 'en-US', text)?.meter).toEqual({ min: '0', max: '100', threshold: 'High', now: 85, low: 0, high: 100 });
  });
});

describe('thickness (gauge.md 25)', () => {
  it('the arc: the thickness given, in pixels, instead of a quarter of the radius', () => {
    const value = build({ data: 50, thickness: 40 }).arcs.find((a) => a.point)!;
    expect(value.outerRadius - value.innerRadius).toBeCloseTo(40, 6);
  });

  it('the arc: no thicker than its radius', () => {
    const value = build({ data: 50, thickness: 5000 }).arcs.find((a) => a.point)!;
    expect(value.innerRadius).toBe(0);
  });

  it('the bar: the thickness given; on the track, the value half of it', () => {
    const { track, value } = bar({ data: 50, thickness: 40, thresholdsOn: 'track', thresholds: [{ from: 0, to: 10 }] });
    expect([track.height, value!.height, value!.y]).toEqual([40, 20, track.y + 10]);
    const up = bar({ data: 50, thickness: 40, orientation: 'vertical' });
    expect(up.track.width).toBe(40);
  });

  it('the bar: no thicker than the room left', () => {
    expect(bar({ data: 50, thickness: 5000 }).track.height).toBeLessThan(400);
  });

  it('not a positive number: reported, the default drawn', () => {
    for (const thickness of [0, -3, 'big']) {
      const { problems, track } = bar({ data: 50, thickness });
      expect(problems, String(thickness)).toEqual([{ code: 'invalid-option', path: 'series[0].thickness' }]);
      expect(track.height).toBe(24);
    }
  });
});

// The closing review of Phase 9 (2026-11-26): what it found, each written by hand from the sheet.
const textsOf = (scene: ReturnType<typeof build>['scene']) => scene.layers.flatMap((l) => l.groups.flatMap((g) => g.items)).filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text');

describe('the scale\'s ends, always written (gauge.md 14, 22, 23)', () => {
  const OFF = { min: 5, max: 95, data: 50, ticks: { step: 5, labels: 10 } };
  it('the arc: an end no number writes is written under the arc', () => {
    // Numbers at 10, 20 … 90: neither 5 nor 95 is one of them.
    const { texts } = build(OFF);
    expect(texts.filter((t) => t === '5')).toHaveLength(1);
    expect(texts.filter((t) => t === '95')).toHaveLength(1);
  });

  it('the bar, across and upright: the same', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      const { texts } = bar({ ...OFF, orientation });
      expect(texts.filter((t) => t === '5'), orientation).toHaveLength(1);
      expect(texts.filter((t) => t === '95'), orientation).toHaveLength(1);
    }
  });

  it('across, crowded numbers: both ends stay, the numbers next to them give way', () => {
    const { texts } = bar({ ...WIDE, data: 0, ticks: { step: 100, labels: 100 } });
    expect(texts.filter((t) => t === '-2,000')).toHaveLength(1);
    expect(texts.filter((t) => t === '2,000')).toHaveLength(1);
  });
});

describe('a thick arc (gauge.md 25)', () => {
  const T = { ...WIDE, data: 0, ticks: { step: 100, labels: 500 } };
  it('no room inside for a long tick: no ticks, no numbers, the ends written', () => {
    const { scene, texts } = build({ ...T, thickness: 5000 });
    expect(lines(scene)).toHaveLength(0);
    expect(texts.filter((t) => t === '-2,000')).toHaveLength(1);
    expect(texts.filter((t) => t === '2,000')).toHaveLength(1);
    expect(texts).not.toContain('-1,000');
  });

  it('little room inside: no number drawn across the centre', () => {
    const plain = build(T).arcs.find((a) => a.paint.fill === 'track')!;
    // 30 px inside the arc: a long tick fits, the numbers mostly do not.
    const { scene } = build({ ...T, thickness: plain.outerRadius - 30 });
    const cx = plain.cx;
    for (const n of textsOf(scene).filter((t) => t.font === 'tick-label' && /^-?[\d,]+$/.test(t.text))) {
      const v = Number(n.text.replace(/,/g, ''));
      // In left to right, a negative value is left of the centre, a positive one right of it.
      if (v < 0) expect(n.x, n.text).toBeLessThan(cx);
      if (v > 0) expect(n.x, n.text).toBeGreaterThan(cx);
    }
  });
});

describe('thresholds outside the scale (gauge.md 15)', () => {
  const OUT = { thresholdsOn: 'track', thresholds: [{ from: 0, to: 50, color: 'calm', label: 'Low' }, { from: 150, to: 200, color: 'hot', label: 'Critical' }] };
  it('the arc: not drawn, not named; a value past the scale still named by it', () => {
    const { arcs, texts } = build({ ...OUT, data: 30 });
    expect(arcs.filter((a) => !a.point && a.paint.fill !== 'track').map((a) => a.paint.fill)).toEqual(['color-calm']);
    expect(texts).not.toContain('Critical');
    expect(build({ ...OUT, data: 170 }).texts.filter((t) => t === 'Critical')).toHaveLength(1);
    const ring = build({ ...OUT, thresholdsOn: 'ring', data: 30 }).arcs.filter((a) => !a.point && a.paint.fill !== 'track');
    expect(ring.map((a) => a.paint.fill)).toEqual(['color-calm']);
  });

  it('the bar: the same', () => {
    const { rects, texts } = bar({ ...OUT, data: 30 });
    expect(rects.filter((r) => !r.point && r.paint.fill !== 'track').map((r) => r.paint.fill)).toEqual(['color-calm']);
    expect(texts).not.toContain('Critical');
  });
});

describe('at most 200 ticks (gauge.md 14)', () => {
  it('200 are drawn; 201 are reported and none drawn', () => {
    const ok = build({ min: 0, max: 199, data: 0, ticks: { step: 1 } });
    expect(ok.problems).toEqual([]);
    expect(lines(ok.scene)).toHaveLength(200);
    const many = build({ min: 0, max: 200, data: 0, ticks: { step: 1 } });
    expect(many.problems).toEqual([{ code: 'invalid-option', path: 'series[0].ticks.step' }]);
    expect(lines(many.scene)).toHaveLength(0);
  });
});
