/**
 * Hover, crosshair and tooltip (hover-tooltip.md). Never redraws the series (spike S1): the crosshair and the hovered
 * points live in their own group drawn over the scene; the tooltip is an HTML element in the chart, for the eyes only.
 * Content and hit tests come from the core (`hitShared`, `hitMark`, `tooltipOf`); this file only places and shows.
 */
import type { ArcPrimitive, MarkerPrimitive, PointRef, Scene } from '@dzgraph/core';
import type { SvgPrimitive } from '@dzgraph/core/internal';
import type { ChartLayout, ChartModel, LayoutText, Tooltip, View } from '@dzgraph/core/internal';
import { crisp, hitMark, hitShared, pointAt, pointKey, pointsAt, svgOf, tooltipOf } from '@dzgraph/core/internal';

const NS = 'http://www.w3.org/2000/svg';
/** The tooltip's distance from the point (hover-tooltip.md 7). */
const GAP = 12;
/** A hovered point: 10 px, ringed by the background (hover-tooltip.md 4). */
const HOVER_SIZE = 10;

export interface HoverState {
  readonly model: ChartModel;
  readonly layout: ChartLayout;
  readonly scene: Scene;
  readonly locale: string;
  /** Series names, and the word under a pile (stacking.md 14). */
  readonly text: Pick<LayoutText, 'seriesName'> & { readonly total: string; readonly moreSlices: (count: string) => string; readonly gaugeNote: (min: string, max: string, threshold: string | undefined) => string; readonly since: (baseline: string) => string; readonly pointsIn: (count: string) => string };
  readonly font: (role: 'legend') => string;
  /** The chart's view: a hidden series is never in the tooltip. */
  readonly view: View;
}

export interface HoverHooks {
  /** The current drawing, or null before the first one. */
  state(): HoverState | null;
  /** The series to highlight (others fade), or undefined: the chart draws again with it. */
  highlight(seriesId: string | undefined): void;
  /** The point under the pointer changed (null: none). The pointer only, never the keyboard focus. */
  hovered(point: PointRef | null): void;
  clicked(point: PointRef): void;
  /** Whether a zoom or pan gesture holds the pointer: the hover stands aside (zoom-pan.md). */
  busy?(): boolean;
}

interface Found {
  /** The point events name. */
  readonly point: PointRef;
  readonly tooltip: Tooltip;
  /** Where the tooltip goes beside, and the hovered marks. */
  readonly at: { readonly x: number; readonly y: number };
  readonly marks: readonly MarkerPrimitive[];
  /** The crosshair's x, for shared tooltips. */
  readonly crosshair: number | null;
  /** The series to highlight (per-mark hover and keyboard focus). */
  readonly highlight: string | undefined;
  /** A focus ring (keyboard.md 4). */
  readonly ring?: SvgPrimitive;
}

/**
 * Who draws the points' tooltip when not the chart (dztooltip.md: the `@dzgraph/dztooltip` bridge). The chart fills the
 * content (its heading and rows) and says when and where; the drawer shows it in its own bubble.
 */
export interface TooltipDrawer {
  /**
   * Shows `content` beside the point `at` gives — in the window's coordinates (CSS pixels), asked again whenever the
   * drawer places it (the page may have moved the chart) — in the chart's direction `dir`. Called again only when
   * what it shows or where changed.
   */
  show(content: HTMLElement, at: () => { readonly x: number; readonly y: number }, dir: 'ltr' | 'rtl'): void;
  hide(): void;
  /** Whether its bubble is on screen: it may hide it by itself (a scroll); absent, taken as shown. */
  readonly shown?: boolean;
  destroy(): void;
}

export class Hover {
  readonly tooltip: HTMLDivElement;
  /** The rows handed to a drawer (never in the page by the chart's doing). */
  private readonly content = document.createElement('div');
  /** What the drawer shows now (its words and place): the same again is not shown again (review 3). */
  private drawn = '';
  private readonly layer: SVGGElement;
  private current: PointRef | null = null;
  private touching = false;
  /** What the keyboard focus shows: the pointer's hover passes over it, and gives it back when it points at nothing. */
  private focusShown: Found | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly svg: SVGSVGElement,
    private readonly hooks: HoverHooks,
    private drawer: TooltipDrawer | null = null,
  ) {
    this.content.className = 'dzgraph-tooltip-content';
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'dzgraph-tooltip';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltip.hidden = true;
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.insetBlockStart = '0';
    this.tooltip.style.pointerEvents = 'none';
    root.appendChild(this.tooltip);
    this.layer = document.createElementNS(NS, 'g');
    this.layer.setAttribute('class', 'dzgraph-hover');
    this.layer.setAttribute('aria-hidden', 'true');
    svg.appendChild(this.layer);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointerleave', this.onLeave);
    svg.addEventListener('pointercancel', this.onUp);
    svg.addEventListener('click', this.onClick);
  }

  destroy(): void {
    this.svg.removeEventListener('pointermove', this.onMove);
    this.svg.removeEventListener('pointerdown', this.onDown);
    this.svg.removeEventListener('pointerup', this.onUp);
    this.svg.removeEventListener('pointerleave', this.onLeave);
    this.svg.removeEventListener('pointercancel', this.onUp);
    this.svg.removeEventListener('click', this.onClick);
    this.tooltip.remove();
    this.layer.remove();
    // Destroyed, it is told nothing more (the focus leaving the removed chart would hide it again).
    this.drawer?.destroy();
    this.drawer = null;
  }

  /** Shows what a pointer position (or, `fromPointer` false, the keyboard focus) finds; hides on null. */
  showAt(found: Found | null, fromPointer = true): void {
    const s = this.hooks.state();
    if (!found || !s) return this.hide();
    this.layer.replaceChildren(...this.visuals(found, s.scene));
    if (this.drawer) {
      const same = JSON.stringify([found.tooltip, found.at, s.layout.dir]);
      // The same words at the same place, still on screen: nothing to do (review 3).
      if (same !== this.drawn || this.drawer.shown === false) {
        this.drawn = same;
        this.fill(found.tooltip, s);
        // In the window: the scene's (0, 0) is the drawing's corner (raster.ts); read when the drawer places it.
        const at = found.at;
        this.drawer.show(this.content, () => {
          const box = this.svg.getBoundingClientRect();
          return { x: box.x + at.x, y: box.y + at.y };
        }, s.layout.dir);
      }
    } else {
      this.fill(found.tooltip, s);
      this.place(found.at, s);
    }
    // `pointHover` is the pointer's (Phase 5 links tell pointer from focus).
    if (fromPointer && !samePoint(this.current, found.point)) {
      this.current = found.point;
      this.hooks.hovered(found.point);
    }
    this.hooks.highlight(found.highlight);
  }

  /** Escape: the tooltip goes, the focus ring stays (keyboard.md 4). */
  hideTooltip(): void {
    this.tooltip.hidden = true;
    this.drawn = '';
    this.drawer?.hide();
  }

  /** The keyboard focus on a point (null when it leaves the points). */
  focus(found: Found | null): void {
    this.focusShown = found;
    if (found) this.showAt(found, false);
    else this.hide();
  }

  hide(): void {
    if (this.current) {
      this.current = null;
      this.hooks.hovered(null);
    }
    if (this.focusShown) return this.showAt(this.focusShown, false);
    this.layer.replaceChildren();
    this.tooltip.hidden = true;
    this.drawn = '';
    this.drawer?.hide();
    this.hooks.highlight(undefined);
  }

  /** What a pointer at scene pixels (x, y) points at (hover-tooltip.md 1–3, 12). */
  find(x: number, y: number): Found | null {
    const s = this.hooks.state();
    if (!s) return null;
    const { model, layout, scene, locale, text } = s;
    const perMark = new Set(model.series.filter((o) => o.tooltip === 'mark').map((o) => o.id));
    const withLines = model.series.some((o) => o.tooltip === 'shared');
    const mark = hitMark(scene, x, y, model.orientation, (id) => perMark.has(id), withLines);
    if (mark) {
      // A slice (ADR 0007): its anchor, and it alone highlighted (pie-donut.md 12).
      const polar = layout.placements.has(mark.seriesId);
      const p = polar ? pointAt(model, layout, mark) : drawnPoint(scene, mark);
      return { point: mark, tooltip: tooltipOf(model, layout, { points: [mark] }, locale, text), at: p ?? { x, y }, marks: [], crosshair: null, highlight: model.highlight ? (polar ? pointKey(mark.seriesId, mark.index) : mark.seriesId) : undefined };
    }
    return this.findShared(x, y);
  }

  /** The lines' shared tooltip at (x, y): never a mark's (the keyboard on a line point, review 2). */
  private findShared(x: number, y: number): Found | null {
    const s = this.hooks.state();
    if (!s) return null;
    const { model, layout, locale, text } = s;
    const shared = hitShared(model, layout, s.view, x, y);
    if (!shared || shared.points.length === 0) return null;
    // The hovered point: of those at that x, the nearest the pointer (hover-tooltip.md 11).
    let near = shared.points[0]!;
    for (const p of shared.points) if (Math.abs(p.py - y) < Math.abs(near.py - y)) near = p;
    const tooltip = tooltipOf(model, layout, shared, locale, text);
    const marks: MarkerPrimitive[] = shared.points.flatMap((p) => {
      const row = tooltip.rows.find((r) => r.seriesId === p.seriesId);
      return row ? [{ kind: 'marker', sceneId: `hover/${p.seriesId}`, paint: { fill: row.color, stroke: 'background', strokeWidth: 2 }, x: p.px, y: p.py, size: HOVER_SIZE, symbol: row.symbol } as const] : [];
    });
    return { point: { seriesId: near.seriesId, index: near.index }, tooltip, at: { x: near.px, y: near.py }, marks, crosshair: near.px, highlight: undefined };
  }

  /** What the keyboard focus on a point shows: its tooltip (shared or its own), and a focus ring (keyboard.md 4). */
  findPoint(ref: PointRef): Found | null {
    const s = this.hooks.state();
    if (!s) return null;
    const { model, layout, scene, locale, text } = s;
    const series = model.series.find((o) => o.id === ref.seriesId);
    // Where the point is: the core's one answer (pointAt), as the keyboard's items and the hit tests use.
    const at = pointAt(model, layout, ref);
    if (!series || !at) return null;
    const px = at.x;
    const py = at.y;
    if (series.tooltip === 'shared') {
      const found = this.findShared(px, py);
      if (!found) return null;
      const ring: SvgPrimitive = { kind: 'marker', sceneId: 'focus', paint: { stroke: 'focus', strokeWidth: 2 }, x: px, y: py, size: 18, symbol: 'circle' };
      return { ...found, point: ref, at: { x: px, y: py }, ring };
    }
    // A slice's ring follows its outline (pie-donut.md 13).
    const slice = drawnArc(scene, ref);
    if (slice) {
      const ring: SvgPrimitive = { ...slice, sceneId: 'focus', paint: { stroke: 'focus', strokeWidth: 2 } };
      return { point: ref, tooltip: tooltipOf(model, layout, { points: [ref] }, locale, text), at: { x: px, y: py }, marks: [], crosshair: null, highlight: model.highlight ? pointKey(ref.seriesId, ref.index) : undefined, ring };
    }
    const drawn = drawnRect(scene, ref);
    const ring: SvgPrimitive = drawn
      ? { kind: 'rect', sceneId: 'focus', paint: { stroke: 'focus', strokeWidth: 2 }, x: drawn.x - 3, y: drawn.y - 3, width: drawn.width + 6, height: drawn.height + 6, radius: 3 }
      : { kind: 'marker', sceneId: 'focus', paint: { stroke: 'focus', strokeWidth: 2 }, x: px, y: py, size: 18, symbol: 'circle' };
    return { point: ref, tooltip: tooltipOf(model, layout, { points: [ref] }, locale, text), at: drawn ? { x: drawn.x + drawn.width / 2, y: drawn.y } : { x: px, y: py }, marks: [], crosshair: null, highlight: model.highlight ? ref.seriesId : undefined, ring };
  }

  private readonly onMove = (e: PointerEvent) => {
    if (this.hooks.busy?.()) return this.hide();
    if (e.pointerType === 'touch' && !this.touching) return;
    const p = this.local(e);
    this.showAt(this.find(p.x, p.y));
  };

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || this.hooks.busy?.()) return;
    this.touching = true;
    const p = this.local(e);
    // A tap outside the plot hides it (hover-tooltip.md 9).
    this.showAt(this.find(p.x, p.y));
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touching = false;
  };

  private readonly onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.hide();
  };

  private readonly onClick = (e: MouseEvent) => {
    const p = this.local(e);
    const found = this.find(p.x, p.y);
    if (found) this.hooks.clicked(found.point);
  };

  /** Event coordinates in scene pixels. */
  private local(e: MouseEvent): { x: number; y: number } {
    const box = this.svg.getBoundingClientRect();
    return { x: e.clientX - box.x, y: e.clientY - box.y };
  }

  private visuals(found: Found, scene: Scene): SVGElement[] {
    const out: SVGElement[] = [];
    const prims: SvgPrimitive[] = [];
    if (found.crosshair !== null) {
      const x = crisp(found.crosshair);
      prims.push({ kind: 'line', sceneId: 'crosshair', paint: { stroke: 'axis-line', strokeWidth: 1 }, x1: x, y1: scene.areas.plot.y, x2: x, y2: scene.areas.plot.y + scene.areas.plot.height });
    }
    prims.push(...found.marks);
    if (found.ring) prims.push(found.ring);
    for (const p of prims) {
      const spec = svgOf(p);
      const el = document.createElementNS(NS, spec.tag);
      for (const [k, v] of Object.entries(spec.attrs)) el.setAttribute(k, v);
      if (p.sceneId === 'crosshair') el.setAttribute('class', 'dzgraph-crosshair');
      if (p.sceneId === 'focus') el.setAttribute('class', 'dzgraph-focus-ring');
      out.push(el);
    }
    return out;
  }

  private fill(t: Tooltip, s: HoverState): void {
    const heading = document.createElement('div');
    heading.className = 'dzgraph-tooltip-heading';
    heading.textContent = t.heading;
    const rows = t.rows.map((r) => {
      const row = document.createElement('div');
      row.className = 'dzgraph-tooltip-row';
      const sign = document.createElementNS(NS, 'svg');
      sign.setAttribute('class', 'dzgraph-tooltip-sign');
      sign.setAttribute('width', '12');
      sign.setAttribute('height', '12');
      sign.setAttribute('aria-hidden', 'true');
      const spec = svgOf({ kind: 'marker', sceneId: 'sign', paint: { fill: r.color }, x: 6, y: 6, size: 9, symbol: r.symbol });
      const mark = document.createElementNS(NS, spec.tag);
      for (const [k, v] of Object.entries(spec.attrs)) mark.setAttribute(k, v);
      sign.appendChild(mark);
      const name = document.createElement('span');
      name.className = 'dzgraph-tooltip-name';
      name.textContent = r.name;
      const value = document.createElement('span');
      value.className = 'dzgraph-tooltip-value';
      value.textContent = r.value;
      row.append(sign, name, value);
      // An aggregated point's count of points (aggregation.md 3).
      if (r.count !== undefined) {
        const count = document.createElement('span');
        count.className = 'dzgraph-tooltip-share';
        count.textContent = s.text.pointsIn(new Intl.NumberFormat(s.locale).format(r.count));
        row.append(count);
      }
      // A compared point's raw value, after its compared one (compare.md 4).
      if (r.raw) {
        const raw = document.createElement('span');
        raw.className = 'dzgraph-tooltip-share';
        raw.textContent = r.raw;
        row.append(raw);
      }
      // A stacked point's share of its pile (stacking.md 14).
      if (r.share) {
        const share = document.createElement('span');
        share.className = 'dzgraph-tooltip-share';
        share.textContent = r.share;
        row.append(share);
      }
      return row;
    });
    // Where a comparison starts, under the heading (compare.md 4).
    if (t.baseline) {
      const note = document.createElement('div');
      note.className = 'dzgraph-tooltip-row dzgraph-tooltip-note';
      note.textContent = s.text.since(t.baseline);
      rows.unshift(note);
    }
    // A gauge's scale and threshold, under its value (gauge.md 7).
    if (t.range) {
      const row = document.createElement('div');
      row.className = 'dzgraph-tooltip-row dzgraph-tooltip-note';
      row.textContent = s.text.gaugeNote(t.range.min, t.range.max, t.threshold);
      rows.push(row);
    }
    // « Autres » past ten slices: how many more (pie-donut.md 8).
    if (t.more) {
      const row = document.createElement('div');
      row.className = 'dzgraph-tooltip-row dzgraph-tooltip-more';
      row.textContent = s.text.moreSlices(new Intl.NumberFormat(s.locale).format(t.more));
      rows.push(row);
    }
    // Under a pile, its total closes the tooltip.
    if (t.total !== undefined) {
      const row = document.createElement('div');
      row.className = 'dzgraph-tooltip-row dzgraph-tooltip-total';
      const name = document.createElement('span');
      name.className = 'dzgraph-tooltip-name';
      name.textContent = s.text.total;
      const value = document.createElement('span');
      value.className = 'dzgraph-tooltip-value';
      value.textContent = t.total;
      row.append(name, value);
      // An empty share cell keeps the total under the values, not under the shares.
      if (t.rows.some((r) => r.share)) {
        const pad = document.createElement('span');
        pad.className = 'dzgraph-tooltip-share';
        row.append(pad);
      }
      rows.push(row);
    }
    // Into the chart's card, or the content a drawer shows (dztooltip.md 2).
    const box = this.drawer ? this.content : this.tooltip;
    box.replaceChildren(heading, ...rows);
    box.style.font = s.font('legend');
    box.dir = s.layout.dir;
    if (!this.drawer) this.tooltip.hidden = false;
  }

  /** Beside the point on the end side, the start side if no room; inside the chart (hover-tooltip.md 7). */
  private place(at: { x: number; y: number }, s: HoverState): void {
    const w = this.tooltip.offsetWidth;
    const h = this.tooltip.offsetHeight;
    const W = s.layout.width;
    const H = s.layout.height;
    const ltr = s.layout.dir === 'ltr';
    const after = ltr ? at.x + GAP : at.x - GAP - w;
    const before = ltr ? at.x - GAP - w : at.x + GAP;
    let x = after >= 0 && after + w <= W ? after : before;
    x = Math.max(0, Math.min(W - w, x));
    const y = Math.max(0, Math.min(H - h, at.y - h / 2));
    // Logical offsets: from the start edge of the chart (right in RTL).
    this.tooltip.style.insetInlineStart = `${ltr ? x : W - x - w}px`;
    this.tooltip.style.insetBlockStart = `${y}px`;
  }
}

const samePoint = (a: PointRef | null, b: PointRef | null) => a?.seriesId === b?.seriesId && a?.index === b?.index;

/** Where a drawn mark of the scene is (its centre). */
function drawnPoint(scene: Scene, ref: PointRef): { x: number; y: number } | null {
  for (const l of scene.layers)
    for (const g of l.groups)
      for (const p of g.items)
        if (p.kind === 'points') {
          // A batch's point (ADR 0008): placed through its maps.
          const at = p.seriesId === ref.seriesId ? pointsAt(p, ref.index) : null;
          if (at) return { x: at[0], y: at[1] };
        } else if (p.point?.seriesId === ref.seriesId && p.point.index === ref.index) {
          if (p.kind === 'rect') return { x: p.x + p.width / 2, y: p.y };
          if (p.kind === 'marker') return { x: p.x, y: p.y };
        }
  return null;
}

/** A drawn column's rectangle, for its focus ring. */
function drawnArc(scene: Scene, ref: PointRef): ArcPrimitive | null {
  for (const l of scene.layers)
    for (const g of l.groups) for (const p of g.items) if (p.kind === 'arc' && p.point?.seriesId === ref.seriesId && p.point.index === ref.index) return p;
  return null;
}

function drawnRect(scene: Scene, ref: PointRef): { x: number; y: number; width: number; height: number } | null {
  for (const l of scene.layers)
    for (const g of l.groups) for (const p of g.items) if (p.kind === 'rect' && p.point?.seriesId === ref.seriesId && p.point.index === ref.index) return p;
  return null;
}
