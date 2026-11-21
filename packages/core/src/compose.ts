/**
 * The scene (ADR 0001): the layout and every series' marks, put in their layers, in pixels, ready for any painter.
 * Here, once, for every output: one-pixel lines on pixel centres and rectangles on whole pixels (layout.md 8); text
 * on its alphabetic baseline (the one baseline every painter draws alike); each group's painter chosen by what it
 * draws (ADR 0002).
 */
import type { ChartModel } from './model.js';
import type { ChartLayout, PlacedText } from './layout.js';
import type { MarkSet, SeriesType } from './series-type.js';
import type { ColorToken, Group, Layer, LayerId, PainterKind, Primitive, Rect, Scene, TextMeasurer, TextPrimitive } from './scene.js';
import { sceneId, symbolOf } from './series/shared.js';
import { isShown, type View } from './view.js';

/** Past this many marks a group is painted on a Canvas (spike S1, ADR 0002). */
export const CANVAS_THRESHOLD = 2_000;

export interface ComposeInput {
  readonly model: ChartModel;
  readonly types: readonly SeriesType[];
  readonly layout: ChartLayout;
  readonly measureText: TextMeasurer;
  /** The same view the layout was given. */
  readonly view?: View;
}

/** The painter for a set of marks: paths stay in SVG; marks move to a Canvas past the threshold. */
export function painterFor(set: Pick<MarkSet, 'role' | 'items'>): PainterKind {
  return set.role === 'marks' && set.items.length > CANVAS_THRESHOLD ? 'canvas' : 'svg';
}

/** A one-pixel line's coordinate on a pixel's centre. */
const crisp = (v: number) => Math.round(v - 0.5) + 0.5;

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
    return { kind: 'text', sceneId: id, paint: { fill }, x: t.x, y, text: t.text, font: t.font, anchor: t.anchor, baseline: 'alphabetic', dir: t.dir, ...(t.rotate ? { rotate: t.rotate } : {}) };
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
    add('grid', { sceneId: sceneId('grid', a.dimension, a.id), painter: 'svg', items });
  }

  // Series, in order, those not hidden; columns of one type and axes share their bands.
  const typeOf = new Map(input.types.map((t) => [t.name as string, t]));
  const shown = model.series.filter((s) => isShown(s, input.view));
  const axisOf = (dimension: 'x' | 'y', id: string) => layout.axes.find((a) => a.dimension === dimension && a.id === id);
  for (const s of shown) {
    const type = typeOf.get(s.type);
    const xa = axisOf('x', s.xAxis);
    const ya = axisOf('y', s.yAxis);
    if (!type || !xa || !ya || type.system !== 'cartesian') continue;
    const peers = shown.filter((o) => o.type === s.type && o.xAxis === s.xAxis && o.yAxis === s.yAxis);
    const sets = type.marks({
      series: s,
      frame: { x: xa.scale, y: ya.scale, orientation: model.orientation },
      plot,
      slot: peers.indexOf(s),
      slots: peers.length,
      dir,
      measureText,
    });
    sets.forEach((set, k) => {
      const items = set.role === 'marks' ? set.items.map(snapRect) : set.items;
      // Lines are clipped to the plot; marks to the plot grown by a marker's half, so one on the edge shows whole
      // and none strays over the axes when the axis's bounds leave it out (review 5).
      const clip = set.role === 'path' ? plot : set.role === 'marks' ? grow(plot, MARK_BLEED) : undefined;
      add(set.layer, { sceneId: sceneId('s', s.id, k), painter: painterFor(set), ...(clip ? { clip } : {}), items });
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
    add('axes', { sceneId: sceneId('axis', a.dimension, a.id), painter: 'svg', items });
  }

  // Labels: tick labels, axis titles, the chart's title, the empty plot's message.
  const labels: Primitive[] = [];
  for (const a of layout.axes) {
    a.ticks.forEach((t, i) => t.label && labels.push(text(t.label, sceneId('label', a.dimension, a.id, i), 'text-muted')));
    if (a.title) labels.push(text(a.title, sceneId('axis-title', a.dimension, a.id)));
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
      const color: ColorToken = item.hidden ? 'text-muted' : s.color;
      const { sign } = item;
      const cx = sign.x + sign.width / 2;
      const cy = sign.y + sign.height / 2;
      const kind = typeOf.get(s.type)?.sign ?? 'square';
      const id = (part: string) => sceneId('legend', s.id, part);
      if (kind === 'line') {
        items.push({ kind: 'line', sceneId: id('line'), paint: { stroke: color, strokeWidth: 2 }, x1: sign.x, y1: crisp(cy), x2: sign.x + sign.width, y2: crisp(cy) });
        items.push({ kind: 'marker', sceneId: id('marker'), paint: { fill: color }, x: cx, y: cy, size: 6, symbol: symbolOf(s.rank) });
      } else if (kind === 'marker') items.push({ kind: 'marker', sceneId: id('marker'), paint: { fill: color }, x: cx, y: cy, size: 8, symbol: symbolOf(s.rank) });
      else items.push({ kind: 'rect', sceneId: id('square'), paint: { fill: color }, x: Math.round(cx - 5), y: Math.round(cy - 5), width: 10, height: 10, radius: 2 });
      items.push(text(item.label, id('label'), item.hidden ? 'text-muted' : 'text'));
    }
    add('legend', { sceneId: 'legend', painter: 'svg', items });
  }

  const order: LayerId[] = ['background', 'grid', 'series', 'axes', 'labels', 'legend', 'overlay'];
  const out: Layer[] = order.map((id) => ({ id, groups: layers.get(id) ?? [] }));
  return { width: layout.width, height: layout.height, dir, areas: { plot }, layers: out };
}

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
