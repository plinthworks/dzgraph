// Features lent to the core (ADR 0006): a time axis, a navigator or range buttons asked for without their module are
// reported `missing-module` and drawn the closest way; with the module, nothing is reported. Phase 4 step 1.
// Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { xValueLabel } from '../src/tooltip.js';
import { FULL_KIT } from './helpers/kit.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
// 2026-03-01 and 2026-03-02, midnight UTC, written by hand: 20 513 and 20 514 days after 1970-01-01.
const DAY1 = 20_513 * 86_400_000;
const DAY2 = 20_514 * 86_400_000;

describe('a time axis without timeAxis', () => {
  const options = { xAxis: { scale: 'time', zone: 'UTC', min: '2026-03-01' }, series: [{ type: 'line', id: 's', data: [[DAY1, 1], [DAY2, 2], ['2026-03-03', 3]] }] };

  it('is reported once, at its scale, naming the module', () => {
    const { problems } = normalize(options, types);
    expect(problems.filter((p) => p.code === 'missing-module')).toEqual([{ code: 'missing-module', path: 'xAxis[0].scale', detail: 'timeAxis' }]);
    // Its time options are still known options: no `unknown-option` for `zone` or `min`.
    expect(problems.some((p) => p.code === 'unknown-option')).toBe(false);
  });

  it('is drawn linear: numbers keep their place, the date string is a gap, the date bound is left out', () => {
    const { model, problems } = normalize(options, types);
    const axis = model.xAxes[0]!;
    expect([axis.scale, axis.zone, axis.min]).toEqual(['linear', null, null]);
    const s = model.series[0]!;
    expect([...s.columns.x.slice(0, 2)]).toEqual([DAY1, DAY2]);
    expect(Number.isNaN(s.columns.y[2]!)).toBe(true);
    expect(problems).toContainEqual({ code: 'invalid-data', path: 'series[0].data[2]', seriesId: 's', detail: 'count=1' });
    // A plain number, not a date.
    expect(xValueLabel(model, 'x', DAY1, 'en-US')).toBe('1,772,323,200,000');
  });

  it('with the module: nothing reported, the string read in the zone, the label a date', () => {
    const { model, problems } = normalize(options, types, { kit: FULL_KIT });
    expect(problems).toEqual([]);
    expect(model.xAxes[0]!.scale).toBe('time');
    expect(model.xAxes[0]!.min).toBe(DAY1);
    expect(model.series[0]!.columns.x[2]).toBe(DAY2 + 86_400_000);
    expect(xValueLabel(model, 'x', DAY1, 'en-US')).toBe('Sun, Mar 1, 2026');
  });
});

describe('a navigator or range buttons without navigatorStrip', () => {
  const series = [{ type: 'line', id: 'a', data: [1, 3, 2, 5] }];

  it('`navigator: true`: reported, left out of the layout and the scene', () => {
    const { model, problems } = normalize({ navigator: true, series }, types);
    expect(problems).toEqual([{ code: 'missing-module', path: 'navigator', detail: 'navigatorStrip' }]);
    expect(model.navigator).toBe(false);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    expect(l.navigator).toBeNull();
    const scene = composeScene({ model, types, layout: l, measureText });
    expect(scene.layers.some((layer) => layer.id === 'navigator' && layer.groups.length > 0)).toBe(false);
  });

  it('`rangeButtons: true`: reported as the missing module, not as a numeric axis', () => {
    const { model, problems } = normalize({ rangeButtons: true, series }, types);
    expect(problems).toEqual([{ code: 'missing-module', path: 'rangeButtons', detail: 'navigatorStrip' }]);
    expect(model.rangeButtons).toBe(false);
  });

  it('with the module: the strip is laid out', () => {
    const { model, problems } = normalize({ navigator: true, series }, types, { kit: FULL_KIT });
    expect(problems).toEqual([]);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    expect(l.navigator?.box.height).toBe(40);
  });
});
