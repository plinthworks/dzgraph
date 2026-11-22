/**
 * The scene's groups drawn on a 2D context: the Canvas painter's marks on screen (ADR 0002) and the whole PNG export
 * (export.md 5), text included there. One drawing for both, so a PNG looks like the screen: the same shapes
 * (geometry.ts), the same order, the same skipping of what cannot show in a clip.
 */
import type { FontRole, Group, Paint, PointsPrimitive, Primitive, Rect, Scene } from '@dzgraph/core';
import { cornerRadii, cssColor, markerPolygon, place } from '@dzgraph/core/internal';

export interface DrawStyle {
  /** A CSS colour as the scene writes it (`var()`, `color-mix()`), as the context takes it. */
  readonly colour: (css: string) => string;
  /** Text's fonts by role; absent: text is not drawn (on screen, SVG draws it). */
  readonly font?: (role: FontRole) => string;
  /** The scene's direction: text's `start` and `end` follow it, unless the text has its own. */
  readonly dir: Scene['dir'];
}

/** Draws groups in order, each in its clip and at its opacity. */
export function drawGroups(ctx: CanvasRenderingContext2D, groups: readonly Group[], style: DrawStyle): void {
  const d = new Drawer(ctx, style);
  for (const g of groups) {
    ctx.save();
    if (g.clip) {
      ctx.beginPath();
      ctx.rect(g.clip.x, g.clip.y, g.clip.width, g.clip.height);
      ctx.clip();
    }
    d.group(g.items, g.opacity ?? 1, g.clip);
    ctx.restore();
  }
}

class Drawer {
  /** The context's style as last set in this group: a run of marks with the same paint sets it once. */
  private st = { alpha: Number.NaN, fill: undefined as Paint['fill'], stroke: undefined as Paint['stroke'], width: Number.NaN, dash: undefined as Paint['dash'] };

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly style: DrawStyle,
  ) {}

  group(items: readonly Primitive[], groupAlpha: number, clip: Rect | undefined): void {
    // save/restore reset the context's style: what was set before does not hold.
    this.st = { alpha: Number.NaN, fill: undefined, stroke: undefined, width: Number.NaN, dash: undefined };
    const ctx = this.ctx;
    for (const p of items) {
      if (p.kind === 'points') {
        this.points(p, groupAlpha, clip);
        continue;
      }
      if (p.kind === 'text') {
        this.text(p, groupAlpha);
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
      }
      this.paint(p.paint, groupAlpha);
    }
  }

  /** Text as SVG writes it (svg.ts): on its alphabetic baseline, anchored along its own direction, turned about (x, y). */
  private text(p: Extract<Primitive, { kind: 'text' }>, groupAlpha: number): void {
    const font = this.style.font;
    if (!font || !p.paint.fill) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = font(p.font);
    ctx.direction = p.dir ?? this.style.dir;
    ctx.textAlign = p.anchor === 'middle' ? 'center' : p.anchor;
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = groupAlpha * (p.paint.opacity ?? 1);
    ctx.fillStyle = this.style.colour(cssColor(p.paint.fill));
    ctx.translate(p.x, p.y);
    if (p.rotate) ctx.rotate((p.rotate * Math.PI) / 180);
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
    // The style set here was undone by restore: the next mark sets its own.
    this.st = { alpha: Number.NaN, fill: undefined, stroke: undefined, width: Number.NaN, dash: undefined };
  }

  /**
   * A batch (ADR 0008): each point placed through its maps and filled on its own, so piles read darker as with
   * markers; those that cannot show in the clip skipped; no object per point.
   */
  private points(p: PointsPrimitive, groupAlpha: number, clip: Rect | undefined): void {
    const ctx = this.ctx;
    const r = p.size / 2;
    const m = p.size;
    const [x0, x1, y0, y1] = clip ? [clip.x - m, clip.x + clip.width + m, clip.y - m, clip.y + clip.height + m] : [-Infinity, Infinity, -Infinity, Infinity];
    const shape = p.symbol === 'circle' ? null : markerPolygon(p.symbol, 0, 0, p.size);
    // A selection over its cloud draws its points only (selection.md 10).
    const n = p.only ? p.only.length : p.x.length;
    for (let k = 0; k < n; k++) {
      const i = p.only ? p.only[k]! : k;
      const a = place(p.mapX, p.x[i]!);
      const b = place(p.mapY, p.y[i]!);
      const x = p.swapped ? b : a;
      const y = p.swapped ? a : b;
      // NaN (a gap) fails every comparison: skipped with what is outside.
      if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
      ctx.beginPath();
      if (!shape) ctx.arc(x, y, r, 0, 2 * Math.PI);
      else {
        for (let j = 0; j < shape.length; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, x + shape[j]![0], y + shape[j]![1]);
        ctx.closePath();
      }
      this.paint(p.paint, groupAlpha);
    }
  }

  private paint(paint: Paint, groupAlpha: number): void {
    const { ctx, st } = this;
    const alpha = groupAlpha * (paint.opacity ?? 1);
    if (alpha !== st.alpha) ctx.globalAlpha = st.alpha = alpha;
    if (paint.fill) {
      if (paint.fill !== st.fill) ctx.fillStyle = this.style.colour(cssColor((st.fill = paint.fill)));
      ctx.fill();
    }
    if (paint.stroke) {
      if (paint.stroke !== st.stroke) ctx.strokeStyle = this.style.colour(cssColor((st.stroke = paint.stroke)));
      const width = paint.strokeWidth ?? 1;
      if (width !== st.width) ctx.lineWidth = st.width = width;
      if (paint.dash !== st.dash) ctx.setLineDash((st.dash = paint.dash) ? [...paint.dash!] : []);
      ctx.stroke();
    }
  }
}
