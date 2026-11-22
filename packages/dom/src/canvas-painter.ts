/**
 * The Canvas painter (ADR 0002, big-data.md 2): draws the scene's groups given to Canvas — series of more than 2 000
 * marks — under the SVG layers, looking the same: the same shapes (geometry.ts), the theme's colours resolved through
 * a probe element (so `light-dark()` follows the colour scheme), its backing store on whole device pixels and its
 * origin on the device-pixel grid (spike S5).
 */
import type { Group, Scene } from '@dzgraph/core';
import type { SvgOptions } from '@dzgraph/core/internal';
import { drawGroups } from './canvas-draw.js';
import type { Painter } from './painter.js';
import { placeRaster } from './raster.js';

export class CanvasPainter implements Painter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly probe: HTMLElement;
  private colours = new Map<string, string>();

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'absolute', insetBlockStart: '0', insetInlineStart: '0', pointerEvents: 'none', display: 'none' });
    this.ctx = this.canvas.getContext('2d');
    this.probe = document.createElement('span');
    this.probe.hidden = true;
    this.probe.className = 'dzgraph-probe';
    host.append(this.canvas, this.probe);
  }

  /** A theme colour as Canvas takes it: the probe's computed colour (the scheme applied). */
  private colour(css: string): string {
    let c = this.colours.get(css);
    if (c === undefined) {
      // The theme's `.dzgraph-probe` takes its colour from this variable (no colour written through style).
      this.probe.style.setProperty('--dzgraph-probe', css);
      c = getComputedStyle(this.probe).color;
      this.colours.set(css, c);
    }
    return c;
  }

  paint(scene: Scene, _opts: SvgOptions, accepts: (group: Group, layer: string) => boolean): void {
    const groups = scene.layers.flatMap((l) => l.groups.filter((g) => accepts(g, l.id)));
    if (!groups.length || !this.ctx) {
      this.canvas.style.display = 'none';
      return;
    }
    // Colours are read again at each drawing: a theme or colour-scheme change is picked up.
    this.colours.clear();
    const { dpr, fx, fy, w, h } = placeRaster(this.canvas, scene);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, fx, fy);
    drawGroups(ctx, groups, { colour: (css) => this.colour(css), dir: scene.dir });
  }

  destroy(): void {
    this.canvas.remove();
    this.probe.remove();
  }
}
