// Time axes through the whole core (time-axis.md): reading, layout with two tiers, the tooltip's heading. Step 3.2.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalizeFull as normalize } from './helpers/kit.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { tooltipOf } from '../src/tooltip.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
const utc = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h);

const DAYS = {
  xAxis: { scale: 'time', zone: 'Europe/Paris' },
  series: [{ type: 'line', id: 'a', name: 'A', data: ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02'].map((d, i) => [d, i]) }],
};

describe('reading time values (time-axis.md 1)', () => {
  it('days at their local midnight; offset-less date-times are gaps, reported', () => {
    const { model, problems } = normalize({ xAxis: { scale: 'time', zone: 'Europe/Paris' }, series: [{ type: 'line', id: 's', data: [['2026-03-29', 1], ['2026-03-29T05:00:00', 2], [utc(2026, 3, 30), 3]] }] }, types);
    const s = model.series[0]!;
    expect(s.columns.x[0]).toBe(utc(2026, 3, 28, 23));
    expect(Number.isNaN(s.columns.y[1]!)).toBe(true);
    expect(problems).toEqual([{ code: 'ambiguous-instant', path: 'series[0].data[1]', seriesId: 's', detail: 'count=1' }]);
    expect(problems.some((p) => p.code === 'not-available')).toBe(false);
  });
});

describe('the default zone (time-axis.md 2)', () => {
  it('the page\'s, given by the DOM; without it UTC, never the machine\'s', () => {
    const options = { xAxis: { scale: 'time' }, series: [{ type: 'line', data: [['2026-03-29', 1]] }] };
    expect(normalize(options, types).model.xAxes[0]!.zone).toBe('UTC');
    const { model } = normalize(options, types, { zone: 'Pacific/Auckland' });
    expect(model.xAxes[0]!.zone).toBe('Pacific/Auckland');
    expect(model.series[0]!.columns.x[0]).toBe(utc(2026, 3, 28, 11));
  });
});

describe('a time axis laid out (time-axis.md 4–7)', () => {
  it('day ticks at local midnight, labelled by day, the month under them', () => {
    const { model } = normalize(DAYS, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'fr-FR' });
    const x = l.axes.find((a) => a.id === 'x')!;
    expect(x.ticks.map((t) => t.label?.text)).toEqual(['27', '28', '29', '30', '31', '1', '2']);
    expect(x.second.map((s) => s.text)).toEqual(['mars 2026', 'avril 2026']);
    // Under the first row: two rows of labels make the x axis taller than one.
    expect(x.second[0]!.y).toBeGreaterThan(x.ticks[0]!.label!.y);
  });

  it('a second-tier label at the very end slides inside the chart; one that would overlap the previous is left out', () => {
    const { model } = normalize({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', data: ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01'].map((d, i) => [`${d}T00:00:00Z`, i]) }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'fr-FR' });
    const x = l.axes.find((a) => a.id === 'x')!;
    // « avril 2026 »: 10 characters of 6 px, starting at the last tick, at the plot's end.
    expect(x.second.at(-1)!.text).toBe('avril 2026');
    // Where a label's ink lies: from its anchor, rightward for LTR « start » or RTL « end », else leftward.
    const span = (t: (typeof x.second)[number]) => {
      const w = [...t.text].length * 6;
      return (t.anchor === 'start') === (t.dir === 'ltr') ? [t.x, t.x + w] : [t.x - w, t.x];
    };
    for (const dir of ['ltr', 'rtl'] as const) {
      const second = layout({ model, types, width: 600, height: 400, dir, measureText, text, locale: 'fr-FR' }).axes.find((a) => a.id === 'x')!.second;
      expect(second.length).toBe(2);
      for (const t of second) {
        const [a, b] = span(t);
        expect(a).toBeGreaterThanOrEqual(2);
        expect(b).toBeLessThanOrEqual(598);
      }
      // Each starts at its tick, toward later times: the first one's ink begins at the first tick.
      expect(span(second[0]!)[0]).toBeCloseTo(layout({ model, types, width: 600, height: 400, dir, measureText, text, locale: 'fr-FR' }).axes.find((a) => a.id === 'x')!.ticks[0]!.at, 6);
    }
    // Reversed: the ink runs leftward from each tick, still inside.
    const { model: rev } = normalize({ xAxis: { scale: 'time', zone: 'UTC', reversed: true }, series: [{ type: 'line', data: ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01'].map((d, i) => [`${d}T00:00:00Z`, i]) }] }, types);
    const rl = layout({ model: rev, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'fr-FR' });
    const rx = rl.axes.find((a) => a.id === 'x')!;
    for (const t of rx.second) {
      const [a, b] = span(t);
      expect(a).toBeGreaterThanOrEqual(2);
      expect(b).toBeLessThanOrEqual(598);
    }
  });

  it('the second tier is drawn', () => {
    const { model } = normalize(DAYS, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'fr-FR' });
    const scene = composeScene({ model, types, layout: l, measureText });
    const texts = scene.layers.find((x) => x.id === 'labels')!.groups.flatMap((g) => g.items).flatMap((p) => (p.kind === 'text' ? [p.text] : []));
    expect(texts).toContain('avril 2026');
  });
});

describe('the tooltip on a time axis (time-axis.md 8)', () => {
  it('the full date, and the time when there is one', () => {
    const { model } = normalize({ xAxis: { scale: 'time', zone: 'Europe/Paris' }, series: [{ type: 'line', id: 'a', data: [[utc(2026, 3, 5, 13), 1], [utc(2026, 3, 5, 23), 2]] }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'fr-FR' });
    // The date and the time as the engine's Intl joins them: « , » or « à » depending on its CLDR version.
    const withTime = tooltipOf(model, l, { points: [{ seriesId: 'a', index: 0 }] }, 'fr-FR', text).heading;
    expect(withTime.startsWith('jeu. 5 mars 2026')).toBe(true);
    expect(withTime.endsWith('14:00')).toBe(true);
    expect(tooltipOf(model, l, { points: [{ seriesId: 'a', index: 1 }] }, 'fr-FR', text).heading).toBe('ven. 6 mars 2026');
  });
});

describe('one value only (axes.md 5, found by the site\'s aggregation demo)', () => {
  const xOf = (model: Parameters<typeof layout>[0]['model']) => layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-GB' }).axes.find((a) => a.id === 'x')!;

  it('an axis aggregated by year with one year spans the years around it, ticks on the calendar', async () => {
    const { aggregationKit } = await import('../src/aggregation.js');
    const { model } = normalize({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'column', id: 'c', data: [[utc(2026, 2, 3), 4], [utc(2026, 9, 9), 6]] }] }, types);
    const x = xOf(aggregationKit.apply(model, { period: 'year' })!.model);
    const values = x.ticks.map((t) => t.value);
    // Around 2026: from the start of 2025 to the start of 2027, never a millisecond tick on 1 January 2026.
    expect(Math.min(...values)).toBeGreaterThanOrEqual(utc(2025, 1, 1));
    expect(Math.max(...values)).toBeLessThanOrEqual(utc(2027, 1, 1));
    expect(values.every((v) => new Date(v).getUTCDate() === 1 && v % 86_400_000 === 0)).toBe(true);
    expect([...x.ticks.map((t) => t.label?.text), ...x.second.map((s) => s.text)].join(' ')).toContain('2026');
  });

  it('a lone column at x = 0 on a linear axis: centred, −1 to 1 (review 2026-11-26)', () => {
    const { model } = normalize({ series: [{ type: 'column', id: 'c', data: [5] }] }, types);
    const values = xOf(model).ticks.map((t) => t.value);
    expect([Math.min(...values), Math.max(...values)]).toEqual([-1, 1]);
    // Any other lone value was already centred: 5 → 4–6.
    const five = xOf(normalize({ series: [{ type: 'column', id: 'c', data: [[5, 3]] }] }, types).model).ticks.map((t) => t.value);
    expect([Math.min(...five), Math.max(...five)]).toEqual([4, 6]);
  });

  it('one instant: a day on each side, ticks on the hour at least', () => {
    const { model } = normalize({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'l', data: [[utc(2026, 3, 5, 13) + 1234, 4]] }] }, types);
    const values = xOf(model).ticks.map((t) => t.value);
    expect(values.length).toBeGreaterThan(1);
    expect(values.every((v) => v % 3_600_000 === 0)).toBe(true);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(utc(2026, 3, 4, 13));
    expect(Math.max(...values)).toBeLessThanOrEqual(utc(2026, 3, 6, 14));
  });
});
