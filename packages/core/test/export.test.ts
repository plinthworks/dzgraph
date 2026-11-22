// The view as a picture (export.md): the scene laid out without the controls, and the standalone SVG document with
// its name, description, language and direction. Phase 6 step 2. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { exportScene } from '../src/export.js';
import { sceneToSvg } from '../src/svg.js';
import { normalizeFull as normalize } from './helpers/kit.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
const base = { types: allTypes, width: 600, height: 400, dir: 'ltr' as const, measureText, text, locale: 'en-US' };

describe('the export scene (export.md 1–2, 4)', () => {
  const TIME = { navigator: true, xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'a', data: Array.from({ length: 60 }, (_, i) => [i * 86_400_000, i % 7]) }] };

  it('without the navigator strip and the range buttons: the plot takes their room', () => {
    const { model } = normalize(TIME, allTypes);
    const screen = layout({ ...base, model });
    const { layout: l, scene } = exportScene({ ...base, model });
    expect(screen.navigator).not.toBeNull();
    expect([l.navigator, l.rangeBar, scene.layers.find((y) => y.id === 'navigator')?.groups.length ?? 0]).toEqual([null, null, 0]);
    expect(l.plot.height).toBeGreaterThan(screen.plot.height);
  });

  it('the view kept: a range zooms it, a hidden series is left out', () => {
    const { model } = normalize({ series: [{ type: 'line', id: 'a', data: [1, 2, 3, 4] }, { type: 'line', id: 'b', data: [4, 3, 2, 1] }] }, allTypes);
    const view = { hidden: new Set(['b']), range: { x: { min: 1, max: 2 } } };
    const { layout: l, scene } = exportScene({ ...base, model, view });
    const x = l.axes.find((a) => a.dimension === 'x')!;
    expect([x.scale.map(1), x.scale.map(2)]).toEqual([l.plot.x, l.plot.x + l.plot.width]);
    const screen = composeScene({ model, types: allTypes, layout: layout({ ...base, model, view }), measureText, view });
    expect(JSON.stringify(scene.layers.map((y) => y.groups.map((g) => g.sceneId)))).toBe(JSON.stringify(screen.layers.map((y) => y.groups.map((g) => g.sceneId))));
  });

  it('a size of its own lays the chart out again, not stretched', () => {
    const { model } = normalize({ series: [{ type: 'line', id: 'a', data: [1, 2] }] }, allTypes);
    const { scene } = exportScene({ ...base, model, width: 1200, height: 300 });
    expect([scene.width, scene.height]).toEqual([1200, 300]);
  });
});

describe('the standalone SVG (export.md 6)', () => {
  const tiny: Scene = { width: 100, height: 50, dir: 'rtl', areas: { plot: { x: 0, y: 0, width: 100, height: 50 } }, layers: [] };

  it('role img, named by its title, described by the summary, its language; text escaped', () => {
    expect(sceneToSvg(tiny, { prefix: 'p', title: 'Sales <2026>', desc: 'Line chart & more', lang: 'fr' })).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50" direction="rtl" role="img" lang="fr" aria-labelledby="p-title" aria-describedby="p-desc">' +
        '<title id="p-title">Sales &lt;2026&gt;</title><desc id="p-desc">Line chart &amp; more</desc></svg>',
    );
  });

  it('without them, as before', () => {
    expect(sceneToSvg(tiny)).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50" direction="rtl"></svg>');
  });
});
