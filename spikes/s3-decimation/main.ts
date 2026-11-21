// S3: draw a long line in full, then decimated (M4, M4 through a pyramid, LTTB at 2 and 4 points per column), on a
// canvas at device pixel ratio 1, and count the pixels that differ from the full drawing. Time each decimation.
import { buildPyramid, lowerBound, lttb, m4, m4Pyramid } from '../lib/decimate.ts';
import { extent, walk, type Columns } from '../lib/data.ts';

const W = 1200;
const H = 400;

function draw(d: Columns, idx: ArrayLike<number> | null, count: number, x0: number, x1: number, yr: [number, number], aa: boolean) {
  const cv = new OffscreenCanvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.imageSmoothingEnabled = aa;
  const sx = W / (x1 - x0);
  const sy = (H - 20) / (yr[1] - yr[0]);
  ctx.beginPath();
  for (let j = 0; j < count; j++) {
    const i = idx ? idx[j]! : j;
    const X = (d.x[i]! - x0) * sx;
    const Y = H - 10 - (d.y[i]! - yr[0]) * sy;
    if (j === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, W, H).data;
}

/** Pixels whose darkness differs by more than `tol` (0–255) — anti-aliasing makes tiny differences everywhere. */
function diff(a: Uint8ClampedArray, b: Uint8ClampedArray, tol: number) {
  let n = 0;
  let inked = 0;
  // Coverage: a pixel at least half dark in one drawing and not in the other (the shape, not the shade). Missing =
  // dark in the full drawing only (detail lost); extra = dark in the decimated one only (detail invented).
  let missing = 0;
  let extra = 0;
  // Lost: dark in the full drawing, blank (not even faintly inked) in the decimated one: a shape that disappeared.
  let lost = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i]! < 250) inked++;
    if (Math.abs(a[i]! - b[i]!) > tol) n++;
    const da = a[i]! < 128;
    const db = b[i]! < 128;
    if (da && !db) missing++;
    if (db && !da) extra++;
    if (da && b[i]! >= 230) lost++;
  }
  // Envelope: per pixel column, the top and bottom inked rows (darker than 200). The largest gap between the two
  // drawings, in pixels, over all columns: what the eye sees of a dense line.
  let envelope = 0;
  for (let x = 0; x < W; x++) {
    let ta = -1, ba = -1, tb = -1, bb = -1;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (a[i]! < 200) { if (ta < 0) ta = y; ba = y; }
      if (b[i]! < 200) { if (tb < 0) tb = y; bb = y; }
    }
    if (ta < 0 && tb < 0) continue;
    if (ta < 0 || tb < 0) { envelope = Math.max(envelope, H); continue; }
    const e = Math.max(Math.abs(ta - tb), Math.abs(ba - bb));
    if (e > envelope) (globalThis as any).worst = { x, ta, ba, tb, bb };
    envelope = Math.max(envelope, e);
  }
  return { differ: n, inked, missing, extra, lost, envelope };
}

(window as any).run = (n: number) => {
  const d = walk(n);
  const yr = extent(d.y);
  const [a, b] = extent(d.x);
  const t = performance.now();
  const pyr = buildPyramid(d.y);
  const pyramidMs = +(performance.now() - t).toFixed(1);
  const out = new Int32Array(16 * W + 8);
  const scratch = new Int32Array(n + 2);
  const lt = new Int32Array(4 * W + 8);
  const res: Record<string, unknown> = { n, pyramidMs };
  for (const [name, frac] of [['all', 1], ['10%', 0.1], ['0.1%', 0.001]] as const) {
    const mid = (a + b) / 2;
    const x0 = mid - ((b - a) * frac) / 2;
    const x1 = mid + ((b - a) * frac) / 2;
    // The reference: every point of the window (plus one outside each side).
    let s = lowerBound(d.x, x0);
    let e = lowerBound(d.x, x1, s);
    if (s > 0) s--;
    if (e < n) e++;
    const all = new Int32Array(e - s);
    for (let i = 0; i < all.length; i++) all[i] = s + i;
    const ref = draw(d, all, all.length, x0, x1, yr, true);
    const time = (f: () => number) => {
      const reps = 5;
      let k = 0;
      const t0 = performance.now();
      for (let r = 0; r < reps; r++) k = f();
      return { k, ms: +((performance.now() - t0) / reps).toFixed(2) };
    };
    const row: Record<string, unknown> = { visible: e - s };
    const m = time(() => m4(d.x, d.y, x0, x1, W, out));
    row.m4 = { ...m, ...diff(ref, draw(d, out, m.k, x0, x1, yr, true), 32) };
    {
      // Debug: the data of the worst column, straight from the series.
      const wst = (globalThis as any).worst;
      const sx = W / (x1 - x0), sy = (H - 20) / (yr[1] - yr[0]);
      let lo = Infinity, hi = -Infinity, cnt = 0;
      for (let i = s; i < e; i++) {
        const X = (d.x[i]! - x0) * sx;
        if (X >= wst.x - 0.5 && X < wst.x + 1.5) { const Y = H - 10 - (d.y[i]! - yr[0]) * sy; lo = Math.min(lo, Y); hi = Math.max(hi, Y); cnt++; }
      }
      const kept: number[] = [];
      for (let j = 0; j < m.k; j++) { const X = (d.x[out[j]!]! - x0) * sx; if (X >= wst.x - 0.5 && X < wst.x + 1.5) kept.push(+(H - 10 - (d.y[out[j]!]! - yr[0]) * sy).toFixed(1)); }
      row.debug = { ...wst, dataRows: [+lo.toFixed(1), +hi.toFixed(1)], cnt, kept };
    }
    for (const sub of [2, 4]) {
      // M4 over `sub` columns per pixel: the line's spill into neighbouring pixels is kept too.
      const r2 = time(() => m4(d.x, d.y, x0, x1, sub * W, out));
      row[`m4x${sub}`] = { ...r2, ...diff(ref, draw(d, out, r2.k, x0, x1, yr, true), 32) };
    }
    const p = time(() => m4Pyramid(pyr, d.x, d.y, x0, x1, W, out, scratch));
    row.m4Pyramid = { ...p, ...diff(ref, draw(d, out, p.k, x0, x1, yr, true), 32) };
    for (const per of [2, 4]) {
      const l = time(() => lttb(d.x, d.y, s, e, per * W, lt));
      row[`lttb${per}`] = { ...l, ...diff(ref, draw(d, lt, l.k, x0, x1, yr, true), 32) };
    }
    res[name] = row;
  }
  return res;
};
(window as any).ready = true;
