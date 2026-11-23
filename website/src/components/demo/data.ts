/**
 * Made-up data sets too big to write in a page, made in the browser: the same numbers on every visit (a seeded
 * generator), so a reader and a test see the same chart. Visibly made up: no real measure behind them.
 *
 *   walk   a random walk, one point a minute from 2026-01-01 UTC (instants): a line of `count` points
 *   cloud  two overlapping blobs: a scatter of `count` points
 */
/** A small seeded generator (mulberry32, public domain): numbers in [0, 1). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.UTC(2026, 0, 1);

/** A series' data in columns: what DzGraph reads fastest. */
export function made(recipe: string, count: number): { x: Float64Array; y: Float64Array } {
  const next = random(20261123);
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  if (recipe === 'walk') {
    let v = 100;
    for (let i = 0; i < count; i++) {
      v += (next() - 0.5) * 2;
      x[i] = START + i * 60_000;
      y[i] = Math.round(v * 100) / 100;
    }
  } else if (recipe === 'cloud') {
    for (let i = 0; i < count; i++) {
      // Two blobs, by a sum of uniforms (near a bell, cheaply).
      const blob = i % 3 === 0 ? 1 : 0;
      x[i] = (blob ? 6 : 3) + (next() + next() + next() - 1.5) * 1.6;
      y[i] = (blob ? 4 : 7) + (next() + next() + next() - 1.5) * 1.6;
    }
    // A scatter's x need not be sorted.
  } else throw new Error(`unknown demo data: ${recipe}`);
  return { x, y };
}
