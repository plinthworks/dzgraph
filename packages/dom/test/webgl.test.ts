// The WebGL2 painter in a real browser (ADR 0008, big-data.md 6–10): a dense scatter drawn by WebGL2 under the other
// planes, looking as on Canvas, exact at any zoom; a context opened only when needed, given back on destroy, and
// Canvas drawing while it is lost. Phase 3 bis step 4.
import { describe, it, expect, afterEach } from 'vitest';
import { line, scatter } from '@dzgraph/core';
import type { Primitive, Scene } from '@dzgraph/core';
import { WEBGL_THRESHOLD } from '@dzgraph/core/internal';
import { chart, webgl, type Chart } from '@dzgraph/dom';
import { WebglPainter } from '../src/webgl-painter.js';
import { CanvasPainter } from '../src/canvas-painter.js';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: [line, scatter], features: [webgl] });
  made.push({ el, c });
  return { el, c };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

const cloud = (n: number) => ({ x: Float64Array.from({ length: n }, (_, i) => (i * 7919) % 1000), y: Float64Array.from({ length: n }, (_, i) => (i * 104729) % 1000) });
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** The planes in the root, back to front: [WebGL2, Canvas]. */
const planes = (el: HTMLElement) => [...el.querySelectorAll('canvas')] as [HTMLCanvasElement, HTMLCanvasElement];

/** Drawn pixels of a WebGL2 canvas, read in the task that drew them, top row first. */
function glPixels(canvas: HTMLCanvasElement): Uint8Array {
  const gl = canvas.getContext('webgl2')!;
  const out = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
  const row = canvas.width * 4;
  const flipped = new Uint8Array(out.length);
  for (let y = 0; y < canvas.height; y++) flipped.set(out.subarray((canvas.height - 1 - y) * row, (canvas.height - y) * row), y * row);
  return flipped;
}
const inked = (px: Uint8Array) => {
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) n++;
  return n;
};

describe('routing (big-data.md 6, 10)', () => {
  it('a dense scatter on the WebGL2 plane, the Canvas plane empty, the axes in SVG', () => {
    const { el } = mount({ series: [{ type: 'scatter', data: cloud(WEBGL_THRESHOLD + 1) }] });
    const [gl, cv] = planes(el);
    expect([gl.style.display, cv.style.display]).toEqual(['block', 'none']);
    expect(inked(glPixels(gl))).toBeGreaterThan(10_000);
    expect(el.querySelector('svg [data-layer="series"] circle')).toBeNull();
  });

  it('a chart without a dense scatter opens no WebGL context', () => {
    const { el } = mount({ series: [{ type: 'scatter', data: cloud(3000) }] });
    // A canvas with a WebGL context gives no 2D one: asking for one shows none was opened.
    expect(planes(el)[0].getContext('2d')).not.toBeNull();
  });

  it('destroyed, it gives its context back at once', () => {
    const { el, c } = mount({ series: [{ type: 'scatter', data: cloud(WEBGL_THRESHOLD + 1) }] });
    const gl = planes(el)[0].getContext('webgl2')!;
    c.destroy();
    expect(gl.isContextLost()).toBe(true);
  });
});

describe('hover (big-data.md 8)', () => {
  it('pointing at a drawn point of a WebGL2 scatter finds it: the tooltip, the event', () => {
    // Every point at (0, 0) but two: (5, 5) in the plot's middle, (10, 10) at its corner.
    const n = WEBGL_THRESHOLD + 1;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    x[n - 2] = y[n - 2] = 5;
    x[n - 1] = y[n - 1] = 10;
    const { el, c } = mount({ series: [{ type: 'scatter', id: 's', name: 'Cloud', data: { x, y } }] });
    const a = glPixels(planes(el)[0]);
    const width = planes(el)[0].width;
    const dpr = devicePixelRatio;
    // The inked pixel nearest the chart's middle: the point at (5, 5).
    let best = { x: 0, y: 0, d: Infinity };
    for (let i = 3; i < a.length; i += 4)
      if (a[i]! > 200) {
        const px = ((i - 3) / 4) % width;
        const py = Math.floor((i - 3) / 4 / width);
        const d = Math.hypot(px / dpr - 300, py / dpr - 200);
        if (d < best.d) best = { x: px, y: py, d };
      }
    const seen: unknown[] = [];
    c.on('pointHover', (d) => seen.push(d.point && [d.point.seriesId, d.point.index]));
    const svg = el.querySelector('svg')!;
    const box = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + best.x / dpr, clientY: box.top + best.y / dpr, pointerType: 'mouse', bubbles: true, isPrimary: true }));
    expect(seen).toEqual([['s', n - 2]]);
    expect(el.querySelector<HTMLElement>('.dzgraph-tooltip')!.hidden).toBe(false);
  });
});

describe('values the card must hold', () => {
  it('a column of zeros, and one of tiny values, are drawn where they belong', () => {
    const h = document.createElement('div');
    h.setAttribute('style', 'position:relative;inline-size:200px;block-size:100px');
    document.body.appendChild(h);
    const w = new WebglPainter(h, () => {});
    expect(w.ready()).toBe(true);
    // x all 0 at 100 px; y 1e-9 and 2e-9 at 40 and 80 px.
    const p = { kind: 'points', sceneId: 'b', seriesId: 's', paint: { fill: 'series-1' }, x: Float64Array.of(0, 0), y: Float64Array.of(1e-9, 2e-9), mapX: { d0: 0, r0: 100, k: 1, log: false }, mapY: { d0: 0, r0: 0, k: 4e10, log: false }, swapped: false, size: 8, symbol: 'circle' } as const;
    w.paint({ width: 200, height: 100, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 200, height: 100 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'webgl2', items: [p] }] }] }, {}, () => true);
    const a = glPixels(w.canvas);
    const dpr = devicePixelRatio;
    const alpha = (x: number, y: number) => a[(Math.floor(y * dpr) * w.canvas.width + Math.floor(x * dpr)) * 4 + 3]!;
    expect([alpha(100, 40), alpha(100, 80), alpha(100, 60)]).toEqual([255, 255, 0]);
    w.destroy();
    h.remove();
  });
});

describe('review (Phase 3 bis close)', () => {
  const host = () => {
    const h = document.createElement('div');
    h.setAttribute('style', 'position:relative;inline-size:200px;block-size:100px');
    document.body.appendChild(h);
    return h;
  };
  const sceneOf = (items: Primitive[]): Scene => ({ width: 200, height: 100, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 200, height: 100 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'webgl2', items }] }] });

  it('a point at its column\'s top, the view\'s origin far the other side: still where it belongs (no int32 wrap)', () => {
    // x 2²⁰ with the origin at −2²¹: 3 × 2²⁰ from it, × 1e-5 → 31.46 px past 20, at 51.46.
    const p = { kind: 'points', sceneId: 'b', seriesId: 's', paint: { fill: 'series-1' }, x: Float64Array.of(0, 2 ** 20), y: Float64Array.of(50, 50), mapX: { d0: -(2 ** 21), r0: 20, k: 1e-5, log: false }, mapY: { d0: 0, r0: 0, k: 1, log: false }, swapped: false, size: 8, symbol: 'circle' } as const;
    const h = host();
    const w = new WebglPainter(h, () => {});
    expect(w.ready()).toBe(true);
    w.paint(sceneOf([p]), {}, () => true);
    const a = glPixels(w.canvas);
    const dpr = devicePixelRatio;
    const alpha = (x: number, y: number) => a[(Math.floor(y * dpr) * w.canvas.width + Math.floor(x * dpr)) * 4 + 3]!;
    expect([alpha(51.5, 50), alpha(9.5, 50)]).toEqual([255, 0]);
    w.destroy();
    h.remove();
  });

  it('without a way to read a colour, it draws nothing rather than black', () => {
    const real = HTMLCanvasElement.prototype.getContext;
    // The 1×1 reader is the only 2D context the painter asks for.
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind === '2d' ? null : (real as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof real;
    const h = host();
    let w: WebglPainter;
    try {
      w = new WebglPainter(h, () => {});
    } finally {
      HTMLCanvasElement.prototype.getContext = real;
    }
    expect(w.ready()).toBe(true);
    const p = { kind: 'points', sceneId: 'b', seriesId: 's', paint: { fill: 'series-1' }, x: Float64Array.of(100), y: Float64Array.of(50), mapX: { d0: 0, r0: 0, k: 1, log: false }, mapY: { d0: 0, r0: 0, k: 1, log: false }, swapped: false, size: 8, symbol: 'circle' } as const;
    w.paint(sceneOf([p]), {}, () => true);
    expect(inked(glPixels(w.canvas))).toBe(0);
    w.destroy();
    h.remove();
  });
});

describe('lost and back (big-data.md 9)', () => {
  it('while its context is lost, Canvas draws the scatter; when it comes back, WebGL2 again', async () => {
    const { el } = mount({ series: [{ type: 'scatter', data: cloud(WEBGL_THRESHOLD + 1) }] });
    const [glCanvas, cv] = planes(el);
    const lose = glCanvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    // The events come in a later task, sooner or later depending on the browser.
    const event = (name: string) => new Promise<void>((r) => glCanvas.addEventListener(name, () => r(), { once: true }));
    const lost = event('webglcontextlost');
    lose.loseContext();
    await lost;
    await raf2();
    expect([glCanvas.style.display, cv.style.display]).toEqual(['none', 'block']);
    const back = event('webglcontextrestored');
    lose.restoreContext();
    await back;
    await raf2();
    expect([glCanvas.style.display, cv.style.display]).toEqual(['block', 'none']);
  });
});

describe('the same picture as Canvas (big-data.md 6)', () => {
  const host = () => {
    const h = document.createElement('div');
    h.setAttribute('style', 'position:relative;inline-size:200px;block-size:100px');
    h.className = 'dzgraph';
    document.body.appendChild(h);
    return h;
  };
  const sceneOf = (items: Primitive[]): Scene => ({ width: 200, height: 100, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 200, height: 100 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'webgl2', items }] }] });

  for (const symbol of ['circle', 'square', 'diamond', 'triangle', 'triangle-down'] as const)
    it(`${symbol}: same colour at each centre, about the same ink`, () => {
      // Points 20 px apart, none touching: x 10…190, y 10…90.
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) (xs.push(10 + i * 20), ys.push(10 + j * 20));
      const p = { kind: 'points', sceneId: 'b', seriesId: 's', paint: { fill: 'series-1', opacity: 0.8 }, x: Float64Array.from(xs), y: Float64Array.from(ys), mapX: { d0: 0, r0: 0, k: 1, log: false }, mapY: { d0: 0, r0: 0, k: 1, log: false }, swapped: false, size: 8, symbol } as const;
      const h = host();
      const w = new WebglPainter(h, () => {});
      expect(w.ready()).toBe(true);
      w.paint(sceneOf([p]), {}, () => true);
      const a = glPixels(w.canvas);
      const c = new CanvasPainter(h);
      c.paint(sceneOf([p]), {}, () => true);
      const b = c.canvas.getContext('2d')!.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
      const width = w.canvas.width;
      const dpr = devicePixelRatio;
      for (let k = 0; k < xs.length; k++) {
        const at = (Math.floor(ys[k]! * dpr) * width + Math.floor(xs[k]! * dpr)) * 4;
        for (let ch = 0; ch < 4; ch++) expect(Math.abs(a[at + ch]! - b[at + ch]!), `${symbol} point ${k} channel ${ch}`).toBeLessThanOrEqual(3);
      }
      const ia = inked(a);
      const ib = inked(new Uint8Array(b.buffer));
      expect(Math.abs(ia - ib) / ib).toBeLessThan(0.15);
      w.destroy();
      c.destroy();
      h.remove();
    });

  it('exact at any zoom: milliseconds since 1970, one apart, 50 px apart on screen', () => {
    const t0 = 1_763_000_000_000;
    const p = { kind: 'points', sceneId: 'b', seriesId: 's', paint: { fill: 'series-1' }, x: Float64Array.of(t0 + 1, t0 + 2, t0 + 3), y: Float64Array.of(50, 50, 50), mapX: { d0: t0, r0: 0, k: 50, log: false }, mapY: { d0: 0, r0: 0, k: 1, log: false }, swapped: false, size: 8, symbol: 'circle' } as const;
    const h = host();
    const w = new WebglPainter(h, () => {});
    expect(w.ready()).toBe(true);
    w.paint(sceneOf([p]), {}, () => true);
    const a = glPixels(w.canvas);
    const width = w.canvas.width;
    const dpr = devicePixelRatio;
    const alpha = (x: number, y: number) => a[(Math.floor(y * dpr) * width + Math.floor(x * dpr)) * 4 + 3]!;
    // Centres at 50, 100, 150; nothing at 75 or 125, nor 4.5 px either side of a centre.
    expect([alpha(50, 50), alpha(100, 50), alpha(150, 50)]).toEqual([255, 255, 255]);
    expect([alpha(75, 50), alpha(125, 50), alpha(45.4, 50), alpha(104.6, 50)]).toEqual([0, 0, 0, 0]);
    w.destroy();
    h.remove();
  });
});
