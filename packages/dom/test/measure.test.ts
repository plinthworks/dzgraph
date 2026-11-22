// The mode bar and measuring in a real browser (modes.md, measure.md). Phase 5a step 5.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, measure, zoom, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features = [zoom, measure]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
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
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
function point(svg: SVGSVGElement, type: string, x: number, y: number, extra: PointerEventInit = {}) {
  const box = svg.getBoundingClientRect();
  svg.dispatchEvent(new PointerEvent(type, { clientX: box.left + x, clientY: box.top + y, pointerType: 'mouse', bubbles: true, isPrimary: true, button: 0, pointerId: 1, ...extra }));
}
const CAT = { xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb', 'Mar'] }, series: [{ type: 'line' as const, id: 'a', name: 'A', data: [10, 20, 15] }] };
/** A point's place on screen: its keyboard item's centre. */
function at(el: HTMLElement, svg: SVGSVGElement, i: number) {
  const items = [...el.querySelectorAll<SVGElement>('.dzgraph-point')];
  const box = svg.getBoundingClientRect();
  const r = items[i]!.getBoundingClientRect();
  return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
}

describe('the mode bar (modes.md 1–3, 6)', () => {
  it('with zoom and measure: two pressed-or-not buttons, one tab stop; a click changes the mode', async () => {
    const { el, c } = mount(CAT);
    const bar = el.querySelector<HTMLElement>('.dzgraph-modes')!;
    expect([bar.hidden, bar.getAttribute('role'), bar.getAttribute('aria-label')]).toEqual([false, 'toolbar', 'Chart mode']);
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed'), b.tabIndex])).toEqual([['Zoom', 'true', 0], ['Measure', 'false', -1]]);
    const seen: unknown[] = [];
    c.on('modeChange', (d) => seen.push(d.mode));
    buttons[1]!.click();
    await raf2();
    expect([c.mode, seen, buttons[1]!.getAttribute('aria-pressed')]).toEqual(['measure', ['measure'], 'true']);
  });

  it('one mode only: no bar', () => {
    const { el } = mount(CAT, [zoom]);
    expect(el.querySelector('.dzgraph-modes')).toBeNull();
  });
});

describe('measuring (measure.md 1, 2, 4, 7)', () => {
  it('a drag from Jan to Feb keeps a measure with its tag; Escape removes it', async () => {
    const { el, c, svg } = mount(CAT);
    c.setMode('measure');
    await raf2();
    const seen: unknown[] = [];
    c.on('measure', (d) => seen.push(d && [d.from.index, d.to.index]));
    const a = at(el, svg, 0);
    const b = at(el, svg, 1);
    point(svg, 'pointerdown', a.x, a.y);
    point(svg, 'pointermove', b.x, b.y);
    point(svg, 'pointerup', b.x, b.y);
    expect(svg.querySelector('.dzgraph-measure text')!.textContent).toBe('+10 (+100%) · 1 category');
    expect(seen).toEqual([[0, 1]]);
    // The live region reads it.
    expect([...el.querySelectorAll('[aria-live]')].some((n) => n.textContent === 'Difference: +10 (+100%), over 1 category.')).toBe(true);
    // Zooming keeps it, placed on its points (measure.md 4).
    c.setRange({ min: 0, max: 1.5 });
    await raf2();
    expect(svg.querySelector('.dzgraph-measure line')).not.toBeNull();
    el.querySelector<HTMLElement>('.dzgraph-modes button')!.focus();
    el.querySelector<HTMLElement>('.dzgraph-modes')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(svg.querySelector('.dzgraph-measure')!.childElementCount).toBe(0);
    expect(seen.at(-1)).toBeNull();
  });

  it('in zoom mode a drag zooms, not measures', async () => {
    const { c, svg } = mount({ series: [{ type: 'line', data: Array.from({ length: 50 }, (_, i) => i % 7) }] });
    point(svg, 'pointerdown', 150, 150);
    point(svg, 'pointermove', 250, 150);
    point(svg, 'pointermove', 350, 150);
    point(svg, 'pointerup', 350, 150);
    await raf2();
    expect(svg.querySelector('.dzgraph-measure')!.childElementCount).toBe(0);
    expect(c.getView().range).not.toBeNull();
  });
});

describe('measuring from the keyboard (measure.md 5)', () => {
  it('M on a point, an arrow, M again: kept and read', () => {
    const { el, svg } = mount(CAT);
    const first = el.querySelector<SVGElement>('.dzgraph-point')!;
    first.focus();
    const key = (k: string) => (document.activeElement as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('m');
    key('ArrowRight');
    key('m');
    expect(svg.querySelector('.dzgraph-measure text')!.textContent).toBe('+10 (+100%) · 1 category');
    key('Escape');
    expect(svg.querySelector('.dzgraph-measure')!.childElementCount).toBe(0);
  });
});
