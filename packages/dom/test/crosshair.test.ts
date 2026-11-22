// The crosshair in a real browser (crosshair.md): it follows the pointer, goes through the focused point, and leaves
// with the pointer. Phase 5a step 3.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, crosshair, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features = [crosshair]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
function point(svg: SVGSVGElement, type: string, x: number, y: number) {
  const box = svg.getBoundingClientRect();
  svg.dispatchEvent(new PointerEvent(type, { clientX: box.left + x, clientY: box.top + y, pointerType: 'mouse', bubbles: true, isPrimary: true }));
}
const layer = (svg: SVGSVGElement) => svg.querySelector('.dzgraph-crosshair-layer')!;
const LINE = { crosshair: true, series: [{ type: 'line' as const, data: [[0, 0], [10, 100]] as [number, number][] }] };

describe('crosshair (crosshair.md 1, 2, 7)', () => {
  it('follows the pointer with the x value; goes when it leaves; under the hover layer', () => {
    const { svg } = mount(LINE);
    point(svg, 'pointermove', 300, 150);
    expect(layer(svg).querySelectorAll('line').length).toBe(1);
    expect(layer(svg).querySelector('text')!.textContent).toMatch(/^\d/);
    expect(layer(svg).nextElementSibling!.getAttribute('class')).toBe('dzgraph-hover');
    point(svg, 'pointerleave', 300, 150);
    expect(layer(svg).childElementCount).toBe(0);
  });

  it('without the option nothing is drawn; without the module the option is reported', () => {
    const off = mount({ series: LINE.series });
    point(off.svg, 'pointermove', 300, 150);
    expect(layer(off.svg).childElementCount).toBe(0);
    const missing = mount(LINE, []);
    expect(missing.c.problems).toContainEqual({ code: 'missing-module', path: 'crosshair', detail: 'crosshair' });
  });
});

describe('keyboard (crosshair.md 5)', () => {
  it('goes through the focused point, its value on the axis', () => {
    const { el, svg } = mount({ ...LINE, xAxis: { scale: 'category', categories: ['Jan', 'Feb'] }, series: [{ type: 'line', data: [3, 7] }] });
    const item = el.querySelector<SVGElement>('.dzgraph-point')!;
    item.focus();
    expect(layer(svg).querySelector('text')!.textContent).toBe('Jan');
  });
});
