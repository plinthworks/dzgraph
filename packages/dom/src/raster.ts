/**
 * Where a raster plane (Canvas, WebGL2) goes, so its pixels fall on the device's (spike S5): its backing store on whole
 * device pixels, the plane shifted onto the device-pixel grid, the scene's drawing offset by the rest. Shared by both
 * raster painters, so they line up with each other and with the SVG.
 */
import type { Scene } from '@dzgraph/core';

export interface RasterPlace {
  readonly dpr: number;
  /** The scene's origin within the backing store, in device pixels (0 ≤ f < 1). */
  readonly fx: number;
  readonly fy: number;
  /** The backing store's size, in device pixels. */
  readonly w: number;
  readonly h: number;
}

/** Sizes and places `canvas` (a child of the chart's root) for `scene`, shows it, and says where the scene's (0, 0) is. */
export function placeRaster(canvas: HTMLCanvasElement, scene: Scene): RasterPlace {
  const dpr = window.devicePixelRatio || 1;
  // The scene's (0, 0) is the main SVG's corner: the root's start, or in RTL its end less the scene's width (the SVG
  // is a block at the inline start). Computed, not read: the SVG may not have its new size yet.
  const parent = canvas.parentElement!;
  const root = parent.getBoundingClientRect();
  const rtl = getComputedStyle(parent).direction === 'rtl';
  const o = { x: rtl ? root.x + root.width - scene.width : root.x, y: root.y };
  // On the device-pixel grid (S5): the canvas starts on the whole device pixel at or before the scene's origin, its
  // drawing shifted by the rest. Its place without the shift is the root's inline start: the start edge, or in RTL
  // the end edge less its width (review 7).
  const fx = ((o.x * dpr) % 1 + 1) % 1;
  const fy = ((o.y * dpr) % 1 + 1) % 1;
  const w = Math.ceil(scene.width * dpr + fx);
  const h = Math.ceil(scene.height * dpr + fy);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const naturalX = rtl ? root.x + root.width - w / dpr : root.x;
  const dx = o.x - fx / dpr - naturalX;
  const dy = o.y - fy / dpr - root.y;
  Object.assign(canvas.style, { display: 'block', inlineSize: `${w / dpr}px`, blockSize: `${h / dpr}px`, translate: `${dx}px ${dy}px` });
  return { dpr, fx, fy, w, h };
}
