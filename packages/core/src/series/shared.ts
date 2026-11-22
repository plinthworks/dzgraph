/**
 * What the series types share: scene ids that no app id can break, the marker symbol of each series, path building,
 * the visible window along x, and the bounds of a column of numbers.
 */
import { columnCache } from '../column-cache.js';
import type { Bounds, MarkContext, SeriesModel } from '../series-type.js';
import type { MarkerSymbol, PathData } from '../scene.js';
import { PathCommand } from '../scene.js';
import type { SeriesBase } from '../options.js';

/**
 * A scene id from its parts, each escaped (`\` and `/`), so `a/m/1` as an app's series id can never be read as the
 * series `a`'s marker 1 (scene.ts: ids are opaque and never parsed).
 */
export function sceneId(...parts: readonly (string | number)[]): string {
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    // Numbers and plain words need no escape: a dense series makes one id per point.
    const s = typeof p === 'number' ? String(p) : p.includes('/') || p.includes('\\') ? p.replace(/[\\/]/g, (c) => `\\${c}`) : p;
    out = i ? `${out}/${s}` : s;
  }
  return out;
}

/** Each series its own symbol, by rank (line-area.md 4): series are told apart without colour. */
const SYMBOLS: readonly MarkerSymbol[] = ['circle', 'square', 'diamond', 'triangle', 'triangle-down'];
export const symbolOf = (rank: number): MarkerSymbol => SYMBOLS[rank % SYMBOLS.length]!;

/** Builds a `PathData`: commands and coordinates, as typed arrays once done. */
export class PathBuilder {
  private readonly commands: number[] = [];
  private readonly coords: number[] = [];
  moveTo(x: number, y: number): void {
    this.commands.push(PathCommand.MoveTo);
    this.coords.push(x, y);
  }
  lineTo(x: number, y: number): void {
    this.commands.push(PathCommand.LineTo);
    this.coords.push(x, y);
  }
  close(): void {
    this.commands.push(PathCommand.Close);
  }
  get empty(): boolean {
    return this.commands.length === 0;
  }
  build(): PathData {
    return { commands: Uint8Array.from(this.commands), coords: Float64Array.from(this.coords) };
  }
}

const ranges = columnCache<Bounds | null>();

/** The smallest and largest numbers of a column (gaps skipped), or null; kept with the column (column-cache.ts). */
export function rangeOf(a: Float64Array): Bounds | null {
  const known = ranges.get(a);
  if (known !== undefined) return known;
  const b = scanRange(a);
  ranges.set(a, b);
  return b;
}

function scanRange(a: Float64Array): Bounds | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? { min, max } : null;
}

export const withZero = (b: Bounds | null): Bounds | null => (b ? { min: Math.min(0, b.min), max: Math.max(0, b.max) } : null);

/** A point's screen position: x along the category / x scale, y along the value scale, turned for bars. */
export function placer<O extends SeriesBase<string, unknown>>(ctx: MarkContext<O, 'cartesian'>): (x: number, y: number) => [number, number] {
  const { x: X, y: Y, orientation } = ctx.frame;
  return orientation === 'vertical' ? (x, y) => [X.map(x), Y.map(y)] : (x, y) => [Y.map(y), X.map(x)];
}

/** The x values the plot shows, low to high (the x scale may run either way). */
export function visibleX<O extends SeriesBase<string, unknown>>(ctx: MarkContext<O, 'cartesian'>): [number, number] {
  const { plot } = ctx;
  const vertical = ctx.frame.orientation === 'vertical';
  const a = ctx.frame.x.invert(vertical ? plot.x : plot.y);
  const b = ctx.frame.x.invert(vertical ? plot.x + plot.width : plot.y + plot.height);
  return a <= b ? [a, b] : [b, a];
}

/** The series' points to consider: indices in x order (all of them when x is not sorted). */
export function isGap(s: SeriesModel, i: number): boolean {
  return Number.isNaN(s.columns.y[i]!) || Number.isNaN(s.columns.x[i]!);
}
