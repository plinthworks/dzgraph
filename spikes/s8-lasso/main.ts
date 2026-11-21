// S8: selecting points with a lasso while the pointer moves. Points are already in pixels (the view is fixed during
// the gesture). Three ways: test every point; a grid whose cells untouched by the lasso's edges are wholly in or out;
// and, for comparison, a rectangle.
import { cloud } from '../lib/data.ts';

const W = 1200;
const H = 600;
const G = 128; // grid cells per side

function insidePoly(px: number, py: number, xs: Float64Array, ys: Float64Array, v: number): boolean {
  // Even–odd rule, horizontal ray (the classic crossing test).
  let c = false;
  for (let i = 0, j = v - 1; i < v; j = i++) {
    const yi = ys[i]!, yj = ys[j]!;
    if (yi > py !== yj > py && px < ((xs[j]! - xs[i]!) * (py - yi)) / (yj - yi) + xs[i]!) c = !c;
  }
  return c;
}

(window as any).run = (n: number) => {
  const d = cloud(n);
  // Points in pixels.
  const X = new Float32Array(n);
  const Y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = ((d.x[i]! + 4) / 11) * W;
    Y[i] = ((d.y[i]! + 4) / 9.5) * H;
  }
  // The grid: points sorted by cell (counting sort), built once when the gesture starts.
  const t0 = performance.now();
  const cw = W / G, ch = H / G;
  const cellOf = new Int32Array(n);
  const start = new Int32Array(G * G + 1);
  for (let i = 0; i < n; i++) {
    const cx = Math.min(G - 1, Math.max(0, Math.floor(X[i]! / cw)));
    const cy = Math.min(G - 1, Math.max(0, Math.floor(Y[i]! / ch)));
    cellOf[i] = cy * G + cx;
    start[cellOf[i]! + 1]!++;
  }
  for (let c = 0; c < G * G; c++) start[c + 1]! += start[c]!;
  const order = new Int32Array(n);
  const fill = start.slice(0, G * G);
  for (let i = 0; i < n; i++) order[fill[cellOf[i]!]!++] = i;
  const gridMs = +(performance.now() - t0).toFixed(1);

  // The gesture: a loop drawn around the denser blob, one vertex per pointer move (up to 240 moves).
  const moves = 240;
  const xs = new Float64Array(moves);
  const ys = new Float64Array(moves);
  const sel = new Uint8Array(n);
  const touched = new Uint8Array(G * G);
  const naive: number[] = [], grid: number[] = [], rect: number[] = [];
  let countNaive = 0, countGrid = 0;
  for (let m = 0; m < moves; m++) {
    const a = (m / moves) * 2 * Math.PI;
    const rr = 260 + 60 * Math.sin(5 * a);
    xs[m] = W * 0.36 + rr * Math.cos(a);
    ys[m] = H * 0.42 + rr * 0.8 * Math.sin(a);
    const v = m + 1;
    if (v < 3) continue;
    // Bounding box of the lasso.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < v; i++) { x0 = Math.min(x0, xs[i]!); x1 = Math.max(x1, xs[i]!); y0 = Math.min(y0, ys[i]!); y1 = Math.max(y1, ys[i]!); }

    let t = performance.now();
    countNaive = 0;
    for (let i = 0; i < n; i++) {
      const px = X[i]!, py = Y[i]!;
      const s = px >= x0 && px <= x1 && py >= y0 && py <= y1 && insidePoly(px, py, xs, ys, v) ? 1 : 0;
      sel[i] = s;
      countNaive += s;
    }
    naive.push(performance.now() - t);

    t = performance.now();
    // Cells crossed by an edge (closing edge included), by sampling each edge every half cell.
    touched.fill(0);
    for (let i = 0, j = v - 1; i < v; j = i++) {
      const steps = Math.ceil(Math.hypot(xs[i]! - xs[j]!, ys[i]! - ys[j]!) / (Math.min(cw, ch) / 2)) + 1;
      for (let k = 0; k <= steps; k++) {
        const px = xs[j]! + ((xs[i]! - xs[j]!) * k) / steps, py = ys[j]! + ((ys[i]! - ys[j]!) * k) / steps;
        const cx = Math.floor(px / cw), cy = Math.floor(py / ch);
        // Sampling can step over a cell's corner: mark the neighbours too.
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X2 = cx + dx, Y2 = cy + dy;
          if (X2 >= 0 && X2 < G && Y2 >= 0 && Y2 < G) touched[Y2 * G + X2] = 1;
        }
      }
    }
    countGrid = 0;
    const gx0 = Math.max(0, Math.floor(x0 / cw)), gx1 = Math.min(G - 1, Math.floor(x1 / cw));
    const gy0 = Math.max(0, Math.floor(y0 / ch)), gy1 = Math.min(G - 1, Math.floor(y1 / ch));
    for (let cy = gy0; cy <= gy1; cy++) for (let cx = gx0; cx <= gx1; cx++) {
      const c = cy * G + cx;
      const s = start[c]!, e = start[c + 1]!;
      if (s === e) continue;
      if (touched[c]) {
        for (let k = s; k < e; k++) if (insidePoly(X[order[k]!]!, Y[order[k]!]!, xs, ys, v)) countGrid++;
      } else if (insidePoly((cx + 0.5) * cw, (cy + 0.5) * ch, xs, ys, v)) countGrid += e - s;
    }
    grid.push(performance.now() - t);

    t = performance.now();
    let cr = 0;
    for (let i = 0; i < n; i++) cr += X[i]! >= x0 && X[i]! <= x1 && Y[i]! >= y0 && Y[i]! <= y1 ? 1 : 0;
    rect.push(performance.now() - t);
    void cr;
  }
  const q = (xs: number[], p: number) => +[...xs].sort((a, b) => a - b)[Math.floor((p / 100) * (xs.length - 1))]!.toFixed(2);
  return {
    n, gridBuildMs: gridMs, finalSelected: { naive: countNaive, grid: countGrid },
    perMoveMs: {
      naive: { median: q(naive, 50), p95: q(naive, 95) },
      grid: { median: q(grid, 50), p95: q(grid, 95) },
      rect: { median: q(rect, 50), p95: q(rect, 95) },
    },
  };
};
(window as any).ready = true;
