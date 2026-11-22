/**
 * A scene as SVG (ADR 0001). `svgOf` turns one primitive into an element (tag, attributes, text): the DOM layer's
 * painter applies it to live elements, `sceneToSvg` writes it as a standalone string (exports, node, tests). One
 * translation for both, so the screen and the export cannot drift apart.
 */
import type { FontRole, MarkerSymbol, Paint, PathData, Primitive, Scene } from './scene.js';
import { endRadius, markerPolygon } from './geometry.js';
import { PathCommand } from './scene.js';
import { cssColor, type ResolveColor } from './paint.js';
import { clipIndex, clipsOf } from './compose.js';

export interface SvgElementSpec {
  readonly tag: 'path' | 'rect' | 'line' | 'circle' | 'text';
  readonly attrs: Readonly<Record<string, string>>;
  readonly text?: string;
}

export interface SvgOptions {
  /** Colours: the theme's value of a token. Absent: `var(--dzgraph-<token>)`, for a page that has the theme. */
  readonly resolve?: ResolveColor;
  /** Fonts: the CSS `font` of a role. Absent: a class `dzgraph-font-<role>` the theme styles. */
  readonly font?: (role: FontRole) => string;
}

/** Numbers in attributes: two decimals at most, no `-0`. */
const num = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return String(r === 0 ? 0 : r);
};

export function pathString(p: PathData): string {
  let out = '';
  let c = 0;
  for (const cmd of p.commands) {
    if (cmd === PathCommand.Close) out += 'Z';
    else {
      out += `${cmd === PathCommand.MoveTo ? 'M' : 'L'}${num(p.coords[c]!)} ${num(p.coords[c + 1]!)}`;
      c += 2;
    }
  }
  return out;
}

function paintAttrs(paint: Paint, opts: SvgOptions): Record<string, string> {
  const a: Record<string, string> = { fill: paint.fill ? cssColor(paint.fill, opts.resolve) : 'none' };
  if (paint.stroke) {
    a['stroke'] = cssColor(paint.stroke, opts.resolve);
    a['stroke-width'] = num(paint.strokeWidth ?? 1);
  }
  if (paint.dash?.length) a['stroke-dasharray'] = paint.dash.map(num).join(' ');
  if (paint.opacity !== undefined && paint.opacity !== 1) a['opacity'] = num(paint.opacity);
  return a;
}

/** A marker's outline, centred on (x, y), `size` across (geometry.ts: the same as every painter's). */
function markerPath(symbol: Exclude<MarkerSymbol, 'circle'>, x: number, y: number, size: number): string {
  return `M${markerPolygon(symbol, x, y, size).map(([a, b]) => `${num(a)} ${num(b)}`).join('L')}Z`;
}

/** A rectangle with the corners of one edge rounded, drawn clockwise from a corner of the straight edge opposite. */
function roundedEnd(x: number, y: number, w: number, h: number, radius: number, end: 'x-min' | 'x-max' | 'y-min' | 'y-max'): string {
  const r = endRadius({ width: w, height: h, radius, roundEnd: end });
  const a = (tx: number, ty: number) => `A${num(r)} ${num(r)} 0 0 1 ${num(tx)} ${num(ty)}`;
  const p = (px: number, py: number, cmd = 'L') => `${cmd}${num(px)} ${num(py)}`;
  const x2 = x + w;
  const y2 = y + h;
  switch (end) {
    case 'y-min':
      return `${p(x, y2, 'M')}${p(x, y + r)}${a(x + r, y)}${p(x2 - r, y)}${a(x2, y + r)}${p(x2, y2)}Z`;
    case 'y-max':
      return `${p(x2, y, 'M')}${p(x2, y2 - r)}${a(x2 - r, y2)}${p(x + r, y2)}${a(x, y2 - r)}${p(x, y)}Z`;
    case 'x-max':
      return `${p(x, y, 'M')}${p(x2 - r, y)}${a(x2, y + r)}${p(x2, y2 - r)}${a(x2 - r, y2)}${p(x, y2)}Z`;
    case 'x-min':
      return `${p(x2, y2, 'M')}${p(x + r, y2)}${a(x, y2 - r)}${p(x, y + r)}${a(x + r, y)}${p(x2, y)}Z`;
  }
}

/** An annular sector: radians clockwise from twelve o'clock. */
function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const at = (r: number, a: number) => `${num(cx + r * Math.sin(a))} ${num(cy - r * Math.cos(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const outer = `M${at(r1, a0)}A${num(r1)} ${num(r1)} 0 ${large} 1 ${at(r1, a1)}`;
  if (r0 <= 0) return `${outer}L${num(cx)} ${num(cy)}Z`;
  return `${outer}L${at(r0, a1)}A${num(r0)} ${num(r0)} 0 ${large} 0 ${at(r0, a0)}Z`;
}

/** One primitive as an SVG element. */
export function svgOf(p: Primitive, opts: SvgOptions = {}): SvgElementSpec {
  const paint = paintAttrs(p.paint, opts);
  switch (p.kind) {
    case 'path':
      return { tag: 'path', attrs: { d: pathString(p.path), ...paint } };
    case 'rect':
      if (p.roundEnd && p.radius) return { tag: 'path', attrs: { d: roundedEnd(p.x, p.y, p.width, p.height, p.radius, p.roundEnd), ...paint } };
      return { tag: 'rect', attrs: { x: num(p.x), y: num(p.y), width: num(p.width), height: num(p.height), ...(p.radius ? { rx: num(p.radius) } : {}), ...paint } };
    case 'line':
      return { tag: 'line', attrs: { x1: num(p.x1), y1: num(p.y1), x2: num(p.x2), y2: num(p.y2), ...paint } };
    case 'marker':
      return p.symbol === 'circle'
        ? { tag: 'circle', attrs: { cx: num(p.x), cy: num(p.y), r: num(p.size / 2), ...paint } }
        : { tag: 'path', attrs: { d: markerPath(p.symbol, p.x, p.y, p.size), ...paint } };
    case 'arc':
      return { tag: 'path', attrs: { d: arcPath(p.cx, p.cy, p.innerRadius, p.outerRadius, p.startAngle, p.endAngle), ...paint } };
    case 'text': {
      // `start` / `end` are the text's own, in SVG as in the scene: `direction` makes them so.
      const attrs: Record<string, string> = { x: num(p.x), y: num(p.y), 'text-anchor': p.anchor, ...paint };
      if (p.dir) attrs['direction'] = p.dir;
      if (p.rotate) attrs['transform'] = `rotate(${num(p.rotate)} ${num(p.x)} ${num(p.y)})`;
      if (opts.font) attrs['style'] = `font:${opts.font(p.font)}`;
      else attrs['class'] = `dzgraph-font-${p.font}`;
      return { tag: 'text', attrs, text: p.text };
    }
  }
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The clip path's id for a rectangle, unique within a document when `prefix` is. */
export const clipId = (prefix: string, i: number) => `${prefix}-clip-${i}`;

/**
 * The scene as a standalone SVG document: every group, whatever its painter (an export is vector), layers back to
 * front. `prefix` keeps clip ids unique when several charts share a page.
 */
export function sceneToSvg(scene: Scene, opts: SvgOptions & { readonly prefix?: string } = {}): string {
  const prefix = opts.prefix ?? 'dzgraph';
  const clips = clipsOf(scene);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(scene.width)}" height="${num(scene.height)}" viewBox="0 0 ${num(scene.width)} ${num(scene.height)}" direction="${scene.dir}">`;
  if (clips.length) {
    out += '<defs>';
    clips.forEach((r, i) => (out += `<clipPath id="${clipId(prefix, i)}"><rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.width)}" height="${num(r.height)}"/></clipPath>`));
    out += '</defs>';
  }
  for (const layer of scene.layers) {
    if (!layer.groups.length) continue;
    out += `<g data-layer="${layer.id}">`;
    for (const g of layer.groups) {
      const opacity = g.opacity !== undefined && g.opacity !== 1 ? ` opacity="${num(g.opacity)}"` : '';
      out += g.clip ? `<g clip-path="url(#${clipId(prefix, clipIndex(clips, g.clip))})"${opacity}>` : `<g${opacity}>`;
      for (const p of g.items) {
        const e = svgOf(p, opts);
        const attrs = Object.entries(e.attrs).map(([k, v]) => ` ${k}="${escape(v)}"`).join('');
        out += e.text === undefined ? `<${e.tag}${attrs}/>` : `<${e.tag}${attrs}>${escape(e.text)}</${e.tag}>`;
      }
      out += '</g>';
    }
    out += '</g>';
  }
  return out + '</svg>';
}
