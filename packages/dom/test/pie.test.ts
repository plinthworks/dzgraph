// Pie and donut in a real browser (pie-donut.md 9–15, ADR 0007): labels drawn, the legend's slices hide and show,
// hover brings a slice out with its tooltip, the keyboard goes round, screen readers and the table, in English and
// French. Phase 4 step 6.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart, type ChartEvents } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

function mount(options: Parameters<typeof chart>[1], lang = 'en', width = 600) {
  const el = document.createElement('div');
  el.setAttribute('style', `inline-size:${width}px;block-size:400px`);
  el.lang = lang;
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes });
  made.push({ el, c });
  const toggles: ChartEvents['legendToggle'][] = [];
  c.on('legendToggle', (d) => toggles.push(d));
  return { el, c, svg: el.querySelector('svg')!, toggles };
}

const FRUIT = { series: [{ type: 'pie' as const, id: 's', name: 'Orchard', data: [['Apples', 50], ['Pears', 30], ['Plums', 20]] as [string, number][] }], dataTable: true };
const texts = (svg: SVGSVGElement) => [...svg.querySelectorAll('text')].map((t) => t.textContent);
const described = (el: HTMLElement) => document.getElementById(el.querySelector('[role="figure"]')!.getAttribute('aria-describedby')!)!.textContent;

describe('a pie in the page', () => {
  it('its labels with shares, three slices, no legend', () => {
    const { el, svg } = mount(FRUIT);
    expect(texts(svg)).toEqual(expect.arrayContaining(['Apples 50%', 'Pears 30%', 'Plums 20%']));
    expect(svg.querySelectorAll('[data-layer="series"] path').length).toBe(3);
    expect(el.querySelector('.dzgraph-legend-button')).toBeNull();
  });

  it('hovering a slice: its tooltip, the slice brought out', async () => {
    const { el, svg } = mount(FRUIT);
    const slice = svg.querySelector('[data-layer="series"] path')!;
    const before = slice.getAttribute('d');
    const r = slice.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.6, clientY: r.top + r.height / 2, pointerType: 'mouse', bubbles: true, isPrimary: true }));
    await frames();
    const tip = el.querySelector<HTMLElement>('.dzgraph-tooltip')!;
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector('.dzgraph-tooltip-heading')!.textContent).toBe('Apples');
    expect(tip.querySelector('.dzgraph-tooltip-share')!.textContent).toBe('50%');
    expect(svg.querySelector('[data-layer="series"] path')!.getAttribute('d')).not.toBe(before);
  });

  it('a slice read with its share; the summary names the largest; the table gives the shares (French)', () => {
    const { el } = mount(FRUIT, 'fr');
    expect(el.querySelector('.dzgraph-point[tabindex="0"]')!.getAttribute('aria-label')).toBe('Apples : 50, 50\u00a0%. Part 1 sur 3.');
    expect(described(el)).toBe('Graphique en secteurs, 3 parts. La plus grande : Apples, 50\u00a0%.');
    const rows = [...el.querySelectorAll('table tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toEqual([['Catégorie', 'Orchard', 'Part'], ['Apples', '50', '50\u00a0%'], ['Pears', '30', '30\u00a0%'], ['Plums', '20', '20\u00a0%']]);
  });

  it('the keyboard goes round the slices', () => {
    const { el } = mount(FRUIT);
    const first = el.querySelector<SVGElement>('.dzgraph-point[tabindex="0"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Pears: 30, 30%. Slice 2 of 3.');
  });

  it('too narrow: the legend lists the slices; a click hides one and the others share the whole', async () => {
    const { el, svg, toggles } = mount(FRUIT, 'en', 220);
    const buttons = [...el.querySelectorAll('.dzgraph-legend-button')];
    expect(buttons.map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual([['Apples', 'true'], ['Pears', 'true'], ['Plums', 'true']]);
    buttons[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await frames();
    expect(toggles).toEqual([{ seriesId: 's', index: 0, shown: false }]);
    expect(svg.querySelectorAll('[data-layer="series"] path').length).toBe(2);
    expect(el.querySelector('.dzgraph-legend-button')!.getAttribute('aria-pressed')).toBe('false');
  });
});
