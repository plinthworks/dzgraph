/**
 * Shapes every painter draws alike (ADR 0001): a marker's outline, a column's rounded end. The SVG writes them as
 * paths, Canvas and WebGL2 as their own calls — from these numbers, so the screen does not depend on the painter.
 */
import type { MarkerSymbol, RectPrimitive } from './scene.js';

/** A marker's polygon, centred on (x, y), `size` across (circles are drawn as circles, not polygons). */
export function markerPolygon(symbol: Exclude<MarkerSymbol, 'circle'>, x: number, y: number, size: number): readonly (readonly [number, number])[] {
  const r = size / 2;
  switch (symbol) {
    case 'square':
      return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    case 'diamond':
      return [[x, y - r * 1.2], [x + r * 1.2, y], [x, y + r * 1.2], [x - r * 1.2, y]];
    case 'triangle':
      return [[x, y - r * 1.15], [x + r * 1.15, y + r * 0.85], [x - r * 1.15, y + r * 0.85]];
    case 'triangle-down':
      return [[x, y + r * 1.15], [x + r * 1.15, y - r * 0.85], [x - r * 1.15, y - r * 0.85]];
  }
}

/** The radius a rounded end really gets: no more than half the column across, nor its length. */
export function endRadius(p: Pick<RectPrimitive, 'width' | 'height' | 'radius' | 'roundEnd'>): number {
  if (!p.roundEnd || !p.radius) return 0;
  const across = p.roundEnd === 'y-min' || p.roundEnd === 'y-max' ? p.width : p.height;
  const along = p.roundEnd === 'y-min' || p.roundEnd === 'y-max' ? p.height : p.width;
  return Math.max(0, Math.min(p.radius, across / 2, along));
}

/** The four corners' radii (x-min/y-min, x-max/y-min, x-max/y-max, x-min/y-max), for a rounded end. */
export function cornerRadii(p: Pick<RectPrimitive, 'width' | 'height' | 'radius' | 'roundEnd'>): readonly [number, number, number, number] {
  const r = endRadius(p);
  switch (p.roundEnd) {
    case 'y-min':
      return [r, r, 0, 0];
    case 'y-max':
      return [0, 0, r, r];
    case 'x-min':
      return [r, 0, 0, r];
    case 'x-max':
      return [0, r, r, 0];
    default:
      return [0, 0, 0, 0];
  }
}
