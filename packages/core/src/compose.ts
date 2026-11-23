/**
 * The scene (ADR 0001): the layout and every series' marks, put in their layers, in pixels, ready for any painter.
 * Here, once, for every output: one-pixel lines on pixel centres and rectangles on whole pixels (layout.md 8); text
 * on its alphabetic baseline (the one baseline every painter draws alike); each group's painter chosen by what it
 * draws (ADR 0002).
 */
import { selectedCount } from './selection.js';
import { ownDirection } from './dir.js';
import { throughAffine } from './scale.js';
import type { ChartModel } from './model.js';
import type { ChartLayout, PlacedText } from './layout.js';
import type { MarkSet, SeriesType } from './series-type.js';
import type { ColorToken, Group, Layer, LayerId, PainterKind, Primitive, Rect, Scene, TextMeasurer, TextPrimitive } from './scene.js';
import { sceneId, symbolOf } from './series/shared.js';
import { isShown, pointKey, type View } from './view.js';

import { CANVAS_THRESHOLD, WEBGL_THRESHOLD } from './points-batch.js';

export { CANVAS_THRESHOLD, WEBGL_THRESHOLD };

export interface ComposeInput {
  readonly model: ChartModel;
  readonly types: readonly SeriesType[];
  readonly layout: ChartLayout;
  readonly measureText: TextMeasurer;
  /** The same view the layout was given. */
  readonly view?: View;
  /**
   * The series pointed at (GLOSSARY: Highlight — passing, not part of the view): the others fade to 35 %
   * (hover-tooltip.md 5).
   */
  readonly highlight?: string;
}

/**
 * The painter for a set of marks (ADR 0002, 0008): paths stay in SVG; marks move to a Canvas past the threshold, a
 * batch counting its points; a set of batches only, past the WebGL threshold, to WebGL2.
 */
export function painterFor(set: Pick<MarkSet, 'role' | 'items'>): PainterKind {
  if (set.role !== 'marks') return 'svg';
  let n = 0;
  let batches = true;
  for (const p of set.items) {
    if (p.kind === 'points') n += p.x.length;
    else {
      n++;
      batches = false;
    }
  }
  if (batches && n > WEBGL_THRESHOLD) return 'webgl2';
  return n > CANVAS_THRESHOLD ? 'canvas' : 'svg';
}

/** A series' painter: one for all its sets (ADR 0002), the one its most demanding set needs; WebGL2 only if all can. */
function seriesPainter(sets: readonly Pick<MarkSet, 'role' | 'items'>[]): PainterKind {
  const each = sets.map(painterFor);
  if (each.length && each.every((p) => p === 'webgl2')) return 'webgl2';
  return each.some((p) => p !== 'svg') ? 'canvas' : 'svg';
}

/** A one-pixel line's coordinate on a pixel's centre. */
export const crisp = (v: number) => Math.round(v - 0.5) + 0.5;

export function composeScene(input: ComposeInput): Scene {
  const { model, layout, measureText } = input;
  const { plot, dir } = layout;
  const layers = new Map<LayerId, Group[]>();
  const add = (layer: LayerId, group: Group) => {
    const list = layers.get(layer) ?? [];
    list.push(group);
    layers.set(layer, list);
  };
  /** A placed text, its baseline made alphabetic from the font's measures. */
  const text = (t: PlacedText, id: string, fill: ColorToken = 'text'): TextPrimitive => {
    const m = measureText(t.text, t.font);
    const y = t.baseline === 'top' ? t.y + m.ascent : t.baseline === 'middle' ? t.y + (m.ascent - m.descent) / 2 : t.baseline === 'bottom' ? t.y - m.descent : t.y;
    return { kind: 'text', sceneId: id, paint: { fill }, x: t.x, y, text: t.text, font: t.font, ...ownDirection(t.text, t.dir, t.anchor), baseline: 'alphabetic', ...(t.rotate ? { rotate: t.rotate } : {}) };
  };

  // Background: the chart, then the plot area.
  add('background', {
    sceneId: 'bg',
    painter: 'svg',
    items: [
      { kind: 'rect', sceneId: sceneId('bg', 'chart'), paint: { fill: 'background' }, x: 0, y: 0, width: layout.width, height: layout.height },
      { kind: 'rect', sceneId: sceneId('bg', 'plot'), paint: { fill: 'plot-background' }, ...plot },
    ],
  });

  // Gridlines from the axes that draw them; zero stronger, as the baseline (axes.md 8, 16).
  for (const a of layout.axes) {
    if (!a.grid) continue;
    const upright = a.edge === 'bottom' || a.edge === 'top';
    const items: Primitive[] = a.ticks.map((t, i) => {
      const at = crisp(t.at);
      const paint = { stroke: (t.value === 0 && a.ticks.length > 1 && a.ticks[0]!.value < 0 ? 'axis-line' : 'grid-line') as ColorToken, strokeWidth: 1 };
      return upright
        ? { kind: 'line', sceneId: sceneId('grid', a.dimension, a.id, i), paint, x1: at, y1: plot.y, x2: at, y2: plot.y + plot.height }
        : { kind: 'line', sceneId: sceneId('grid', a.dimension, a.id, i), paint, x1: plot.x, y1: at, x2: plot.x + plot.width, y2: at };
    });
    // A compared axis's reference (compare.md 3): 0, 0 % or 100, a little stronger than the grid.
    const mode = a.dimension === 'y' ? layout.compare.axes.get(a.id) : undefined;
    if (mode) {
      const at = crisp(a.scale.map(mode === 'index' ? 100 : 0));
      const paint = { stroke: 'axis-line' as const, strokeWidth: 1 };
      // On the plot's edge too: a crisp line there sits half a pixel past it.
      const [lo, hi] = upright ? [plot.x, plot.x + plot.width] : [plot.y, plot.y + plot.height];
      const id = sceneId('grid', a.dimension, a.id, 'reference');
      if (at >= lo - 1 && at <= hi + 1) items.push(upright ? { kind: 'line', sceneId: id, paint, x1: at, y1: plot.y, x2: at, y2: plot.y + plot.height } : { kind: 'line', sceneId: id, paint, x1: plot.x, y1: at, x2: plot.x + plot.width, y2: at });
    }
    add('grid', { sceneId: sceneId('grid', a.dimension, a.id), painter: 'svg', items });
  }

  // Series, in order, those not hidden; columns of one type and axes share their bands.
  const typeOf = new Map(input.types.map((t) => [t.name as string, t]));
  const shown = model.series.filter((s) => isShown(s, input.view));
  const axisOf = (dimension: 'x' | 'y', id: string) => layout.axes.find((a) => a.dimension === dimension && a.id === id);
  for (const s of shown) {
    const type = typeOf.get(s.type);
    // A polar series draws from where it placed itself (ADR 0007); a point of it may be the one highlighted.
    const placement = layout.placements.get(s.id);
    if (type?.system === 'polar' && placement) {
      const lit = input.highlight === undefined ? null : (placement.order.find((i) => pointKey(s.id, i) === input.highlight) ?? null);
      const marked = type.marks({ series: s, frame: { placement }, plot, slot: 0, slots: 1, stacked: null, highlight: lit, dir, measureText });
      // Slices under a selection: the others faded, the selected ringed (selection.md 12).
      const sel = input.view?.selection;
      const look = model.kit.selection?.look;
      const sets = look && sel && selectedCount(sel) > 0 ? look(model, layout, marked, s, sel) : marked;
      const faded = input.highlight !== undefined && lit === null && input.highlight !== s.id;
      sets.forEach((set, k) => add(set.layer, { sceneId: sceneId('s', s.id, k), painter: 'svg', ...(faded ? { opacity: FADED } : {}), items: set.items }));
      continue;
    }
    const xa = axisOf('x', s.xAxis);
    const ya = axisOf('y', s.yAxis);
    if (!type || !xa || !ya || type.system !== 'cartesian') continue;
    // Compared without a baseline: not drawn (compare.md 6); compared: its values through its affine (compare.ts).
    if (layout.compare.missing.has(s.id)) continue;
    const cmp = layout.compare.series.get(s.id);
    // A pile takes one slot, in the place of its first series (stacking.md 2).
    const slotOf = (o: (typeof shown)[number]) => (o.stack !== null && layout.stacks.has(o.id) ? `stack ${o.stack}` : `series ${o.id}`);
    const slots = [...new Set(shown.filter((o) => o.type === s.type && o.xAxis === s.xAxis && o.yAxis === s.yAxis).map(slotOf))];
    const sets = type.marks({
      series: s,
      frame: { x: xa.scale, y: cmp ? throughAffine(ya.scale, cmp.a, cmp.c) : ya.scale, orientation: model.orientation },
      plot,
      slot: slots.indexOf(slotOf(s)),
      slots: slots.length,
      stacked: layout.stacks.get(s.id) ?? null,
      highlight: null,
      dir,
      measureText,
    });
    // One painter for the whole series (ADR 0002): its line never sits under its own markers on another plane.
    // Under a selection (selection.md 4): the others faded, the selected marked.
    const sel = input.view?.selection;
    const look = model.kit.selection?.look;
    const looked = look && sel && selectedCount(sel) > 0 ? look(model, layout, sets, s, sel) : sets;
    const painter = seriesPainter(looked);
    looked.forEach((set, k) => {
      const items = set.role === 'marks' ? set.items.map(snapRect) : set.items;
      // Lines are clipped to the plot; marks to the plot grown by a marker's half, so one on the edge shows whole
      // and none strays over the axes when the axis's bounds leave it out (review 5).
      const clip = set.role === 'path' ? plot : set.role === 'marks' ? grow(plot, MARK_BLEED) : undefined;
      const faded = input.highlight !== undefined && input.highlight !== s.id;
      add(set.layer, { sceneId: sceneId('s', s.id, k), painter, ...(clip ? { clip } : {}), ...(faded ? { opacity: FADED } : {}), items });
    });
  }

  // Axes: their line along the plot's edge and their tick marks outwards.
  for (const a of layout.axes) {
    const items: Primitive[] = [];
    const paint = { stroke: 'axis-line' as const, strokeWidth: 1 };
    if (a.edge === 'bottom' || a.edge === 'top') {
      const y = crisp(a.edge === 'bottom' ? plot.y + plot.height : plot.y);
      const out = a.edge === 'bottom' ? 5 : -5;
      items.push({ kind: 'line', sceneId: sceneId('axis', a.dimension, a.id, 'line'), paint, x1: plot.x, y1: y, x2: plot.x + plot.width, y2: y });
      a.ticks.forEach((t, i) => items.push({ kind: 'line', sceneId: sceneId('axis', a.dimension, a.id, 't', i), paint: { stroke: 'tick', strokeWidth: 1 }, x1: crisp(t.at), y1: y, x2: crisp(t.at), y2: y + out }));
    } else {
      const x = crisp(a.edge === 'x-min' ? plot.x : plot.x + plot.width);
      const out = a.edge === 'x-min' ? -5 : 5;
      items.push({ kind: 'line', sceneId: sceneId('axis', a.dimension, a.id, 'line'), paint, x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height });
      a.ticks.forEach((t, i) => items.push({ kind: 'line', sceneId: sceneId('axis', a.dimension, a.id, 't', i), paint: { stroke: 'tick', strokeWidth: 1 }, x1: x, y1: crisp(t.at), x2: x + out, y2: crisp(t.at) }));
    }
    // The signs of its series, before its title (combined.md 5): their colour and their symbol, or a square.
    for (const sign of a.signs) {
      const s = model.series.find((o) => o.id === sign.seriesId);
      if (!s) continue;
      const id = sceneId('axis-sign', a.id, s.id);
      if ((typeOf.get(s.type)?.sign ?? 'square') === 'square') items.push({ kind: 'rect', sceneId: id, paint: { fill: s.color }, x: Math.round(sign.x - 4), y: Math.round(sign.y - 4), width: 8, height: 8, radius: 2 });
      else items.push({ kind: 'marker', sceneId: id, paint: { fill: s.color }, x: sign.x, y: sign.y, size: 8, symbol: symbolOf(s.rank) });
    }
    add('axes', { sceneId: sceneId('axis', a.dimension, a.id), painter: 'svg', items });
  }

  // Labels: tick labels, axis titles, the chart's title, the empty plot's message.
  const labels: Primitive[] = [];
  for (const a of layout.axes) {
    a.ticks.forEach((t, i) => t.label && labels.push(text(t.label, sceneId('label', a.dimension, a.id, i), 'text-muted')));
    if (a.title) labels.push(text(a.title, sceneId('axis-title', a.dimension, a.id)));
    a.second.forEach((t, i) => labels.push(text(t, sceneId('label2', a.dimension, a.id, i), 'text-muted')));
  }
  layout.title.forEach((t, i) => labels.push(text(t, sceneId('title', i))));
  if (layout.subtitle) labels.push(text(layout.subtitle, 'subtitle', 'text-muted'));
  if (layout.noData) labels.push(text(layout.noData, 'no-data', 'text-muted'));
  add('labels', { sceneId: 'labels', painter: 'svg', items: labels });

  // Legend: each series' sign, then its name; a hidden series greyed (legend.md 3, 6).
  if (layout.legend) {
    const items: Primitive[] = [];
    for (const item of layout.legend.items) {
      const s = model.series.find((o) => o.id === item.seriesId);
      if (!s) continue;
      // A point's item (a slice) wears its colour, as a square (ADR 0007).
      const color: ColorToken = item.hidden ? 'text-muted' : (item.point?.color ?? s.color);
      const { sign } = item;
      const cx = sign.x + sign.width / 2;
      const cy = sign.y + sign.height / 2;
      const kind = item.point ? 'square' : (typeOf.get(s.type)?.sign ?? 'square');
      const id = (part: string) => sceneId('legend', s.id, ...(item.point ? [item.point.index] : []), part);
      if (kind === 'line') {
        items.push({ kind: 'line', sceneId: id('line'), paint: { stroke: color, strokeWidth: 2 }, x1: sign.x, y1: crisp(cy), x2: sign.x + sign.width, y2: crisp(cy) });
        items.push({ kind: 'marker', sceneId: id('marker'), paint: { fill: color }, x: cx, y: cy, size: 6, symbol: symbolOf(s.rank) });
      } else if (kind === 'marker') items.push({ kind: 'marker', sceneId: id('marker'), paint: { fill: color }, x: cx, y: cy, size: 8, symbol: symbolOf(s.rank) });
      else items.push({ kind: 'rect', sceneId: id('square'), paint: { fill: color }, x: Math.round(cx - 5), y: Math.round(cy - 5), width: 10, height: 10, radius: 2 });
      items.push(text(item.label, id('label'), item.hidden ? 'text-muted' : 'text'));
    }
    add('legend', { sceneId: 'legend', painter: 'svg', items });
  }

  // The navigator (navigator.md 1–2).
  const navKit = model.kit.navigator;
  if (layout.navigator && navKit) for (const g of navKit.groups(model, layout.navigator, input.view, (t, id) => text(t, id, 'text-muted'))) add('navigator', g);

  const order: LayerId[] = ['background', 'grid', 'series', 'axes', 'labels', 'legend', 'navigator', 'overlay'];
  // In each layer, WebGL2 groups first, then Canvas, then SVG, each in their order (ADR 0002, 0008): the screen stacks
  // its planes so, and the export (sceneToSvg), drawing the scene in order, puts them under each other the same way.
  const rasterFirst = (groups: readonly Group[]) => (['webgl2', 'canvas', 'svg'] as const).flatMap((k) => groups.filter((g) => g.painter === k));
  const out: Layer[] = order.map((id) => ({ id, groups: rasterFirst(layers.get(id) ?? []) }));
  return { width: layout.width, height: layout.height, dir, areas: { plot }, layers: out };
}

/** A series not highlighted while another is (hover-tooltip.md 5). */
const FADED = 0.35;

/** How far past the plot a mark may show: half the largest marker (8 px, a diamond 1.2 times its half). */
const MARK_BLEED = 6;

const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, width: r.width + 2 * by, height: r.height + 2 * by });

/** A rectangle on whole pixels, never thinner than one (layout.md 8, columns-bars.md 3). */
function snapRect(p: Primitive): Primitive {
  if (p.kind !== 'rect') return p;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  return { ...p, x, y, width: Math.max(1, Math.round(p.x + p.width) - x), height: Math.max(1, Math.round(p.y + p.height) - y) };
}

/** Every rectangle a scene clips to, for painters that declare clip paths once; `clipIndex` finds one in it. */
export function clipsOf(scene: Scene): Rect[] {
  const out: Rect[] = [];
  for (const l of scene.layers) for (const g of l.groups) if (g.clip && !out.some((r) => same(r, g.clip!))) out.push(g.clip);
  return out;
}

export const clipIndex = (clips: readonly Rect[], r: Rect): number => clips.findIndex((c) => same(c, r));

const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
