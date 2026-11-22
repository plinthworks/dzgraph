// The chart menu in a real browser (menu.md): what it offers, choosing by pointer and keyboard, the view.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { aggregation, chart, compare, menu, timeAxis, type Chart, type Feature } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features: readonly Feature[] = [menu, compare, aggregation, timeAxis]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features });
  made.push({ el, c });
  return { el, c };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const key = (k: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const LINES = { menu: true, series: [{ type: 'line' as const, id: 'a', name: 'Apples', data: [1, 2, 3] }, { type: 'line' as const, id: 'b', name: 'Pears', data: [3, 2, 1] }] };

describe('the button and its menu (menu.md 1, 6)', () => {
  it('a menu button; Enter opens on the first item; Escape closes, the focus back on the button', () => {
    const { el } = mount(LINES);
    const button = el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!;
    expect([button.getAttribute('aria-haspopup'), button.getAttribute('aria-expanded'), button.getAttribute('aria-label')]).toEqual(['menu', 'false', 'Chart options']);
    button.focus();
    key('Enter');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const items = [...el.querySelectorAll('[role="menu"]:not([hidden]) > [role="menuitem"]')].map((i) => i.textContent);
    expect(items).toEqual(['Type', 'Scale', 'Comparison']);
    expect(document.activeElement!.textContent).toBe('Type');
    key('Escape');
    expect([button.getAttribute('aria-expanded'), document.activeElement]).toEqual(['false', button]);
  });

  it('without the option, no button; with nothing to offer, none either', () => {
    expect(mount({ series: LINES.series }).el.querySelector<HTMLElement>('.dzgraph-menu-button')!.hidden).toBe(true);
    const without = mount(LINES, []);
    expect(without.el.querySelector('.dzgraph-menu-button')).toBeNull();
    expect(without.c.problems).toContainEqual({ code: 'missing-module', path: 'menu', detail: 'menu' });
    expect(mount({ menu: { items: ['aggregation'] }, series: LINES.series }).el.querySelector<HTMLElement>('.dzgraph-menu-button')!.hidden).toBe(true);
  });
});

describe('choosing (menu.md 2–5, 7)', () => {
  it('Type › Pears › Column, by keys: the series becomes columns, in the view', async () => {
    const { el, c } = mount(LINES);
    el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!.focus();
    key('Enter');
    key('ArrowRight');
    // The submenu: each series' types, as radio items.
    const radios = () => [...el.querySelectorAll('[role="menu"]:not([hidden]) [role="menuitemradio"]')].map((i) => [i.closest('[role="group"]')!.getAttribute('aria-label'), i.textContent, i.getAttribute('aria-checked')]);
    expect(radios().filter((r) => r[0] === 'Pears')).toEqual([['Pears', 'Line', 'true'], ['Pears', 'Area', 'false'], ['Pears', 'Column', 'false']]);
    for (let i = 0; i < 5; i++) key('ArrowDown');
    expect(document.activeElement!.textContent).toBe('Column');
    key('Enter');
    await raf2();
    expect(c.getView().types).toEqual({ b: 'column' });
    expect(el.querySelectorAll('[data-layer="series"] rect, [data-layer="series"] path[fill]:not([fill="none"])').length).toBeGreaterThan(0);
  });

  it('Scale › Logarithmic; Comparison › Percent; offered only where they make sense', async () => {
    const { el, c } = mount(LINES);
    const open = (label: string) => {
      el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!.click();
      [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent === label)!.click();
    };
    open('Scale');
    [...el.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((i) => i.textContent === 'Logarithmic')!.click();
    open('Comparison');
    [...el.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((i) => i.textContent === 'Percent')!.click();
    await raf2();
    expect([c.getView().scale, c.getView().compare]).toEqual(['log', { mode: 'percent', to: null }]);
    // A series with a zero: no logarithmic scale offered.
    const zero = mount({ ...LINES, series: [{ type: 'line', data: [0, 1] }] });
    zero.el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!.click();
    expect([...zero.el.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent)).not.toContain('Scale');
  });

  it('Aggregation on a time axis: by month', async () => {
    const day = 86_400_000;
    const { el, c } = mount({ menu: true, xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'column', data: Array.from({ length: 90 }, (_, i) => [Date.UTC(2026, 0, 1) + i * day, 1] as [number, number]) }] });
    el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!.click();
    [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent === 'Aggregation')!.click();
    [...el.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((i) => i.textContent === 'By month')!.click();
    await raf2();
    expect(c.getView().aggregation).toEqual({ period: 'month' });
  });
});

describe('review: hidden means not shown, with the theme (menu.md 8)', () => {
  it('without the option the button takes no room and is not seen', async () => {
    const css = (await import('../../theme/dzgraph.css?raw')).default;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    try {
      const { el } = mount({ series: LINES.series });
      const b = el.querySelector<HTMLElement>('.dzgraph-menu-button')!;
      expect(getComputedStyle(b).display).toBe('none');
    } finally {
      style.remove();
    }
  });
});
