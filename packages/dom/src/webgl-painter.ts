/**
 * The WebGL2 painter (ADR 0008, big-data.md 6–10): draws the scene's batches of points given to WebGL2, under the
 * Canvas and SVG planes, looking as on Canvas. Our own, no library (ADR 0003).
 *
 * - The points stay on the card in data units, so a frame of zoom sends the maps and nothing else. Each value is split
 *   into a whole number of steps (an integer) and the rest (a small float), the step a power of two per column; the
 *   shader subtracts the map's origin from each part — integers from integers, which no compiler can reorder with
 *   floats (Metal's fast math reorders float sums: a float high/low split lost its low part there) — then scales.
 *   The pixel stays exact at any zoom: milliseconds since 1970 one apart, 50 px apart, land 50 px apart.
 * - Symbols are drawn in the fragment shader from their distance to the shape's edge (the shapes of geometry.ts),
 *   one device pixel of antialiasing, premultiplied alpha, so piles read darker as on Canvas.
 * - One context per chart, opened when a batch first comes (a page allows about sixteen); freed on destroy. A lost
 *   context hands its batches to Canvas until it comes back (`changed` asks the chart to paint again).
 */
import type { Group, Paint, PointsPrimitive, Rect, Scene } from '@dzgraph/core';
import { cssColor, type SvgOptions } from '@dzgraph/core/internal';
import type { Painter } from './painter.js';
import { placeRaster, type RasterPlace } from './raster.js';

const VERTEX = `#version 300 es
in ivec2 a_steps;
in vec2 a_rest;
uniform ivec2 u_originSteps;
uniform vec2 u_originRest;
uniform vec2 u_step;
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform bool u_swapped;
uniform vec4 u_toClip;
uniform float u_sprite;
void main() {
  vec2 v = vec2(a_steps - u_originSteps) * u_step + (a_rest - u_originRest);
  vec2 px = u_offset + v * u_scale;
  if (u_swapped) px = px.yx;
  gl_Position = vec4(px * u_toClip.xy + u_toClip.zw, 0.0, 1.0);
  gl_PointSize = u_sprite;
}`;

// Distances in CSS pixels to the edge of geometry.ts's shapes, negative inside; `u_symbol` as SYMBOLS below.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 u_colour;
uniform int u_symbol;
uniform float u_half;
uniform float u_sprite;
uniform float u_dpr;
out vec4 colour;
float edge(vec2 p, vec2 a, vec2 b) {
  vec2 n = normalize(vec2(b.y - a.y, a.x - b.x));
  return dot(p - a, n);
}
void main() {
  vec2 p = (gl_PointCoord - 0.5) * u_sprite / u_dpr;
  float r = u_half;
  float d;
  if (u_symbol == 0) d = length(p) - r;
  else if (u_symbol == 1) d = max(abs(p.x), abs(p.y)) - r;
  else if (u_symbol == 2) d = (abs(p.x) + abs(p.y) - 1.2 * r) * 0.70710678;
  else {
    if (u_symbol == 4) p.y = -p.y;
    vec2 top = vec2(0.0, -1.15 * r);
    d = max(max(edge(p, top, vec2(1.15 * r, 0.85 * r)), edge(p, vec2(-1.15 * r, 0.85 * r), top)), p.y - 0.85 * r);
  }
  float a = clamp(0.5 - d * u_dpr, 0.0, 1.0);
  if (a <= 0.0) discard;
  colour = u_colour * a;
}`;

const SYMBOLS = { circle: 0, square: 1, diamond: 2, triangle: 3, 'triangle-down': 4 } as const;

/** A batch's points on the card, and what they were made from. */
interface Upload {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly only: Int32Array | undefined;
  readonly logX: boolean;
  readonly logY: boolean;
  /** Each axis's step: a power of two, so that the largest value is under 2³⁰ steps. */
  readonly stepX: number;
  readonly stepY: number;
  readonly buffer: WebGLBuffer;
  readonly vao: WebGLVertexArrayObject;
  readonly count: number;
}

interface Programme {
  readonly program: WebGLProgram;
  readonly u: Record<string, WebGLUniformLocation | null>;
  readonly steps: number;
  readonly rest: number;
}

const LIMIT = 2 ** 30;

/**
 * The step for values up to `max` in size: a power of two putting `max` within 2²⁹ steps, kept where a float32 holds
 * it (2⁻¹²⁰ to 2¹²⁰); a column of zeros takes 1. A point is within 2²⁹ steps and an origin clamped to 2³⁰, so their
 * difference stays under 2³¹: no int32 wraps in the shader (review).
 */
const stepFor = (max: number) => (max > 0 ? 2 ** Math.max(-120, Math.min(120, Math.ceil(Math.log2(max)) - 29)) : 1);

/** A value as whole steps (clamped to ±2³⁰, far past any point drawn) and the rest. */
function split(v: number, step: number): [number, number] {
  const n = Math.max(-LIMIT, Math.min(LIMIT, Math.round(v / step)));
  return [n, v - n * step];
}

export class WebglPainter implements Painter {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private prog: Programme | null = null;
  /** null: not tried yet; false: no WebGL2 here (or a point sprite too small), for good. */
  private supported: boolean | null = null;
  private lost = false;
  private destroyed = false;
  private readonly uploads = new Map<string, Upload>();
  private readonly probe: HTMLElement;
  private readonly reader: CanvasRenderingContext2D | null;
  private colours = new Map<string, readonly [number, number, number, number]>();

  constructor(
    host: HTMLElement,
    private readonly changed: () => void,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'absolute', insetBlockStart: '0', insetInlineStart: '0', pointerEvents: 'none', display: 'none' });
    this.probe = document.createElement('span');
    this.probe.hidden = true;
    this.probe.className = 'dzgraph-probe';
    const one = document.createElement('canvas');
    one.width = one.height = 1;
    this.reader = one.getContext('2d', { willReadFrequently: true });
    host.append(this.canvas, this.probe);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      // Asking for it back: the browser restores the context when it can.
      if (this.destroyed) return;
      e.preventDefault();
      this.lost = true;
      this.prog = null;
      this.uploads.clear();
      this.changed();
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      if (this.destroyed) return;
      this.lost = false;
      this.prog = this.gl ? programme(this.gl) : null;
      this.changed();
    });
  }

  /** Whether batches can be drawn here now: opens the context the first time it is asked. */
  ready(): boolean {
    if (this.supported === null) {
      const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
      this.gl = gl;
      this.prog = gl ? programme(gl) : null;
      // The sprite of the largest marker (8 px across, a diamond 1.2 times its half, a pixel of antialiasing) at 3×.
      const range = gl ? (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array) : null;
      this.supported = gl !== null && this.prog !== null && range !== null && range[1]! >= 36;
    }
    // The flag, and the context itself: a browser may say it is lost before its event comes (Firefox).
    return this.supported && !this.lost && this.prog !== null && !this.gl!.isContextLost();
  }

  paint(scene: Scene, _opts: SvgOptions, accepts: (group: Group, layer: string) => boolean): void {
    const groups = scene.layers.flatMap((l) => l.groups.filter((g) => accepts(g, l.id)));
    const gl = this.gl;
    const prog = this.prog;
    const seen = new Set<string>();
    if (!groups.length || !gl || !prog || this.lost) {
      this.canvas.style.display = 'none';
      this.forget(seen);
      return;
    }
    this.colours.clear();
    const at = placeRaster(this.canvas, scene);
    gl.viewport(0, 0, at.w, at.h);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog.program);
    // CSS pixels to clip space: x · dpr + fx over the width, y downwards.
    gl.uniform4f(prog.u['u_toClip']!, (2 * at.dpr) / at.w, (-2 * at.dpr) / at.h, (2 * at.fx) / at.w - 1, 1 - (2 * at.fy) / at.h);
    gl.uniform1f(prog.u['u_dpr']!, at.dpr);
    for (const g of groups) {
      this.clip(gl, g.clip, at);
      for (const p of g.items) {
        if (p.kind !== 'points') continue;
        seen.add(p.sceneId);
        this.batch(gl, prog, p, g.opacity ?? 1, at);
      }
    }
    this.forget(seen);
  }

  private clip(gl: WebGL2RenderingContext, clip: Rect | undefined, at: RasterPlace): void {
    if (!clip) {
      gl.disable(gl.SCISSOR_TEST);
      return;
    }
    gl.enable(gl.SCISSOR_TEST);
    // Whole device pixels, rows counted from the bottom.
    const x0 = Math.max(0, Math.round(clip.x * at.dpr + at.fx));
    const x1 = Math.min(at.w, Math.round((clip.x + clip.width) * at.dpr + at.fx));
    const y0 = Math.max(0, Math.round(clip.y * at.dpr + at.fy));
    const y1 = Math.min(at.h, Math.round((clip.y + clip.height) * at.dpr + at.fy));
    gl.scissor(x0, at.h - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
  }

  private batch(gl: WebGL2RenderingContext, prog: Programme, p: PointsPrimitive, groupAlpha: number, at: RasterPlace): void {
    const up = this.upload(gl, prog, p);
    if (!up.count) return;
    const u = prog.u;
    const [nx, rx] = split(p.mapX.d0, up.stepX);
    const [ny, ry] = split(p.mapY.d0, up.stepY);
    gl.uniform2i(u['u_originSteps']!, nx, ny);
    gl.uniform2f(u['u_originRest']!, rx, ry);
    gl.uniform2f(u['u_step']!, up.stepX, up.stepY);
    gl.uniform2f(u['u_scale']!, p.mapX.k, p.mapY.k);
    gl.uniform2f(u['u_offset']!, p.mapX.r0, p.mapY.r0);
    gl.uniform1i(u['u_swapped']!, p.swapped ? 1 : 0);
    const sprite = Math.ceil((p.size * 1.2 + 2) * at.dpr);
    gl.uniform1f(u['u_sprite']!, sprite);
    gl.uniform1f(u['u_half']!, p.size / 2);
    gl.uniform1i(u['u_symbol']!, SYMBOLS[p.symbol]);
    const colour = this.colour(p.paint);
    // No colour to read (no 2D context for the reader): nothing rather than a guess (review).
    if (!colour) return;
    const [r, g, b, a] = colour;
    const alpha = a * groupAlpha * (p.paint.opacity ?? 1);
    gl.uniform4f(u['u_colour']!, r * alpha, g * alpha, b * alpha, alpha);
    gl.bindVertexArray(up.vao);
    gl.drawArrays(gl.POINTS, 0, up.count);
    gl.bindVertexArray(null);
  }

  /** The batch's points on the card: sent once per column read (a new `x`, or `y`), gaps and log values ≤ 0 left out. */
  private upload(gl: WebGL2RenderingContext, prog: Programme, p: PointsPrimitive): Upload {
    const old = this.uploads.get(p.sceneId);
    if (old && old.x === p.x && old.y === p.y && old.only === p.only && old.logX === p.mapX.log && old.logY === p.mapY.log) return old;
    if (old) this.drop(old);
    // A selection over its cloud sends its points only (selection.md 10).
    const all = Math.min(p.x.length, p.y.length);
    const n = p.only ? p.only.length : all;
    const at = (k: number) => (p.only ? p.only[k]! : k);
    const value = (v: number, log: boolean) => (log ? (v > 0 ? Math.log10(v) : Number.NaN) : v);
    let maxX = 0;
    let maxY = 0;
    for (let k = 0; k < n; k++) {
      const i = at(k);
      const x = Math.abs(value(p.x[i]!, p.mapX.log));
      const y = Math.abs(value(p.y[i]!, p.mapY.log));
      if (x > maxX && x < Infinity) maxX = x;
      if (y > maxY && y < Infinity) maxY = y;
    }
    const stepX = stepFor(maxX);
    const stepY = stepFor(maxY);
    // Per point (16 bytes): x and y in whole steps (int32), then their rests (float32).
    const bytes = new ArrayBuffer(16 * n);
    const ints = new Int32Array(bytes);
    const floats = new Float32Array(bytes);
    let count = 0;
    for (let k = 0; k < n; k++) {
      const i = at(k);
      if (i >= all) continue;
      const x = value(p.x[i]!, p.mapX.log);
      const y = value(p.y[i]!, p.mapY.log);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const [sx, rx] = split(x, stepX);
      const [sy, ry] = split(y, stepY);
      ints[4 * count] = sx;
      ints[4 * count + 1] = sy;
      floats[4 * count + 2] = rx;
      floats[4 * count + 3] = ry;
      count++;
    }
    const buffer = gl.createBuffer()!;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(bytes, 0, 16 * count), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(prog.steps);
    gl.vertexAttribIPointer(prog.steps, 2, gl.INT, 16, 0);
    gl.enableVertexAttribArray(prog.rest);
    gl.vertexAttribPointer(prog.rest, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    const up = { x: p.x, y: p.y, only: p.only, logX: p.mapX.log, logY: p.mapY.log, stepX, stepY, buffer, vao, count };
    this.uploads.set(p.sceneId, up);
    return up;
  }

  /** What a frame did not draw leaves the card. */
  private forget(seen: ReadonlySet<string>): void {
    for (const [id, up] of this.uploads)
      if (!seen.has(id)) {
        this.drop(up);
        this.uploads.delete(id);
      }
  }

  private drop(up: Upload): void {
    if (!this.gl || this.lost) return;
    this.gl.deleteBuffer(up.buffer);
    this.gl.deleteVertexArray(up.vao);
  }

  /**
   * A paint's fill as straight RGBA in 0–1: the theme's value through the probe (the scheme applied), then read back
   * from a 1×1 Canvas, which takes any CSS colour (light-dark, color-mix, the system's in forced colours).
   */
  private colour(paint: Paint): readonly [number, number, number, number] | null {
    const css = paint.fill ? cssColor(paint.fill) : 'transparent';
    let c = this.colours.get(css);
    if (!c) {
      this.probe.style.setProperty('--dzgraph-probe', css);
      const computed = getComputedStyle(this.probe).color;
      const ctx = this.reader;
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = computed;
        ctx.fillRect(0, 0, 1, 1);
        // getImageData gives straight (not premultiplied) bytes: the shader applies alpha once.
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        c = [r! / 255, g! / 255, b! / 255, a! / 255];
      } else return null;
      this.colours.set(css, c);
    }
    return c;
  }

  destroy(): void {
    this.destroyed = true;
    for (const up of this.uploads.values()) this.drop(up);
    this.uploads.clear();
    // Frees the context now rather than when the page lets it go (a page allows about sixteen).
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
    this.canvas.remove();
    this.probe.remove();
  }
}

function programme(gl: WebGL2RenderingContext): Programme | null {
  const shader = (kind: number, source: string) => {
    const s = gl.createShader(kind);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const name of ['u_originSteps', 'u_originRest', 'u_step', 'u_scale', 'u_offset', 'u_swapped', 'u_toClip', 'u_sprite', 'u_colour', 'u_symbol', 'u_half', 'u_dpr']) u[name] = gl.getUniformLocation(program, name);
  return { program, u, steps: gl.getAttribLocation(program, 'a_steps'), rest: gl.getAttribLocation(program, 'a_rest') };
}

