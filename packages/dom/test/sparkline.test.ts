// Sparklines in a real browser (sparkline.md): words, size and stretching, round dots, direction, colours, update.
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { sparkline, type SparklineHandle } from '@dzgraph/dom/sparkline';

let theme: HTMLStyleElement;
beforeAll(async () => {
  theme = document.createElement('style');
  theme.textContent = (await import('../../theme/dzgraph.css?raw')).default;
  document.head.appendChild(theme);
});
afterAll(() => theme.remove());

const made: { el: HTMLElement; s: SparklineHandle }[] = [];
function mount(values: ArrayLike<number | null>, options: Parameters<typeof sparkline>[2] = {}, lang = 'en', dir = 'ltr') {
  const el = document.createElement('p');
  el.lang = lang;
  el.dir = dir;
  el.style.fontSize = '20px';
  document.body.appendChild(el);
  const s = sparkline(el, values, options);
  made.push({ el, s });
  return { el, s, svg: el.querySelector('svg')! };
}
afterEach(() => {
  for (const { el, s } of made.splice(0)) {
    s.destroy();
    el.remove();
  }
});

describe('words (sparkline.md 6)', () => {
  it('an image named by its summary, in the page\'s language', () => {
    expect(mount([1, 5, 4]).svg.getAttribute('aria-label')).toBe('3 values, from 1 to 5, last 4');
    expect(mount([1.5, 1200, 4], {}, 'fr').svg.getAttribute('aria-label')).toBe('3 valeurs, de 1,5 à 1 200, dernière 4');
    const one = mount([27]).svg;
    expect([one.getAttribute('role'), one.getAttribute('aria-label')]).toEqual(['img', '1 value: 27']);
  });

  it('all gaps: no data; the app\'s label before the summary', () => {
    expect(mount([null, null]).svg.getAttribute('aria-label')).toBe('No data');
    expect(mount([1, 2], { label: 'Visits' }).svg.getAttribute('aria-label')).toBe('Visits: 2 values, from 1 to 2, last 2');
  });
});

describe('size (sparkline.md 7)', () => {
  it('6em × 1.2em by default; stretched by the app\'s CSS, lines and dots keeping their width', () => {
    const { svg } = mount([0, 10, 5]);
    const box = svg.getBoundingClientRect();
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([120, 24]);
    svg.style.inlineSize = '300px';
    svg.style.blockSize = '60px';
    const line = svg.querySelector('.dzgraph-sparkline-line')!.getBoundingClientRect();
    // The line spans the box (its stroke past it by half its width at most).
    expect(Math.abs(line.width - 300)).toBeLessThan(3);
    // The last point's dot stays round whatever the stretch. (Its size is not read here: Firefox's box counts a
    // non-scaling stroke as if it were scaled; the drawing itself was looked at in the three engines.)
    const dot = svg.querySelector('.dzgraph-sparkline-marker')!.getBoundingClientRect();
    expect(Math.abs(dot.width - dot.height)).toBeLessThan(1);
  });
});

describe('direction and colours (sparkline.md 8, 9)', () => {
  it('right to left: time still runs left to right', () => {
    const { svg } = mount([0, 10], { markers: 'last' }, 'ar', 'rtl');
    const dot = svg.querySelector('.dzgraph-sparkline-marker')!.getBoundingClientRect();
    const box = svg.getBoundingClientRect();
    // The last point is at the right end.
    expect(Math.abs(dot.x + dot.width / 2 - box.right)).toBeLessThan(2);
  });

  it('the theme\'s colours: the line a series colour, a negative column the negative one', () => {
    const { svg } = mount([2, -2], { type: 'column', markers: 'none' });
    const [up, down] = [...svg.querySelectorAll('rect')].map((r) => getComputedStyle(r).fill);
    expect(up).not.toBe(down);
    expect(up).not.toBe('rgb(0, 0, 0)');
  });
});

describe('update and problems (sparkline.md 1, 2)', () => {
  it('update draws again; a bad value reported, the rest drawn; destroy removes it', () => {
    const { el, s, svg } = mount([1, 2]);
    s.update([1, 2, 'x' as never /* plain JavaScript may pass anything */, 3, 4], { type: 'area' });
    expect(s.problems).toEqual([{ code: 'invalid-data', path: 'values[2]', detail: 'count=1' }]);
    expect(svg.querySelector('.dzgraph-sparkline-area')).not.toBeNull();
    s.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });
});

describe('review (Phase 7a close)', () => {
  it('review 1: an empty or malformed language does not throw: the browser\'s is used', () => {
    expect(mount([1, 2], {}, '').svg.getAttribute('aria-label')).toMatch(/2/);
    expect(mount([1, 2], { locale: 'fr_FR' }).svg.getAttribute('aria-label')).toMatch(/2/);
  });

  it('review 3: points alone are dots', () => {
    expect(mount([1, null, 3, null, 5], { markers: 'none' }).svg.querySelectorAll('.dzgraph-sparkline-dot').length).toBe(3);
  });

  it('review 2: null options are no options', () => {
    expect(mount([1, 2], null as never /* plain JavaScript may pass null */).svg.getAttribute('aria-label')).toBe('2 values, from 1 to 2, last 2');
  });
});

