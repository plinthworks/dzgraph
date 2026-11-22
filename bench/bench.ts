// The benches (big-data.md 4, `npm run bench`): what a frame costs in script — layout, scene and drawing — while
// zooming and panning big series, and what a pointer move costs. Numbers are measured and reported, never asserted.
// Data is made up and deterministic.
import { allTypes } from '@dzgraph/core';
import { allFeatures, canvas, chart, type Chart, type Feature } from '@dzgraph/dom';

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

/** Wall time from each change to the frame after the one that drew it: what the eye waits, painting included. */
const walls: number[] = [];

/** One frame's script: the chart's own frame callback, between ours registered before and after it. */
async function frameCost(c: Chart, change: () => void): Promise<number> {
  let t0 = 0;
  let t1 = 0;
  const start = performance.now();
  requestAnimationFrame(() => (t0 = performance.now()));
  change();
  requestAnimationFrame(() => {
    // Style and layout of what was drawn, as the browser would do before painting.
    host.getBoundingClientRect();
    t1 = performance.now();
  });
  await raf();
  // The next frame comes once the drawn one is painted (Canvas rasters after the script; WebGL2 draws on the card).
  walls.push((await raf()) - start);
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
  const wall = stats(walls.splice(0));
  return { zoom: stats(zoom), pan: stats(pan), wall };
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

async function mount(options: Parameters<typeof chart>[1], features: readonly Feature[] = allFeatures): Promise<{ c: Chart; first: number }> {
  host.replaceChildren();
  const t = performance.now();
  const c = chart(host, { animation: false, ...options }, { types: allTypes, features });
  host.getBoundingClientRect();
  const first = performance.now() - t;
  await raf();
  return { c, first: +first.toFixed(1) };
}

async function run() {
  const results: Record<string, unknown> = {};
  // `?quick`: the 1M scatter only, while working on it.
  const quick = new URLSearchParams(location.search).has('quick');

  // 1. A line of 10 million points (big-data.md 4).
  if (!quick) {
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
  if (!quick) {
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

  // 3. Scatters (big-data.md 2–3, 6–8): on Canvas (without the WebGL2 module) and on WebGL2, at several sizes, to set
  // the WebGL threshold (ADR 0008). Script time only: the graphics card draws after it.
  const cloud = (n: number, seed: number) => {
    const r = prng(seed);
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = (r() + r() + r()) * 100;
      y[i] = (r() + r() + r()) * 50;
    }
    return { x, y };
  };
  for (const [n, plane] of (quick ? [[1_000_000, 'WebGL2']] : [[20_000, 'Canvas'], [50_000, 'Canvas'], [100_000, 'Canvas'], [200_000, 'Canvas'], [200_000, 'WebGL2'], [1_000_000, 'WebGL2'], [10_000_000, 'WebGL2']]) as readonly (readonly [number, string])[]) {
    const { x, y } = cloud(n, 3);
    const label = `scatter ${n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}k`} (${plane})`;
    const { c, first } = await mount({ series: [{ type: 'scatter', data: { x, y } }] }, plane === 'Canvas' ? [canvas] : allFeatures);
    // Which plane drew it: the first canvas is WebGL2's when the module is there.
    const drew = [...host.querySelectorAll('canvas')].map((e) => e.style.display);
    results[label] = { first, drew, hover: hoverCost(), ...(await zoomAndPan(c, 0, 300)) };
    c.destroy();
  }

  (window as unknown as { benchResult: unknown }).benchResult = results;
}

void run().catch((e) => ((window as unknown as { benchError: string }).benchError = String(e?.stack ?? e)));
