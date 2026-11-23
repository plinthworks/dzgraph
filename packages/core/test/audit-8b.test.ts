// Rules of the sheets the Phase 8b audit found without a test (docs/phase-8-steps/plan.md), the core's part. By hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, Primitive, Scene, TextMeasurer } from '@dzgraph/core';
import { area, column, line } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';

const types = [area, column, line];
const PER: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER[f], ascent: 9, descent: 3 });
const words = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
function scene(options: unknown, width = 400, height = 300): Scene {
  const { model } = normalize(options, types);
  const l = layout({ model, types, width, height, dir: 'ltr', measureText, text: words, locale: 'en' });
  return composeScene({ model, types, layout: l, measureText });
}
const items = (s: Scene, layer: string): Primitive[] => s.layers.find((l) => l.id === layer)!.groups.flatMap((g) => g.items);
const byId = (s: Scene, id: string) => items(s, 'series').find((p) => p.sceneId === id)!;
const xy = (p: Primitive) => (p.kind === 'path' ? [...p.path.coords] : []);

describe('stacking (stacking.md 7, 13)', () => {
  it('13: a stacked area fills from the layer below to its own line, half opaque; a lone area lighter', () => {
    const s = scene({ series: [{ type: 'area', id: 'a', stack: true, data: [1, 2] }, { type: 'area', id: 'b', stack: true, data: [1, 1] }] });
    const below = xy(byId(s, 's/a/area'));
    const fill = byId(s, 's/b/area-fill');
    // Its own line, then the line below walked back: x0 y0 x1 y1 (own) x1 y1 x0 y0 (below).
    expect(xy(fill).slice(4)).toEqual([below[2], below[3], below[0], below[1]]);
    expect(xy(fill).slice(0, 4)).toEqual(xy(byId(s, 's/b/area')));
    expect(fill.paint.opacity).toBe(0.5);
    const lone = scene({ series: [{ type: 'area', id: 'a', data: [1, 2] }] });
    expect(byId(lone, 's/a/area-fill').paint.opacity ?? 1).toBeLessThan(0.5);
  });

  it('7: stacked series are not decimated: every point of a long pile is drawn', () => {
    const n = 6000;
    const y = Array.from({ length: n }, (_, i) => (i % 7) + 1);
    const s = scene({ series: [{ type: 'area', id: 'a', stack: true, data: y }, { type: 'area', id: 'b', stack: true, data: y }] });
    // A path of n points: n pairs of coordinates (a decimated one keeps about four a pixel column, far fewer).
    expect(xy(byId(s, 's/b/area')).length).toBe(2 * n);
    // The same series alone is decimated: the rule is the pile's.
    const alone = scene({ series: [{ type: 'area', id: 'b', data: y }] });
    expect(xy(byId(alone, 's/b/area')).length).toBeLessThan(2 * n);
  });
});

describe('columns (columns-bars.md 6)', () => {
  it('so many categories that a column would be thinner than 1 px: 1 px wide', () => {
    const n = 3000;
    const s = scene({ series: [{ type: 'column', id: 'c', data: Array.from({ length: n }, (_, i) => (i % 5) + 1) }] }, 400, 300);
    const rects = items(s, 'series').filter((p) => p.kind === 'rect');
    expect(rects).toHaveLength(n);
    expect(Math.min(...rects.map((r) => (r.kind === 'rect' ? r.width : 0)))).toBe(1);
  });
});

describe('log scale (log-scale.md 6)', () => {
  it('a gridline on every tick, none at zero', () => {
    const s = scene({ yAxis: { scale: 'log' }, series: [{ type: 'line', id: 'a', data: [1, 10, 100, 1000] }] });
    const all = s.layers.flatMap((l) => l.groups.flatMap((g) => g.items));
    // The value axis's labels: at its side, end-anchored in left to right (the x axis's are centred).
    const labels = all.filter((p) => p.kind === 'text' && p.font === 'tick-label' && p.anchor !== 'middle');
    const grid = items(s, 'grid').filter((p) => p.kind === 'line' && p.y1 === p.y2);
    expect(labels.map((p) => (p.kind === 'text' ? p.text : ''))).toEqual(['1', '10', '100', '1,000']);
    expect(grid).toHaveLength(labels.length);
    expect(labels.some((p) => p.kind === 'text' && p.text === '0')).toBe(false);
  });
});
