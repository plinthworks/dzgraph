/**
 * A scatter's points as one batch (ADR 0008): where each goes, and the batch as markers for the outputs that draw
 * one element per point (SVG on screen, the export). The thresholds that choose a painter by the marks drawn
 * (ADR 0002) live here, with what they count.
 */
import type { Affine, MarkerPrimitive, PointsPrimitive, Rect } from './scene.js';
import { sceneId } from './series/shared.js';

/** Past this many marks, a series is drawn on Canvas (ADR 0002), and a scatter gives one batch (ADR 0008). */
export const CANVAS_THRESHOLD = 2_000;

/**
 * Past this many points, a batch is drawn by WebGL2 (ADR 0008). Set by the benches (2026-11-22): Canvas draws 100 000
 * in about 3 ms of script a frame, and its cost grows with each point every frame, WebGL2's does not; a page allows
 * only about sixteen WebGL contexts, so not lower.
 */
export const WEBGL_THRESHOLD = 100_000;

/** A value's pixel along one map; NaN when it has no place (a gap, or ≤ 0 on a log axis). */
export function place(m: Affine, v: number): number {
  if (m.log) return v > 0 ? m.r0 + (Math.log10(v) - m.d0) * m.k : Number.NaN;
  return m.r0 + (v - m.d0) * m.k;
}

/** Point `i`'s place on screen, or null when it has none. */
export function pointsAt(p: PointsPrimitive, i: number): [number, number] | null {
  const a = place(p.mapX, p.x[i]!);
  const b = place(p.mapY, p.y[i]!);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return p.swapped ? [b, a] : [a, b];
}

/**
 * The batch as one marker per point shown, in scene order. With `clip`, only the points that may show in it (their
 * centre within a marker of it): a zoomed scatter in SVG builds what is seen. Ids as a scatter gives its markers.
 */
export function markersOf(p: PointsPrimitive, clip?: Rect): MarkerPrimitive[] {
  const out: MarkerPrimitive[] = [];
  const m = p.size;
  // A selection drawn over its cloud has its own ids: the cloud's markers keep theirs.
  const tag = p.only ? 'sel' : 'm';
  const n = p.only ? p.only.length : p.x.length;
  for (let k = 0; k < n; k++) {
    const i = p.only ? p.only[k]! : k;
    const at = pointsAt(p, i);
    if (!at) continue;
    const [x, y] = at;
    if (clip && (x < clip.x - m || x > clip.x + clip.width + m || y < clip.y - m || y > clip.y + clip.height + m)) continue;
    out.push({ kind: 'marker', sceneId: sceneId('s', p.seriesId, tag, i), paint: p.paint, x, y, size: p.size, symbol: p.symbol, point: { seriesId: p.seriesId, index: i } });
  }
  return out;
}
