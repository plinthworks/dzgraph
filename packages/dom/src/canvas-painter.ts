/**
 * The Canvas painter (ADR 0002, big-data.md 2): draws the scene's groups given to Canvas — series of more than 2 000
 * marks — under the SVG layers, looking the same: the same shapes (geometry.ts), the theme's colours resolved through
 * a probe element (so `light-dark()` follows the colour scheme), its backing store on whole device pixels and its
 * origin on the device-pixel grid (spike S5).
 */
import type { Group, Paint, PointsPrimitive, Primitive, Rect, Scene } from '@dzgraph/core';
import { cornerRadii, cssColor, markerPolygon, place, type SvgOptions } from '@dzgraph/core/internal';
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
    for (const g of groups) {
      ctx.save();
      if (g.clip) {
        ctx.beginPath();
        ctx.rect(g.clip.x, g.clip.y, g.clip.width, g.clip.height);
        ctx.clip();
      }
      // save/restore reset the context's style: what was set before does not hold.
      this.style = { alpha: Number.NaN, fill: undefined, stroke: undefined, width: Number.NaN, dash: undefined };
      this.group(ctx, g.items, g.opacity ?? 1, g.clip);
      ctx.restore();
    }
  }

  private group(ctx: CanvasRenderingContext2D, items: readonly Primitive[], groupAlpha: number, clip: Rect | undefined): void {
    for (const p of items) {
      if (p.kind === 'points') {
        this.points(ctx, p, groupAlpha, clip);
        continue;
      }
      ctx.beginPath();
      switch (p.kind) {
        case 'rect': {
          const r = cornerRadii(p);
          if (r.some((v) => v > 0)) ctx.roundRect(p.x, p.y, p.width, p.height, [r[0], r[1], r[2], r[3]]);
          else ctx.rect(p.x, p.y, p.width, p.height);
          break;
        }
        case 'marker':
          if (p.symbol === 'circle') ctx.arc(p.x, p.y, p.size / 2, 0, 2 * Math.PI);
          else markerPolygon(p.symbol, p.x, p.y, p.size).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          break;
        case 'line':
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          break;
        case 'path': {
          let c = 0;
          for (const cmd of p.path.commands) {
            if (cmd === 2) ctx.closePath();
            else {
              const x = p.path.coords[c]!;
              const y = p.path.coords[c + 1]!;
              if (cmd === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              c += 2;
            }
          }
          break;
        }
        case 'arc':
          ctx.arc(p.cx, p.cy, p.outerRadius, p.startAngle - Math.PI / 2, p.endAngle - Math.PI / 2);
          if (p.innerRadius > 0) ctx.arc(p.cx, p.cy, p.innerRadius, p.endAngle - Math.PI / 2, p.startAngle - Math.PI / 2, true);
          else ctx.lineTo(p.cx, p.cy);
          ctx.closePath();
          break;
        case 'text':
          // Text never goes to Canvas (ADR 0002: only marks do).
          continue;
      }
      this.fill(ctx, p.paint, groupAlpha);
    }
  }

  /**
   * A batch (ADR 0008): each point placed through its maps and filled on its own, so piles read darker as with
   * markers; those that cannot show in the clip skipped; no object per point.
   */
  private points(ctx: CanvasRenderingContext2D, p: PointsPrimitive, groupAlpha: number, clip: Rect | undefined): void {
    const r = p.size / 2;
    const m = p.size;
    const [x0, x1, y0, y1] = clip ? [clip.x - m, clip.x + clip.width + m, clip.y - m, clip.y + clip.height + m] : [-Infinity, Infinity, -Infinity, Infinity];
    const shape = p.symbol === 'circle' ? null : markerPolygon(p.symbol, 0, 0, p.size);
    for (let i = 0; i < p.x.length; i++) {
      const a = place(p.mapX, p.x[i]!);
      const b = place(p.mapY, p.y[i]!);
      const x = p.swapped ? b : a;
      const y = p.swapped ? a : b;
      // NaN (a gap) fails every comparison: skipped with what is outside.
      if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
      ctx.beginPath();
      if (!shape) ctx.arc(x, y, r, 0, 2 * Math.PI);
      else {
        for (let k = 0; k < shape.length; k++) (k ? ctx.lineTo : ctx.moveTo).call(ctx, x + shape[k]![0], y + shape[k]![1]);
        ctx.closePath();
      }
      this.fill(ctx, p.paint, groupAlpha);
    }
  }

  /** The context's style as last set in this group: a run of marks with the same paint sets it once. */
  private style = { alpha: Number.NaN, fill: undefined as Paint['fill'], stroke: undefined as Paint['stroke'], width: Number.NaN, dash: undefined as Paint['dash'] };

  private fill(ctx: CanvasRenderingContext2D, paint: Paint, groupAlpha: number): void {
    const st = this.style;
    const alpha = groupAlpha * (paint.opacity ?? 1);
    if (alpha !== st.alpha) ctx.globalAlpha = st.alpha = alpha;
    if (paint.fill) {
      if (paint.fill !== st.fill) ctx.fillStyle = this.colour(cssColor((st.fill = paint.fill)));
      ctx.fill();
    }
    if (paint.stroke) {
      if (paint.stroke !== st.stroke) ctx.strokeStyle = this.colour(cssColor((st.stroke = paint.stroke)));
      const width = paint.strokeWidth ?? 1;
      if (width !== st.width) ctx.lineWidth = st.width = width;
      if (paint.dash !== st.dash) ctx.setLineDash((st.dash = paint.dash) ? [...paint.dash!] : []);
      ctx.stroke();
    }
  }

  destroy(): void {
    this.canvas.remove();
    this.probe.remove();
  }
}
