// The SVG painter keeping elements by scene id across frames (ADR 0001). Phase 7b: a bug found by the DzGrid link's
// tests — an element that kept its id but changed tag, while it was where the next one goes, broke the drawing.
import { describe, it, expect } from 'vitest';
import type { Primitive, Scene } from '@dzgraph/core';
import { SvgPainter } from '../src/svg-painter.js';

const NS = 'http://www.w3.org/2000/svg';
const scene = (items: readonly Primitive[]): Scene => ({ width: 100, height: 50, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 100, height: 50 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'svg', items }] }] });
const rect = (id: string, extra: object = {}): Primitive => ({ kind: 'rect', sceneId: id, paint: { fill: 'series-1' }, x: 0, y: 0, width: 10, height: 10, ...extra }) as Primitive;

describe('the SVG painter (ADR 0001)', () => {
  it('an element that changes tag in place (a column getting a rounded end) is replaced where it was', () => {
    const svg = document.createElementNS(NS, 'svg');
    document.body.appendChild(svg);
    const p = new SvgPainter(svg, 't');
    p.paint(scene([rect('a'), rect('b')]), {});
    // `a` becomes a path (a rounded end), `b` stays: `a` was the cursor when it was replaced.
    expect(() => p.paint(scene([rect('a', { radius: 4, roundEnd: 'y-min' }), rect('b')]), {})).not.toThrow();
    const drawn = [...svg.querySelectorAll('[data-layer="series"] g > *')].map((e) => e.localName);
    expect(drawn).toEqual(['path', 'rect']);
    svg.remove();
  });
});
