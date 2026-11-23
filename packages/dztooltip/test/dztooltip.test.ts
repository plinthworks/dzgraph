// The points' tooltip drawn by DzTooltip, in a real browser (dztooltip.md): the bubble, its look, its content, when
// and where. Phase 7b.
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';
import { dzTooltip } from '@dzgraph/dztooltip';

let theme: HTMLStyleElement;
beforeAll(async () => {
  theme = document.createElement('style');
  theme.textContent = (await import('../../theme/dzgraph.css?raw')).default;
  document.head.appendChild(theme);
});
afterAll(() => theme.remove());

const made: { el: HTMLElement; c: Chart }[] = [];
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
/** A focus that scrolls nothing: a scroll of the page hides DzTooltip's bubbles (its rule, dztooltip.md 3). */
const focusHere: FocusOptions = { preventScroll: true };
/** DzTooltip's bubble on screen, if any. */
const bubble = () => [...document.querySelectorAll<HTMLElement>('.dzt-tooltip')].find((b) => !b.hidden) ?? null;

function mount(options: Parameters<typeof dzTooltip>[0] = {}, dir = 'ltr') {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px;margin:120px 40px');
  el.lang = 'en';
  el.dir = dir;
  document.body.appendChild(el);
  const c = chart(el, { animation: false, xAxis: { scale: 'category', categories: ['Jan', 'Feb', 'Mar'] }, series: [{ type: 'line', id: 'a', name: 'Apples', data: [10, 20, 30] }] }, { types: allTypes, features: [dzTooltip(options)] });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}

describe('the bubble (dztooltip.md 1–4)', () => {
  it('a DzTooltip bubble with the chart\'s words, the look asked, beside the point', async () => {
    const { el } = mount({ tone: 'info', placement: 'top' });
    await raf2();
    el.querySelectorAll<SVGElement>('.dzgraph-point')[1]!.focus(focusHere);
    await raf2();
    const b = bubble()!;
    expect(b).not.toBeNull();
    expect(b.textContent).toContain('Feb');
    expect(b.textContent).toContain('Apples');
    expect(b.getAttribute('data-tone')).toBe('info');
    // The chart's own card is never shown.
    expect(el.querySelector<HTMLElement>('.dzgraph-tooltip')?.hidden ?? true).toBe(true);
    // Above the point (placement top): its bottom over the point's centre.
    const point = el.querySelectorAll<SVGElement>('.dzgraph-point')[1]!.getBoundingClientRect();
    const box = b.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(point.top + point.height / 2 + 1);
    expect(Math.abs(box.left + box.width / 2 - (point.left + point.width / 2))).toBeLessThan(box.width / 2);
  });

  it('the series\' sign keeps its colour out of the chart (the theme on the content)', async () => {
    const { el } = mount();
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus(focusHere);
    await raf2();
    const sign = bubble()!.querySelector('.dzgraph-tooltip-sign > *')!;
    const fill = getComputedStyle(sign).fill;
    expect(fill).not.toBe('rgb(0, 0, 0)');
    expect(fill).not.toBe('none');
  });

  it('Escape hides it; destroying the chart takes it away', async () => {
    const { el, c } = mount();
    await raf2();
    const p = el.querySelector<SVGElement>('.dzgraph-point')!;
    p.focus(focusHere);
    await raf2();
    expect(bubble()).not.toBeNull();
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await raf2();
    expect(bubble()).toBeNull();
    p.focus(focusHere);
    el.querySelectorAll<SVGElement>('.dzgraph-point')[2]!.focus(focusHere);
    await raf2();
    expect(bubble()).not.toBeNull();
    c.destroy();
    await raf2();
    expect(bubble()).toBeNull();
  });

  it('a scroll of the page hides it, as every DzTooltip tooltip (dztooltip.md 3)', async () => {
    const { el } = mount();
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus(focusHere);
    await raf2();
    expect(bubble()).not.toBeNull();
    document.dispatchEvent(new Event('scroll'));
    await raf2();
    expect(bubble()).toBeNull();
  });

  it('right to left: the chart\'s rows read right to left in the bubble', async () => {
    const { el } = mount({}, 'rtl');
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus(focusHere);
    await raf2();
    expect(bubble()!.querySelector<HTMLElement>('.dzgraph-tooltip-content')!.dir).toBe('rtl');
  });
});

describe('review (Phase 7b close)', () => {
  it('review 3: the pointer moving over the same point does not show the bubble again', async () => {
    const { el, svg } = mount();
    await raf2();
    const p = el.querySelectorAll<SVGElement>('.dzgraph-point')[1]!.getBoundingClientRect();
    const at = (dx: number) => svg.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x + p.width / 2 + dx, clientY: p.y + p.height / 2, pointerType: 'mouse', bubbles: true }));
    at(0);
    await raf2();
    const b = bubble()!;
    let changes = 0;
    const seen = new MutationObserver((r) => (changes += r.length));
    seen.observe(b, { attributes: true, childList: true, subtree: true });
    at(1);
    at(2);
    at(1);
    await raf2();
    seen.disconnect();
    expect(changes).toBe(0);
  });

  it('review 3: hidden by a scroll, the same point pointed at again shows it again', async () => {
    const { el, svg } = mount();
    await raf2();
    const p = el.querySelectorAll<SVGElement>('.dzgraph-point')[1]!.getBoundingClientRect();
    const at = () => svg.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x + p.width / 2, clientY: p.y + p.height / 2, pointerType: 'mouse', bubbles: true }));
    at();
    await raf2();
    document.dispatchEvent(new Event('scroll'));
    await raf2();
    expect(bubble()).toBeNull();
    at();
    await raf2();
    expect(bubble()).not.toBeNull();
  });

  it('review 4: an Escape that is not the chart\'s leaves its bubble; the chart\'s own hides it', async () => {
    const { el } = mount();
    await raf2();
    const p = el.querySelector<SVGElement>('.dzgraph-point')!;
    p.focus(focusHere);
    await raf2();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await raf2();
    expect(bubble()).not.toBeNull();
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await raf2();
    expect(bubble()).toBeNull();
  });

  it('review 5: the bubble follows the chart when the page reflows', async () => {
    const { el } = mount();
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus(focusHere);
    await raf2();
    const before = bubble()!.getBoundingClientRect().y;
    el.style.marginBlockStart = '170px';
    window.dispatchEvent(new Event('resize'));
    await raf2();
    await raf2();
    expect(Math.round(bubble()!.getBoundingClientRect().y - before)).toBe(50);
  });
});

