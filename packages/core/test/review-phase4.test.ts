// The Phase 4 code review (2026-11-22): each finding as a test that failed first. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { svgOf } from '../src/svg.js';
import { tooltipOf } from '../src/tooltip.js';
import { dataTable, pointLabel } from '../src/a11y.js';
import type { ArcPrimitive } from '../src/scene.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…', pointName: (n: number) => `Slice ${n}`, others: 'Others', total: 'Total' };
function build(options: unknown) {
  const { model } = normalize(options, types);
  const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
  return { model, l, scene: composeScene({ model, types, layout: l, measureText }) };
}

describe('review 1: a slice that is the whole pie', () => {
  it('is drawn as a full disc (two half arcs), a donut as a full ring', () => {
    for (const hole of [0, 0.6]) {
      const a: ArcPrimitive = { kind: 'arc', sceneId: 'a', paint: { fill: 'series-1' }, cx: 100, cy: 100, innerRadius: 50 * hole, outerRadius: 50, startAngle: 0, endAngle: 2 * Math.PI };
      const d = svgOf(a).attrs['d']!;
      // Two arc commands on the outer circle, through the bottom point (100, 150).
      expect(d.match(/A50 50/g)!.length).toBe(2);
      expect(d).toContain('100 150');
    }
  });
});

describe('review 2, 3: « Autres » and unnamed slices, read and tabled', () => {
  const NINE = { series: [{ type: 'pie', id: 's', data: [30, 20, 15, 10, 8, 6, 5, 4, 2] }], dataTable: true };

  it('« Autres » has its label for screen readers', () => {
    const { model, l } = build(NINE);
    expect(pointLabel(model, l, { seriesId: 's', index: 9 }, 'en-US', text)).toEqual({ series: 'Series 1', x: 'Others', y: '', share: '11%', position: 7, count: 7 });
  });

  it('an unnamed slice is « Slice n » in the table too', () => {
    const { model, l } = build(NINE);
    expect(dataTable(model, l, undefined, 'en-US', text).rows[0]![0]).toBe('Slice 1');
  });
});

describe('review 4: a gauge without a value', () => {
  it('shows its empty track and its dash, not « no data » over them', () => {
    expect(build({ series: [{ type: 'gauge', data: null }] }).l.noData).toBeNull();
  });
});

describe('review 5: on a log y axis, a value ≤ 0 keeps its row', () => {
  it('a gap of its own, at its own x', () => {
    const { model, l } = build({ xAxis: { scale: 'category', categories: ['Jan', 'Feb', 'Mar'] }, yAxis: { scale: 'log' }, series: [{ type: 'line', data: [5, 0, 7] }] });
    expect(dataTable(model, l, undefined, 'en-US', text).rows).toEqual([['Jan', '5'], ['Feb', ''], ['Mar', '7']]);
  });
});

describe('review 6: a gauge past its scale', () => {
  it('its meter value stays within its bounds; the text keeps the real value', () => {
    const { model, l } = build({ series: [{ type: 'gauge', id: 'g', data: 150 }] });
    const label = pointLabel(model, l, { seriesId: 'g', index: 0 }, 'en-US', text)!;
    expect([label.y, label.meter?.now]).toEqual(['150', 100]);
  });
});

describe('review 7: no sentence put together in the core', () => {
  it('a slice label and a gauge note use the words given', () => {
    const words = { ...text, sliceLabel: (name: string, share: string) => `${share} — ${name}` };
    const { model } = normalize({ series: [{ type: 'pie', data: [['A', 1], ['B', 3]] }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text: words, locale: 'en-US' });
    const scene = composeScene({ model, types, layout: l, measureText });
    const labels = scene.layers.flatMap((x) => x.groups.flatMap((g) => g.items)).flatMap((p) => (p.kind === 'text' ? [p.text] : []));
    expect(labels).toEqual(['25% — A', '75% — B']);
    const g = normalize({ series: [{ type: 'gauge', id: 'g', data: 5, thresholds: [{ from: 0, to: 10, label: 'Low' }] }] }, types).model;
    const gl = layout({ model: g, types, width: 600, height: 400, dir: 'ltr', measureText, text: words, locale: 'en-US' });
    const t = tooltipOf(g, gl, { points: [{ seriesId: 'g', index: 0 }] }, 'en-US', words);
    expect([t.range, t.threshold]).toEqual([{ min: '0', max: '100' }, 'Low']);
  });
});

describe('review 8: a pile\'s tooltip, top to bottom as drawn', () => {
  it('with a negative value: the highest segment first, the lowest last', () => {
    const { model, l } = build({ series: [{ type: 'area', id: 'a', stack: true, data: [10] }, { type: 'area', id: 'b', stack: true, data: [-5] }, { type: 'area', id: 'c', stack: true, data: [3] }] });
    const t = tooltipOf(model, l, { points: ['a', 'b', 'c'].map((seriesId) => ({ seriesId, index: 0 })) }, 'en-US', text);
    expect(t.rows.map((r) => r.seriesId)).toEqual(['c', 'a', 'b']);
  });
});

describe('review 9: a pie hidden from the start', () => {
  it('keeps a legend item to bring it back', () => {
    const { l } = build({ series: [{ type: 'pie', id: 's', name: 'Fruit', initiallyHidden: true, data: [1, 2] }] });
    expect(l.legend?.items.map((i) => [i.key, i.hidden])).toEqual([['s', true]]);
  });
});
