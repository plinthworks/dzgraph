// The benches (big-data.md 4, `npm run bench`): what a frame costs in script — layout, scene and drawing — while
// zooming and panning big series, and what a pointer move costs. Numbers are measured and reported, never asserted.
// Data is made up and deterministic.
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const host = document.getElementById('host')!;
const raf = () => new Promise<number>((r) => requestAnimationFrame(r));

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One frame's script: the chart's own frame callback, between ours registered before and after it. */
async function frameCost(c: Chart, change: () => void): Promise<number> {
  let t0 = 0;
  let t1 = 0;
  requestAnimationFrame(() => (t0 = performance.now()));
  change();
  requestAnimationFrame(() => {
    // Style and layout of what was drawn, as the browser would do before painting.
    host.getBoundingClientRect();
    t1 = performance.now();
  });
  await raf();
  await raf();
  void c;
  return t1 - t0;
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
  return { median: +at(50).toFixed(2), p95: +at(95).toFixed(2), max: +s.at(-1)!.toFixed(2), over16: s.filter((v) => v > 16.7).length, frames: s.length };
};

/** Zoom from the whole to 1 %, then pan across, one change a frame. */
async function zoomAndPan(c: Chart, min: number, max: number) {
  const zoom: number[] = [];
  const pan: number[] = [];
  const span = max - min;
  for (let i = 1; i <= 60; i++) {
    const w = span * Math.pow(0.01, i / 60);
    const mid = min + span * 0.5;
    zoom.push(await frameCost(c, () => c.setRange({ min: mid - w / 2, max: mid + w / 2 })));
  }
  const w = span * 0.01;
  for (let i = 0; i < 60; i++) {
    const from = min + (span - w) * (i / 59);
    pan.push(await frameCost(c, () => c.setRange({ min: from, max: from + w })));
  }
  return { zoom: stats(zoom), pan: stats(pan) };
}

/** Pointer moves across the plot: the hover's work, synchronous in the event. */
function hoverCost(): ReturnType<typeof stats> {
  const svg = host.querySelector('svg')!;
  const box = svg.getBoundingClientRect();
  const out: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t = performance.now();
    svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: box.x + 80 + (i / 99) * (box.width - 120), clientY: box.y + box.height * (0.3 + 0.4 * ((i * 7) % 10) / 10), pointerType: 'mouse' }));
    out.push(performance.now() - t);
  }
  return stats(out);
}

async function mount(options: Parameters<typeof chart>[1]): Promise<{ c: Chart; first: number }> {
  host.replaceChildren();
  const t = performance.now();
  const c = chart(host, { animation: false, ...options }, { types: allTypes });
  host.getBoundingClientRect();
  const first = performance.now() - t;
  await raf();
  return { c, first: +first.toFixed(1) };
}

async function run() {
  const results: Record<string, unknown> = {};

  // 1. A line of 10 million points (big-data.md 4).
  {
    const r = prng(1);
    const n = 10_000_000;
    const y = new Float64Array(n);
    let v = 0;
    for (let i = 0; i < n; i++) y[i] = v += r() - 0.5;
    const { c, first } = await mount({ series: [{ type: 'line', data: { y } }] });
    results['line 10M'] = { first, ...(await zoomAndPan(c, 0, n - 1)), hover: hoverCost() };
    c.destroy();
  }

  // 2. A time axis: one reading every five minutes for ten years (about a million), Paris.
  {
    const r = prng(2);
    const n = 1_051_200;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    let v = 50;
    const start = Date.UTC(2016, 0, 1);
    for (let i = 0; i < n; i++) {
      x[i] = start + i * 300_000;
      y[i] = v += r() - 0.5;
    }
    const { c, first } = await mount({ navigator: true, xAxis: { scale: 'time', zone: 'Europe/Paris' }, series: [{ type: 'area', data: { x, y } }] });
    results['time 1M, navigator'] = { first, ...(await zoomAndPan(c, x[0]!, x[n - 1]!)), hover: hoverCost() };
    c.destroy();
  }

  // 3. A scatter of 100 000 points on Canvas (big-data.md 2–3).
  {
    const r = prng(3);
    const n = 100_000;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = (r() + r() + r()) * 100;
      y[i] = (r() + r() + r()) * 50;
    }
    const { c, first } = await mount({ series: [{ type: 'scatter', data: { x, y } }] });
    results['scatter 100k (Canvas)'] = { first, hover: hoverCost(), ...(await zoomAndPan(c, 0, 300)) };
    c.destroy();
  }

  (window as unknown as { benchResult: unknown }).benchResult = results;
}

void run().catch((e) => ((window as unknown as { benchError: string }).benchError = String(e?.stack ?? e)));
