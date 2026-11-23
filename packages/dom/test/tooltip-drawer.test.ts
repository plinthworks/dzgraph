// The points' tooltip drawn by a module (dztooltip.md 1–4, 7): the seam the DzTooltip bridge plugs into. A fake drawer
// here; the bridge's own tests use DzTooltip. Phase 7b.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart, type Feature, type TooltipDrawer } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** A drawer that writes down what it is asked. */
function fake() {
  const log: { what: string; text?: string; at?: { x: number; y: number }; dir?: string; classes?: string }[] = [];
  const drawer: TooltipDrawer = {
    show: (content, at, dir) => log.push({ what: 'show', text: content.textContent ?? '', at: at(), dir, classes: content.className }),
    hide: () => log.push({ what: 'hide' }),
    destroy: () => log.push({ what: 'destroy' }),
  };
  const feature: Feature = { name: 'tooltip', tooltip: () => drawer };
  return { log, feature };
}

const LINES = {
  xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb', 'Mar'] },
  series: [{ type: 'line' as const, id: 'a', name: 'Apples', data: [10, 20, 30] }],
};

function mount(f: Feature) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...LINES }, { types: allTypes, features: [f] });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}

describe('a tooltip drawer (dztooltip.md)', () => {
  it('the chart\'s content, at the point in the window, in its direction; its own card never shown', async () => {
    const { log, feature } = fake();
    const { el, svg } = mount(feature);
    await raf2();
    // The middle point (Feb, 20), by the keyboard.
    const items = el.querySelectorAll<SVGElement>('.dzgraph-point');
    items[1]!.focus();
    const shown = log.filter((l) => l.what === 'show').at(-1)!;
    expect(shown.text).toContain('Feb');
    expect(shown.text).toContain('Apples');
    expect(shown.dir).toBe('ltr');
    // The content keeps the chart's classes, so the theme colours its signs.
    expect(shown.classes).toBe('dzgraph-tooltip-content');
    // At the point: inside the chart's box, in window coordinates.
    const box = svg.getBoundingClientRect();
    expect(shown.at!.x).toBeGreaterThan(box.left);
    expect(shown.at!.x).toBeLessThan(box.right);
    expect(el.querySelector<HTMLElement>('.dzgraph-tooltip')?.hidden ?? true).toBe(true);
  });

  it('hidden on Escape and when the focus leaves; destroyed with the chart', async () => {
    const { log, feature } = fake();
    const { el, c } = mount(feature);
    await raf2();
    const first = el.querySelector<SVGElement>('.dzgraph-point')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(log.at(-1)!.what).toBe('hide');
    c.destroy();
    expect(log.at(-1)!.what).toBe('destroy');
  });
});
