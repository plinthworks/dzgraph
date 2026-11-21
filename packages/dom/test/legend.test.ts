// The legend clicked and focused (legend-interaction.md), in a real browser. Step 2.4.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
function mount(lang = 'en') {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.setAttribute('lang', lang);
  document.body.appendChild(el);
  // The end state of each click, without animation (animation.test.ts has its own).
  const c = chart(el, { animation: false, series: [{ type: 'line', id: 'a', name: 'Apples', data: [1, 3] }, { type: 'column', id: 'b', name: 'Pears', data: [2, 4] }] }, { types: allTypes });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
const buttons = (el: HTMLElement) => [...el.querySelectorAll<SVGElement>('.dzgraph-legend-button')];
const seriesGroups = (svg: SVGSVGElement) => [...svg.querySelectorAll('[data-layer="series"] > g')];

describe('legend items are toggle buttons (legend-interaction.md 2)', () => {
  it('one per series, named, pressed while shown, in the tab order', () => {
    const { el } = mount();
    expect(buttons(el).map((b) => [b.getAttribute('role'), b.getAttribute('aria-label'), b.getAttribute('aria-pressed'), b.getAttribute('tabindex')])).toEqual([
      ['button', 'Apples', 'true', '0'],
      ['button', 'Pears', 'true', '0'],
    ]);
  });
});

describe('clicking an item (1, 5)', () => {
  it('hides its series, then shows it again; legendToggle each time', async () => {
    const { el, c, svg } = mount();
    const seen: unknown[] = [];
    c.on('legendToggle', (d) => seen.push([d.seriesId, d.shown]));
    const before = seriesGroups(svg).length;
    buttons(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await frame();
    expect(seriesGroups(svg).length).toBeLessThan(before);
    expect(buttons(el)[1]!.getAttribute('aria-pressed')).toBe('false');
    buttons(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await frame();
    expect(seriesGroups(svg).length).toBe(before);
    expect(seen).toEqual([['b', false], ['b', true]]);
  });
});

describe('the keyboard (2)', () => {
  it('Enter and Space toggle the focused item', async () => {
    const { el } = mount();
    const b = buttons(el)[0]!;
    b.focus();
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await frame();
    expect(buttons(el)[0]!.getAttribute('aria-pressed')).toBe('false');
    buttons(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await frame();
    expect(buttons(el)[0]!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('setSeriesVisible (legend-interaction.md 1, 5)', () => {
  it('hides and shows like the item, with the same event', async () => {
    const { el, c } = mount();
    const seen: unknown[] = [];
    c.on('legendToggle', (d) => seen.push([d.seriesId, d.shown]));
    c.setSeriesVisible('a', false);
    await frame();
    expect(buttons(el)[0]!.getAttribute('aria-pressed')).toBe('false');
    c.setSeriesVisible('a', false);
    c.setSeriesVisible('a', true);
    expect(seen).toEqual([['a', false], ['a', true]]);
  });
});

describe('pointing at an item (3)', () => {
  it('fades the other series', async () => {
    const { el, svg } = mount();
    buttons(el)[0]!.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    await frame();
    const faded = seriesGroups(svg).filter((g) => g.getAttribute('opacity') === '0.35');
    expect(faded.length).toBeGreaterThan(0);
    buttons(el)[0]!.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    await frame();
    expect(seriesGroups(svg).filter((g) => g.getAttribute('opacity') === '0.35')).toEqual([]);
  });
});

describe('the announcement (screen-reader.md 5)', () => {
  it('says what the user did, in the page\'s language', async () => {
    const { el } = mount('fr');
    buttons(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await frame();
    const live = el.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe('Pears masquée');
  });
});
