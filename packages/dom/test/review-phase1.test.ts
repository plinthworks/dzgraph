// The Phase 1 code review's findings in the DOM layer (2026-11-21), reproduced first, then fixed.
import { describe, it, expect, afterEach } from 'vitest';
import { line } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
function mount(style: string, attrs: Record<string, string> = {}) {
  const el = document.createElement('div');
  el.setAttribute('style', style);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}

describe('review 1: a page language Intl refuses', () => {
  it('chart() draws instead of throwing', () => {
    const el = mount('inline-size:400px;block-size:300px', { lang: 'en_US' });
    const c = chart(el, { series: [{ type: 'line', data: [1, 2] }] }, { types: [line] });
    made.push({ el, c });
    expect(el.querySelectorAll('text').length).toBeGreaterThan(0);
  });
});

describe('review 12: update() with what plain JavaScript can pass', () => {
  it('never throws; the problem is reported', async () => {
    const el = mount('inline-size:400px;block-size:300px');
    const c = chart(el, { series: [{ type: 'line', data: [1, 2] }] }, { types: [line] });
    made.push({ el, c });
    expect(() => c.update(null as never)).not.toThrow(); // what an untyped caller may pass, on purpose
    expect(() => c.update({ series: 5 } as never)).not.toThrow(); // idem
    await frame();
    expect(c.problems.map((p) => `${p.code} ${p.path}`)).toContain('invalid-option series');
  });
});

describe('review 13: drawn once at creation', () => {
  for (const [what, style] of [['a container with a height', 'inline-size:400px;block-size:300px'], ['a container without one', 'inline-size:400px']] as const) {
    it(`${what}: no second drawing on the frames after`, async () => {
      const el = mount(style);
      let paints = 0;
      const watch = new MutationObserver((records) => (paints += records.filter((r) => r.attributeName === 'viewBox').length));
      const c = chart(el, { series: [{ type: 'line', data: [1, 2] }] }, { types: [line] });
      made.push({ el, c });
      watch.observe(el.querySelector('svg')!, { attributes: true });
      for (let i = 0; i < 4; i++) await frame();
      watch.disconnect();
      expect(paints).toBe(0);
    });
  }
});

describe('architecture check: the view keeps what the user changed (GLOSSARY: Hidden series)', () => {
  it('initiallyHidden is read once per series id: options rebuilt later do not show it again', async () => {
    const el = mount('inline-size:400px;block-size:300px');
    const c = chart(el, { series: [{ type: 'line', id: 'a', data: [1, 2] }, { type: 'line', id: 'b', data: [3, 4], initiallyHidden: true }] }, { types: [line] });
    made.push({ el, c });
    c.update({ series: [{ type: 'line', id: 'a', data: [1, 2] }, { type: 'line', id: 'b', data: [3, 5], initiallyHidden: false }] });
    await frame();
    const drawn = [...el.querySelectorAll('[data-layer="series"] path')].length;
    expect(drawn).toBe(1);
  });
});
