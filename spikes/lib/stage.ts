// A bare chart stage for the rendering spikes (S1, S7): one plot, one series, SVG or Canvas, no axes.
// Throwaway code (Phase 0). Colours are fixed here on purpose: a spike page is not the library.
import { buildPyramid, lowerBound, m4, m4Pyramid, type Pyramid } from './decimate.ts';
import { extent, type Columns } from './data.ts';

export type Renderer = 'svg' | 'svg-dots' | 'canvas' | 'canvas-pixels';
export type Kind = 'line' | 'scatter';
export type Decimate = 'none' | 'm4' | 'm4-pyramid';
export type Action = 'zoom' | 'hover' | 'resize';

export interface Case {
  renderer: Renderer;
  kind: Kind;
  action: Action;
  decimate: Decimate;
  frames: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const H = 500;

export class Stage {
  readonly host: HTMLDivElement;
  private svg: SVGSVGElement | null = null;
  private path: SVGPathElement | null = null;
  private circles: SVGCircleElement[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private overlay: SVGSVGElement;
  private cross: SVGLineElement;
  private idx: Int32Array;
  private scratch: Int32Array;
  private pyramid: Pyramid | null = null;
  private yr: [number, number];
  private xr: [number, number];
  width = 1200;
  /** Points drawn by the last frame (after decimation). */
  drawn = 0;

  constructor(
    parent: HTMLElement,
    private data: Columns,
    private c: Case,
  ) {
    this.host = document.createElement('div');
    this.host.style.cssText = `position:relative;width:${this.width}px;height:${H}px;background:#fff`;
    parent.replaceChildren(this.host);
    this.xr = extent(data.x);
    this.yr = extent(data.y);
    this.idx = new Int32Array(4 * 4000 + 8);
    this.scratch = new Int32Array(c.decimate === 'm4-pyramid' ? data.x.length : 1);
    if (c.decimate === 'm4-pyramid') this.pyramid = buildPyramid(data.y);

    if (c.renderer === 'svg' || c.renderer === 'svg-dots') {
      this.svg = document.createElementNS(SVG, 'svg');
      this.svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
      if (c.kind === 'scatter' && c.renderer === 'svg') {
        const g = document.createElementNS(SVG, 'g');
        g.setAttribute('fill', '#2563eb');
        for (let i = 0; i < data.x.length; i++) {
          const ci = document.createElementNS(SVG, 'circle');
          ci.setAttribute('r', '1.5');
          g.appendChild(ci);
          this.circles.push(ci);
        }
        this.svg.appendChild(g);
      } else {
        this.path = document.createElementNS(SVG, 'path');
        this.path.setAttribute('fill', 'none');
        this.path.setAttribute('stroke', '#2563eb');
        if (c.kind === 'scatter') {
          // Dots as zero-length round-capped segments: one element for every marker.
          this.path.setAttribute('stroke-width', '3');
          this.path.setAttribute('stroke-linecap', 'round');
        } else this.path.setAttribute('stroke-width', '1');
        this.svg.appendChild(this.path);
      }
      this.host.appendChild(this.svg);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      this.host.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d')!;
    }
    // The hover layer is always SVG on top (the hybrid plan, D.1).
    this.overlay = document.createElementNS(SVG, 'svg');
    this.overlay.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none');
    this.cross = document.createElementNS(SVG, 'line');
    this.cross.setAttribute('stroke', '#111');
    this.cross.setAttribute('y1', '0');
    this.cross.setAttribute('y2', String(H));
    this.overlay.appendChild(this.cross);
    this.host.appendChild(this.overlay);
  }

  /** The visible x window. */
  view: [number, number] = [0, 0];

  setWidth(w: number) {
    this.width = w;
    this.host.style.width = `${w}px`;
  }

  draw() {
    const { x, y } = this.data;
    const [x0, x1] = this.view[1] > this.view[0] ? this.view : this.xr;
    const w = this.width;
    const sx = w / (x1 - x0);
    const sy = (H - 20) / (this.yr[1] - this.yr[0]);
    const y0 = this.yr[0];
    const px = (i: number) => (x[i]! - x0) * sx;
    const py = (i: number) => H - 10 - (y[i]! - y0) * sy;

    // Which points: all of the window (line, sorted x), all (scatter), or the decimated ones.
    let count: number;
    let pick: (j: number) => number;
    if (this.c.kind === 'scatter') {
      count = x.length;
      pick = (j) => j;
    } else if (this.c.decimate === 'm4') {
      count = m4(x, y, x0, x1, Math.round(w), this.idx);
      const idx = this.idx;
      pick = (j) => idx[j]!;
    } else if (this.c.decimate === 'm4-pyramid') {
      count = m4Pyramid(this.pyramid!, x, y, x0, x1, Math.round(w), this.idx, this.scratch);
      const idx = this.idx;
      pick = (j) => idx[j]!;
    } else {
      let s = lowerBound(x, x0);
      let e = lowerBound(x, x1, s);
      if (s > 0) s--;
      if (e < x.length) e++;
      count = e - s;
      pick = (j) => s + j;
    }
    this.drawn = count;

    if (this.path) {
      const parts: string[] = new Array(count);
      if (this.c.kind === 'line') {
        for (let j = 0; j < count; j++) {
          const i = pick(j);
          parts[j] = `${px(i).toFixed(1)} ${py(i).toFixed(1)}`;
        }
        this.path.setAttribute('d', count ? 'M' + parts.join('L') : '');
      } else {
        for (let j = 0; j < count; j++) {
          const i = pick(j);
          parts[j] = `M${px(i).toFixed(1)} ${py(i).toFixed(1)}h0`;
        }
        this.path.setAttribute('d', parts.join(''));
      }
    } else if (this.circles.length) {
      for (let j = 0; j < count; j++) {
        const i = pick(j);
        const ci = this.circles[j]!;
        ci.setAttribute('cx', px(i).toFixed(1));
        ci.setAttribute('cy', py(i).toFixed(1));
      }
    } else if (this.ctx && this.canvas) {
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.round(w * dpr);
      const ch = Math.round(H * dpr);
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, H);
      if (this.c.kind === 'line') {
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j < count; j++) {
          const i = pick(j);
          if (j === 0) ctx.moveTo(px(i), py(i));
          else ctx.lineTo(px(i), py(i));
        }
        ctx.stroke();
      } else if (this.c.renderer === 'canvas-pixels') {
        // Dense scatter: count points per device pixel, then one putImageData (a density image).
        const img = ctx.createImageData(cw, ch);
        const d = new Uint32Array(img.data.buffer);
        const color = 0xffeb6325; // ABGR little-endian: #2563eb, opaque.
        for (let j = 0; j < count; j++) {
          const i = pick(j);
          const X = (px(i) * dpr) | 0;
          const Y = (py(i) * dpr) | 0;
          if (X >= 0 && X < cw && Y >= 0 && Y < ch) d[Y * cw + X] = color;
        }
        ctx.putImageData(img, 0, 0);
      } else {
        ctx.fillStyle = '#2563eb';
        for (let j = 0; j < count; j++) {
          const i = pick(j);
          ctx.fillRect(px(i) - 1.5, py(i) - 1.5, 3, 3);
        }
      }
    }
  }

  hover(xPx: number) {
    // What the hover costs: find the nearest point by x (sorted series) and move the crosshair.
    const { x } = this.data;
    const [x0, x1] = this.view[1] > this.view[0] ? this.view : this.xr;
    const v = x0 + (xPx / this.width) * (x1 - x0);
    if (this.c.kind === 'line') {
      const i = Math.min(lowerBound(x, v), x.length - 1);
      const p = ((x[i]! - x0) / (x1 - x0)) * this.width;
      this.cross.setAttribute('x1', p.toFixed(1));
      this.cross.setAttribute('x2', p.toFixed(1));
    } else {
      this.cross.setAttribute('x1', xPx.toFixed(1));
      this.cross.setAttribute('x2', xPx.toFixed(1));
    }
  }

  get fullRange(): [number, number] {
    return this.xr;
  }
}

/** Frame timings: the time between two animation frames while `step` runs once per frame. */
export async function measure(frames: number, step: (i: number) => void, warmup = 8) {
  const deltas: number[] = [];
  const work: number[] = [];
  const next = () => new Promise<number>((r) => requestAnimationFrame(r));
  let prev = await next();
  for (let i = 0; i < frames + warmup; i++) {
    const t0 = performance.now();
    step(i);
    const t1 = performance.now();
    const now = await next();
    if (i >= warmup) {
      deltas.push(now - prev);
      work.push(t1 - t0);
    }
    prev = now;
  }
  const q = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!.toFixed(1);
  };
  return {
    frameMedian: q(deltas, 50),
    frameP95: q(deltas, 95),
    workMedian: q(work, 50),
    workP95: q(work, 95),
    /** Share of frames longer than 20 ms (a missed 60 Hz refresh). */
    slow: +(deltas.filter((d) => d > 20).length / deltas.length).toFixed(2),
  };
}

/** Runs one case: builds the stage, then animates the action for `frames` frames. */
export async function runCase(parent: HTMLElement, data: Columns, c: Case) {
  const t0 = performance.now();
  const st = new Stage(parent, data, c);
  st.draw();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const firstPaint = +(performance.now() - t0).toFixed(1);
  const [a, b] = st.fullRange;
  const stats = await measure(c.frames, (i) => {
    const t = (Math.sin((i / 30) * Math.PI) + 1) / 2; // 0 → 1 → 0, smoothly.
    if (c.action === 'zoom') {
      // Zoom between the whole series and its middle half, recentred: at least half the points stay visible.
      const span = (b - a) * (1 - 0.5 * t);
      const mid = (a + b) / 2;
      st.view = [mid - span / 2, mid + span / 2];
      st.draw();
    } else if (c.action === 'resize') {
      st.setWidth(Math.round(800 + 400 * t));
      st.draw();
    } else {
      st.hover(50 + t * (st.width - 100));
    }
  });
  const drawn = st.drawn;
  parent.replaceChildren();
  return { ...stats, firstPaint, drawn };
}
