/**
 * Selecting on screen (selection.md): in selection mode, a drag selects with the current shape — a rectangle or a
 * range of x on release, a lasso live, point by point of its outline (D.21) — Shift adds, Alt removes; a click selects
 * a point alone (Shift: adds or removes it) or, on empty plot, clears. On a polar chart a click on a slice selects it,
 * whatever the mode (there is no bar). The keyboard's part (Space, Shift + arrows) is the chart's, through `toggle`
 * and `extend`. Comes with the `selection` module (ADR 0006); the shapes are the core's (selection.ts).
 */
import type { ChartLayout, ChartModel, SelectionKit, SelectOp, SelectShape, View } from '@dzgraph/core/internal';
import type { PointRef } from '@dzgraph/core';

const NS = 'http://www.w3.org/2000/svg';
/** Shorter than this, a press and release is a click (zoom-pan.md 1). */
const CLICK = 5;

export interface SelectionHooks {
  readonly state: () => { readonly model: ChartModel; readonly layout: ChartLayout; readonly view: View } | null;
  /** Whether a drag selects now (the selection mode). */
  readonly active: () => boolean;
  /** The point under a place, as hover finds it. */
  readonly pick: (x: number, y: number) => PointRef | null;
  /** The new selection into the view (empty: none); `resting` false while a lasso is still drawing. */
  readonly apply: (selection: Map<string, Uint8Array>, resting: boolean) => void;
  /** Tell the app and the reader what is now selected (selection.md 6, 9): the chart reads it as the app's points. */
  readonly tell: () => void;
  /** Whether a click on this point goes down to its detail instead (drilldown.md 2): then it does not select. */
  readonly drills?: (at: PointRef) => boolean;
}


/** How long a lasso rests before the app and the reader are told (as viewChange, view-state.md 4). */
const REST_MS = 200;

type Drag = { readonly id: number; readonly x: number; readonly y: number; readonly op: SelectOp; readonly base: View['selection']; moved: boolean; lasso: ReturnType<SelectionKit['lasso']> | null; band: SVGElement | null };

export class SelectionPart {
  private readonly layer: SVGGElement;
  private drag: Drag | null = null;
  /** The point extending selections start from (selection.md 5): the last one chosen. */
  private anchor: PointRef | null = null;
  /** A drag just ended: the click that follows is its own, not a click on a point. */
  private swallow = false;
  /** The user's shape (selection.md 1), when chosen. */
  private chosen: SelectShape | null = null;
  /** Shift + an arrow pressed on a point: the focus's next move extends the selection (selection.md 5). */
  private extending = false;
  private timer = 0;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly kit: SelectionKit,
    private readonly hooks: SelectionHooks,
  ) {
    this.layer = document.createElementNS(NS, 'g');
    this.layer.setAttribute('class', 'dzgraph-select');
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.style.pointerEvents = 'none';
    svg.insertBefore(this.layer, svg.querySelector('.dzgraph-a11y'));
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onCancel);
    svg.addEventListener('click', this.onClick);
  }

  busy(): boolean {
    return this.drag !== null && this.drag.moved;
  }

  /** The shape a drag selects with (selection.md 1): the user's, else a range on charts of lines, a rectangle on marks. */
  shape(): SelectShape {
    const model = this.hooks.state()?.model;
    const offered = model?.selection?.shapes ?? ['rectangle'];
    if (this.chosen && offered.includes(this.chosen)) return this.chosen;
    const wanted: SelectShape = model?.series.some((o) => o.tooltip === 'shared') ? 'range' : 'rectangle';
    return offered.includes(wanted) ? wanted : offered[0]!;
  }

  chooseShape(shape: SelectShape): void {
    this.chosen = shape;
  }

  /** A key on a focused point: Space selects (selection.md 5, 12); true when used. Shift + an arrow marks an extension. */
  key(e: KeyboardEvent, at: PointRef): boolean {
    const polar = this.hooks.state()?.model.system === 'polar';
    if (e.key === ' ' && (this.hooks.active() || polar)) {
      this.toggle(at);
      return true;
    }
    // Only the next move after this key extends; any other key (or a Shift + arrow that moved nothing) forgets it (review 5).
    this.extending = this.hooks.active() && e.shiftKey && e.key.startsWith('Arrow');
    return false;
  }

  /** The focus moved: after Shift + an arrow, the points from the anchor to it join. */
  focused(at: PointRef): void {
    if (this.extending) this.extend(at);
    this.extending = false;
  }

  /** New data took points out of the selection: the app and the reader are told (review 3). */
  told(): void {
    this.hooks.tell();
  }

  /** Sets the selection and, once at rest, tells the app and the reader. */
  private set(next: Map<string, Uint8Array>): void {
    const resting = !this.busy();
    this.hooks.apply(next, resting);
    if (this.timer) clearTimeout(this.timer);
    this.timer = 0;
    if (resting) this.hooks.tell();
    else
      this.timer = setTimeout(() => {
        this.timer = 0;
        if (!this.busy()) this.hooks.tell();
      }, REST_MS) as unknown as number;
  }

  /** Space on a focused point: selects or unselects it (selection.md 5). */
  toggle(at: PointRef): void {
    const s = this.hooks.state();
    if (!s) return;
    const on = s.view.selection?.get(at.seriesId)?.[at.index] === 1;
    this.anchor = at;
    this.set(this.kit.combine(s.model, s.view.selection, single(s.model, at), on ? 'remove' : 'add'));
  }

  /** Shift + an arrow moved the focus: the points from the anchor to it, along its series, join (selection.md 5). */
  extend(to: PointRef): void {
    const s = this.hooks.state();
    if (!s) return;
    const from = this.anchor && this.anchor.seriesId === to.seriesId ? this.anchor : to;
    const series = s.model.series.find((o) => o.id === to.seriesId);
    if (!series) return;
    const bits = new Uint8Array(series.columns.x.length);
    const [a, b] = from.index <= to.index ? [from.index, to.index] : [to.index, from.index];
    for (let i = a; i <= b; i++) if (!Number.isNaN(series.columns.y[i]!)) bits[i] = 1;
    this.anchor ??= from;
    this.set(this.kit.combine(s.model, s.view.selection, new Map([[to.seriesId, bits]]), 'add'));
  }

  /** Escape: the selection goes; true when there was one. */
  clear(): boolean {
    const s = this.hooks.state();
    const had = !!s?.view.selection && [...s.view.selection.values()].some((b) => b.some((v) => v));
    if (had) this.set(new Map());
    this.anchor = null;
    return had;
  }

  private local(e: MouseEvent) {
    const box = this.svg.getBoundingClientRect();
    return { x: e.clientX - box.x, y: e.clientY - box.y };
  }

  private readonly onDown = (e: PointerEvent) => {
    this.swallow = false;
    const s = this.hooks.state();
    if (!s || !this.hooks.active() || s.model.system !== 'cartesian' || (e.pointerType !== 'touch' && e.button !== 0)) return;
    const p = this.local(e);
    const plot = s.layout.plot;
    if (p.x < plot.x || p.x > plot.x + plot.width || p.y < plot.y || p.y > plot.y + plot.height) return;
    const op: SelectOp = e.shiftKey ? 'add' : e.altKey ? 'remove' : 'replace';
    // Combined with the selection as it was when the gesture began, not as its own earlier moves left it (review).
    this.drag = { id: e.pointerId, x: p.x, y: p.y, op, base: s.view.selection, moved: false, lasso: null, band: null };
    e.preventDefault();
    try {
      this.svg.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer cannot be captured: the drag still works inside the chart.
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    const d = this.drag;
    const s = this.hooks.state();
    if (!d || d.id !== e.pointerId || !s) return;
    const p = this.local(e);
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < CLICK) return;
    d.moved = true;
    const shape = this.shape();
    const plot = s.layout.plot;
    const x = Math.min(plot.x + plot.width, Math.max(plot.x, p.x));
    const y = Math.min(plot.y + plot.height, Math.max(plot.y, p.y));
    if (shape === 'lasso') {
      if (!d.lasso) {
        d.lasso = this.kit.lasso(s.model, s.layout, s.view);
        d.lasso.add(d.x, d.y);
        d.band = document.createElementNS(NS, 'path');
        d.band.setAttribute('class', 'dzgraph-select-band');
        d.band.setAttribute('d', `M${d.x} ${d.y}`);
        this.layer.appendChild(d.band);
      }
      d.lasso.add(x, y);
      d.band!.setAttribute('d', `${d.band!.getAttribute('d')}L${x} ${y}`);
      // Live (D.21): the points inside so far, combined with what was selected.
      this.set(this.kit.combine(s.model, d.base, d.lasso.inside(), d.op));
      return;
    }
    if (!d.band) {
      d.band = document.createElementNS(NS, 'rect');
      d.band.setAttribute('class', 'dzgraph-select-band');
      this.layer.appendChild(d.band);
    }
    // A range runs the plot's height (bars: its width); a rectangle follows the pointer.
    const across = s.model.orientation === 'vertical';
    const r = shape === 'range' ? (across ? { x: Math.min(d.x, x), y: plot.y, w: Math.abs(x - d.x), h: plot.height } : { x: plot.x, y: Math.min(d.y, y), w: plot.width, h: Math.abs(y - d.y) }) : { x: Math.min(d.x, x), y: Math.min(d.y, y), w: Math.abs(x - d.x), h: Math.abs(y - d.y) };
    for (const [k, v] of Object.entries({ x: r.x, y: r.y, width: r.w, height: r.h })) d.band.setAttribute(k, String(v));
  };

  private readonly onUp = (e: PointerEvent) => {
    const d = this.drag;
    const s = this.hooks.state();
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    this.layer.replaceChildren();
    if (!d.moved || !s) return;
    this.swallow = true;
    // The lasso's last selection, now at rest: told to the app and the reader at once.
    if (d.lasso) return void this.set(this.kit.combine(s.model, d.base, d.lasso.inside(), d.op));
    const p = this.local(e);
    const plot = s.layout.plot;
    const x = Math.min(plot.x + plot.width, Math.max(plot.x, p.x));
    const y = Math.min(plot.y + plot.height, Math.max(plot.y, p.y));
    let chosen: Map<string, Uint8Array>;
    if (this.shape() === 'range') {
      const xs = s.layout.axes.find((a) => a.dimension === 'x')!.scale;
      const across = s.model.orientation === 'vertical';
      chosen = this.kit.inRange(s.model, s.layout, s.view, xs.invert(across ? d.x : d.y), xs.invert(across ? x : y));
    } else chosen = this.kit.inRect(s.model, s.layout, s.view, { x0: d.x, y0: d.y, x1: x, y1: y });
    this.set(this.kit.combine(s.model, d.base, chosen, d.op));
  };

  private readonly onCancel = () => {
    const d = this.drag;
    this.drag = null;
    this.layer.replaceChildren();
    // A lasso cancelled leaves the selection as it was before it (review 8).
    if (d?.lasso) this.set(new Map(d.base ?? []));
  };

  private readonly onClick = (e: MouseEvent) => {
    if (this.swallow) {
      this.swallow = false;
      return;
    }
    const s = this.hooks.state();
    if (!s) return;
    const polar = s.model.system === 'polar';
    // A cartesian chart selects by click in selection mode; a polar one always (selection.md 12).
    if (!polar && !this.hooks.active()) return;
    const p = this.local(e);
    const at = this.hooks.pick(p.x, p.y);
    if (!at) {
      if (!polar && !e.shiftKey) this.clear();
      return;
    }
    // A point with a detail drills on a plain click; Shift + click still selects it.
    if (!e.shiftKey && this.hooks.drills?.(at)) return;
    const on = s.view.selection?.get(at.seriesId)?.[at.index] === 1;
    this.anchor = at;
    this.set(this.kit.combine(s.model, s.view.selection, single(s.model, at), e.shiftKey ? (on ? 'remove' : 'add') : 'replace'));
  };

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.svg.removeEventListener('pointerdown', this.onDown);
    this.svg.removeEventListener('pointermove', this.onMove);
    this.svg.removeEventListener('pointerup', this.onUp);
    this.svg.removeEventListener('pointercancel', this.onCancel);
    this.svg.removeEventListener('click', this.onClick);
    this.layer.remove();
  }
}

/** One point as a selection. */
function single(model: ChartModel, at: PointRef): Map<string, Uint8Array> {
  const s = model.series.find((o) => o.id === at.seriesId);
  // « Autres » (one past the data) is not a point of the app: nothing to select.
  if (!s || at.index >= s.columns.x.length) return new Map();
  const bits = new Uint8Array(s.columns.x.length);
  bits[at.index] = 1;
  return new Map([[s.id, bits]]);
}

