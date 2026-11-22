// The crosshair (crosshair.md): lines through the pointer and a tag on each axis with its value there. Phase 5a
// step 3. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { crosshairKit } from '../src/crosshair.js';
import { NO_KIT, type Kit } from '../src/kit.js';
import type { LinePrimitive, RectPrimitive, TextPrimitive } from '../src/scene.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
const kit = { ...NO_KIT, crosshair: crosshairKit };
function build(options: object, dir: 'ltr' | 'rtl' = 'ltr', k: Kit = kit) {
  const { model, problems } = normalize(options, allTypes, { kit: k });
  const l = layout({ model, types: allTypes, width: 600, height: 400, dir, measureText, text, locale: 'en-US' });
  return { model, problems, l };
}
const LINE = { crosshair: true, series: [{ type: 'line', data: [[0, 0], [10, 100]] }] };

describe('reading the option (crosshair.md)', () => {
  it('true, or { horizontal }; without the module, reported and off', () => {
    expect(build(LINE).model.crosshair).toEqual({ horizontal: false });
    expect(build({ ...LINE, crosshair: { horizontal: true } }).model.crosshair).toEqual({ horizontal: true });
    expect(build({ ...LINE, crosshair: 'yes' }).problems).toEqual([{ code: 'invalid-option', path: 'crosshair' }]);
    const without = build(LINE, 'ltr', NO_KIT);
    expect([without.model.crosshair, without.problems]).toEqual([null, [{ code: 'missing-module', path: 'crosshair', detail: 'crosshair' }]]);
  });
});

describe('drawn (crosshair.md 1–3, 7)', () => {
  it('a dashed line through the pointer and the x value under it, at the axis\'s foot', () => {
    const { model, l } = build(LINE);
    const { plot } = l;
    // Halfway across: x 5.
    const px = plot.x + plot.width / 2;
    const items = crosshairKit.draw(model, l, { x: px, y: plot.y + 10 }, measureText, 'en-US')!;
    const lines = items.filter((p): p is LinePrimitive => p.kind === 'line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ x1: Math.round(px - 0.5) + 0.5, y1: plot.y, y2: plot.y + plot.height, paint: { stroke: 'axis-line', dash: [3, 3] } });
    const tag = items.find((p): p is TextPrimitive => p.kind === 'text')!;
    expect([tag.text, tag.x, tag.anchor]).toEqual(['5', px, 'middle']);
    const box = items.find((p): p is RectPrimitive => p.kind === 'rect')!;
    // Under the plot, the text's width (6 px a character) and 4 px each side.
    expect([box.y, box.width, box.paint]).toEqual([plot.y + plot.height + 2, 6 + 8, { fill: 'background', stroke: 'axis-line', strokeWidth: 1 }]);
  });

  it('with the horizontal line, each value axis has its tag: at the plot\'s start in LTR, at its end in RTL', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { model, l } = build({ ...LINE, crosshair: { horizontal: true } }, dir);
      const { plot } = l;
      const items = crosshairKit.draw(model, l, { x: plot.x + 5, y: plot.y + plot.height / 2 }, measureText, 'en-US')!;
      expect(items.filter((p) => p.kind === 'line')).toHaveLength(2);
      const tags = items.filter((p): p is TextPrimitive => p.kind === 'text');
      const y = tags.find((t) => t.text === '50')!;
      expect(y.anchor).toBe('middle');
      // Beside the plot's start edge, outside it.
      if (dir === 'ltr') expect(y.x).toBeLessThan(plot.x);
      else expect(y.x).toBeGreaterThan(plot.x + plot.width);
    }
  });

  it('a value written to a tenth of the ticks\' step; a category by its name; a tag kept inside the chart', () => {
    const { model, l } = build(LINE);
    const px = l.plot.x + l.plot.width * 0.333;
    // 3.33 on an axis stepping by 2: one decimal past the ticks' (none).
    expect(crosshairKit.draw(model, l, { x: px, y: l.plot.y }, measureText, 'en-US')!.find((p) => p.kind === 'text')).toMatchObject({ text: '3.3' });
    const cat = build({ crosshair: true, xAxis: { scale: 'category', categories: ['January', 'February'] }, series: [{ type: 'column', data: [1, 2] }] });
    const edge = crosshairKit.draw(cat.model, cat.l, { x: cat.l.plot.x + 1, y: cat.l.plot.y }, measureText, 'en-US')!;
    const box = edge.find((p): p is RectPrimitive => p.kind === 'rect')!;
    expect(edge.find((p) => p.kind === 'text')).toMatchObject({ text: 'January' });
    expect(box.x).toBeGreaterThanOrEqual(0);
  });

  it('outside the plot, or on a polar chart: nothing', () => {
    const { model, l } = build(LINE);
    expect(crosshairKit.draw(model, l, { x: l.plot.x - 3, y: l.plot.y + 5 }, measureText, 'en-US')).toBeNull();
    const pie = build({ crosshair: true, series: [{ type: 'pie', data: [1, 2] }] });
    expect(crosshairKit.draw(pie.model, pie.l, { x: 300, y: 200 }, measureText, 'en-US')).toBeNull();
  });
});

describe('on a compared axis (crosshair.md 2, compare.md 3)', () => {
  it('the value tag is written as the axis writes it: a signed percent', async () => {
    const { FULL_KIT } = await import('./helpers/kit.js');
    const { model } = normalize({ crosshair: { horizontal: true }, yAxis: { compare: 'percent' }, series: [{ type: 'line', data: [10, 20, 30] }] }, allTypes, { kit: FULL_KIT });
    const l = layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const y = l.axes.find((a) => a.dimension === 'y')!.scale;
    const items = crosshairKit.draw(model, l, { x: l.plot.x + 5, y: y.map(100) }, measureText, 'en-US')!;
    expect(items.filter((p): p is TextPrimitive => p.kind === 'text').map((t) => t.text)).toContain('+100%');
  });
});
