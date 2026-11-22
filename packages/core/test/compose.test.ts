// The scene (ADR 0001, 0002; layout.md 8) and its SVG (svg.ts). Step 1.8. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { column, line, scatter, area, bar } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { CANVAS_THRESHOLD, composeScene, painterFor } from '../src/compose.js';
import { sceneToSvg } from '../src/svg.js';

const types = [line, column, scatter, area, bar];
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: f === 'title' ? 14 : 9, descent: f === 'title' ? 4 : 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

function scene(options: unknown, width = 600, height = 400): Scene {
  const { model } = normalize(options, types);
  const l = layout({ model, types, width, height, dir: 'ltr', measureText, text, locale: 'en-US' });
  return composeScene({ model, types, layout: l, measureText });
}
const layer = (s: Scene, id: string) => s.layers.find((l) => l.id === id)!;
const items = (s: Scene, id: string) => layer(s, id).groups.flatMap((g) => g.items);

describe('composeScene', () => {
  const ONE = { series: [{ type: 'line', data: [13, 40, 87, 60, 20] }] };

  it('layers back to front, each in its place', () => {
    expect(scene(ONE).layers.map((l) => l.id)).toEqual(['background', 'grid', 'series', 'axes', 'labels', 'legend', 'navigator', 'overlay']);
  });

  it('one-pixel lines on pixel centres (layout.md 8)', () => {
    // The plot of layout.test.ts: y 0–100 over 372…8, 72.8 px per 20. Each line on the centre of the pixel row it
    // falls in: 372 → 372.5, 299.2 → 299.5, 226.4 → 226.5, 153.6 → 153.5, 80.8 → 80.5, 8 → 8.5.
    const grid = items(scene(ONE), 'grid');
    expect(grid.map((g) => (g.kind === 'line' ? g.y1 : null))).toEqual([372.5, 299.5, 226.5, 153.5, 80.5, 8.5]);
  });

  it('text on its alphabetic baseline, from the font\'s measures', () => {
    // An x label placed at top 380, ascent 9: baseline 389. A y label centred on 372: 372 + (9 − 3) / 2 = 375.
    const labels = items(scene(ONE), 'labels').filter((t) => t.kind === 'text');
    expect(labels.find((t) => t.kind === 'text' && t.sceneId.startsWith('label/x'))).toMatchObject({ y: 389, baseline: 'alphabetic', paint: { fill: 'text-muted' } });
    expect(labels.find((t) => t.kind === 'text' && t.sceneId.startsWith('label/y'))).toMatchObject({ y: 375, anchor: 'end' });
  });

  it('a line is clipped to the plot; its markers to the plot grown by half a marker (they show whole on the edge)', () => {
    const groups = layer(scene(ONE), 'series').groups;
    // The plot of layout.test.ts: 36, 8, 556 × 364; grown by 6 on each side.
    expect(groups.map((g) => [g.painter, g.clip])).toEqual([
      ['svg', { x: 36, y: 8, width: 556, height: 364 }],
      ['svg', { x: 30, y: 2, width: 568, height: 376 }],
    ]);
  });

  it('columns on whole pixels', () => {
    const rects = items(scene({ series: [{ type: 'column', data: [['a', 3], ['b', 7]] }] }), 'series');
    for (const r of rects) if (r.kind === 'rect') expect([r.x, r.y, r.width, r.height].every(Number.isInteger)).toBe(true);
  });

  it('a hidden series is not drawn; its legend item stays, greyed (legend.md 6)', () => {
    const s = scene({ series: [{ type: 'line', name: 'A', data: [1, 2] }, { type: 'column', name: 'B', data: [3, 4], initiallyHidden: true }] });
    expect(layer(s, 'series').groups.every((g) => g.sceneId.startsWith('s/#1'))).toBe(true);
    const legend = items(s, 'legend');
    expect(legend.find((p) => p.sceneId === 'legend/#2/square')?.paint).toEqual({ fill: 'text-muted' });
    expect(legend.find((p) => p.sceneId === 'legend/#1/line')?.paint).toEqual({ stroke: 'series-1', strokeWidth: 2 });
  });
});

describe('painterFor (ADR 0002)', () => {
  const marks = (n: number) => Array.from({ length: n }, () => ({ kind: 'rect', sceneId: 'r', paint: {}, x: 0, y: 0, width: 1, height: 1 }) as const);
  it('paths stay in SVG; marks move to a Canvas past 2 000', () => {
    expect(CANVAS_THRESHOLD).toBe(2000);
    expect(painterFor({ role: 'marks', items: marks(2000) })).toBe('svg');
    expect(painterFor({ role: 'marks', items: marks(2001) })).toBe('canvas');
    expect(painterFor({ role: 'path', items: marks(5000) })).toBe('svg');
  });
});

describe('sceneToSvg', () => {
  const tiny: Scene = {
    width: 100,
    height: 50,
    dir: 'ltr',
    areas: { plot: { x: 10, y: 5, width: 80, height: 40 } },
    layers: [
      { id: 'background', groups: [{ sceneId: 'bg', painter: 'svg', items: [{ kind: 'rect', sceneId: 'b', paint: { fill: 'background' }, x: 0, y: 0, width: 100, height: 50 }] }] },
      { id: 'series', groups: [{ sceneId: 's', painter: 'canvas', clip: { x: 10, y: 5, width: 80, height: 40 }, items: [{ kind: 'path', sceneId: 'p', paint: { stroke: 'series-1', strokeWidth: 2 }, path: { commands: Uint8Array.of(0, 1), coords: Float64Array.of(10, 45, 90.004, 5) } }] }] },
      { id: 'labels', groups: [{ sceneId: 'l', painter: 'svg', items: [{ kind: 'text', sceneId: 't', paint: { fill: 'text' }, x: 50, y: 20, text: '<A & B>', font: 'title', anchor: 'middle', baseline: 'alphabetic', dir: 'rtl' }] }] },
    ],
  };

  it('a standalone document: clip paths once, every group whatever its painter, text escaped', () => {
    expect(sceneToSvg(tiny)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50" direction="ltr">' +
        '<defs><clipPath id="dzgraph-clip-0"><rect x="10" y="5" width="80" height="40"/></clipPath></defs>' +
        '<g data-layer="background"><g><rect x="0" y="0" width="100" height="50" fill="var(--dzgraph-background)"/></g></g>' +
        '<g data-layer="series"><g clip-path="url(#dzgraph-clip-0)"><path d="M10 45L90 5" fill="none" stroke="var(--dzgraph-series-1)" stroke-width="2"/></g></g>' +
        '<g data-layer="labels"><g><text x="50" y="20" text-anchor="middle" fill="var(--dzgraph-text)" direction="rtl" class="dzgraph-font-title">&lt;A &amp; B&gt;</text></g></g>' +
        '</svg>',
    );
  });

  it('a rectangle with one rounded end is a path: base straight, the free end\'s corners turned', () => {
    const one: Scene = { ...tiny, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'svg', items: [{ kind: 'rect', sceneId: 'r', paint: { fill: 'series-1' }, x: 10, y: 20, width: 30, height: 40, radius: 4, roundEnd: 'y-min' }] }] }] };
    expect(sceneToSvg(one)).toContain('<path d="M10 60L10 24A4 4 0 0 1 14 20L36 20A4 4 0 0 1 40 24L40 60Z" fill="var(--dzgraph-series-1)"/>');
  });

  it('colours and fonts resolved for an export', () => {
    const svg = sceneToSvg(tiny, { resolve: (t) => `[${t}]`, font: (r) => `{${r}}` });
    expect(svg).toContain('fill="[background]"');
    expect(svg).toContain('style="font:{title}"');
  });
});

describe('Canvas and SVG keep one order on screen and in the export (ADR 0002, Phase 3 close)', () => {
  const many = Array.from({ length: 3_000 }, (_, i) => i % 50);

  it('a series is drawn by one painter: a line whose markers go to Canvas goes there whole', () => {
    // 1 400 px wide: decimation keeps up to four points a pixel, so all 3 000 markers are drawn.
    const s = scene({ series: [{ type: 'line', id: 'a', marker: true, data: many }] }, 1_400);
    const groups = layer(s, 'series').groups;
    expect(groups.map((g) => g.painter)).toEqual(['canvas', 'canvas']);
  });

  it('in each layer, Canvas groups come first: what the screen puts under the SVG, the export draws first too', () => {
    const s = scene({ series: [{ type: 'line', id: 'l', data: [1, 2, 3] }, { type: 'scatter', id: 'p', data: many.map((y, i) => [i, y]) }] });
    const groups = layer(s, 'series').groups;
    expect(groups.map((g) => [g.sceneId.split('/')[1], g.painter])).toEqual([['p', 'canvas'], ['l', 'svg'], ['l', 'svg']]);
  });
});
