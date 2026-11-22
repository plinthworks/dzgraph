/**
 * Measuring on screen (measure.md): in measure mode, a drag from a point to another keeps a measure between them; on
 * a focused point, M starts one and moving the focus moves its end. The core's measure kit reads and draws it; the
 * words are the reader's. Comes with the `measure` module (ADR 0006).
 */
import type { ChartLayout, ChartModel, MeasureKit, MeasureReading } from '@dzgraph/core/internal';
import type { PointRef, TextMeasurer } from '@dzgraph/core';
import { svgOf } from '@dzgraph/core/internal';

const NS = 'http://www.w3.org/2000/svg';

export interface MeasureHooks {
  readonly state: () => { readonly model: ChartModel; readonly layout: ChartLayout; readonly measureText: TextMeasurer; readonly locale: string; readonly tag: (r: MeasureReading) => string } | null;
  /** Whether a drag measures now (the measure mode). */
  readonly active: () => boolean;
  /** The point a place picks, as hover picks it (a line's point at that x, a mark within reach). */
  readonly pick: (x: number, y: number) => PointRef | null;
  /** A measure kept (both points) or gone (null). */
  readonly changed: (m: { readonly from: PointRef; readonly to: PointRef; readonly reading: MeasureReading } | null, fromKeyboard: boolean) => void;
}

export class MeasurePart {
  private readonly layer: SVGGElement;
  private from: PointRef | null = null;
  private to: PointRef | null = null;
  private dragging: number | null = null;
  /** A measure started from the keyboard: its end follows the focus. */
  private keyed = false;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly kit: MeasureKit,
    private readonly hooks: MeasureHooks,
  ) {
    this.layer = document.createElementNS(NS, 'g');
    this.layer.setAttribute('class', 'dzgraph-measure');
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.style.pointerEvents = 'none';
    svg.insertBefore(this.layer, svg.querySelector('.dzgraph-a11y'));
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onUp);
  }

  /** Whether a drag is under way: hover and the crosshair wait. */
  busy(): boolean {
    return this.dragging !== null;
  }

  /** Drawn again on the points where they now are (zoom, pan, resize keep it: measure.md 4). */
  redraw(): void {
    const s = this.hooks.state();
    const items = s && this.from && this.to ? this.kit.draw(s.model, s.layout, this.from, this.to, this.label(), s.measureText) : null;
    if (!items) {
      this.layer.replaceChildren();
      return;
    }
    this.layer.replaceChildren(
      ...items.map((p) => {
        const spec = svgOf(p as Parameters<typeof svgOf>[0]);
        const el = document.createElementNS(NS, spec.tag);
        for (const [k, v] of Object.entries(spec.attrs)) el.setAttribute(k, v);
        if (spec.text !== undefined) el.textContent = spec.text;
        return el;
      }),
    );
  }

  /** New data: the measure stays while both its points are still there (measure.md 4). */
  keepIf(there: (p: PointRef) => boolean): void {
    if (this.from && this.to && !(there(this.from) && there(this.to))) this.clear();
  }

  /** Removes the measure (Escape, a change of mode, new data); true when there was one. */
  clear(): boolean {
    const had = this.from !== null;
    this.from = this.to = null;
    this.keyed = false;
    this.dragging = null;
    this.layer.replaceChildren();
    if (had) this.hooks.changed(null, false);
    return had;
  }

  /** M on a focused point: starts a measure there, or keeps the one under way (measure.md 5). */
  key(at: PointRef): void {
    if (this.keyed) {
      this.keyed = false;
      this.tell(true);
      return;
    }
    this.from = this.to = at;
    this.keyed = true;
    this.redraw();
  }

  /** The focus moved: a keyboard measure's end follows it. */
  focusMoved(at: PointRef): void {
    if (!this.keyed) return;
    this.to = at;
    this.redraw();
  }

  private label(): string {
    const s = this.hooks.state();
    const r = s && this.from && this.to ? this.kit.read(s.model, s.layout, this.from, this.to, s.locale) : null;
    return s && r ? s.tag(r) : '';
  }

  private tell(fromKeyboard: boolean): void {
    const s = this.hooks.state();
    const r = s && this.from && this.to ? this.kit.read(s.model, s.layout, this.from, this.to, s.locale) : null;
    if (r && this.from && this.to) this.hooks.changed({ from: this.from, to: this.to, reading: r }, fromKeyboard);
  }

  private local(e: PointerEvent) {
    const box = this.svg.getBoundingClientRect();
    return { x: e.clientX - box.x, y: e.clientY - box.y };
  }

  private readonly onDown = (e: PointerEvent) => {
    if (!this.hooks.active() || e.shiftKey || (e.pointerType !== 'touch' && e.button !== 0)) return;
    const p = this.local(e);
    const at = this.hooks.pick(p.x, p.y);
    // A press on nothing: the measure goes (measure.md 4).
    if (!at) return void this.clear();
    this.from = this.to = at;
    this.keyed = false;
    this.dragging = e.pointerId;
    e.preventDefault();
    try {
      this.svg.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer cannot be captured: the drag still works inside the chart.
    }
    this.redraw();
  };

  private readonly onMove = (e: PointerEvent) => {
    if (this.dragging !== e.pointerId) return;
    const p = this.local(e);
    const at = this.hooks.pick(p.x, p.y);
    if (at && (at.seriesId !== this.to?.seriesId || at.index !== this.to.index)) {
      this.to = at;
      this.redraw();
    }
  };

  private readonly onUp = (e: PointerEvent) => {
    if (this.dragging !== e.pointerId) return;
    this.dragging = null;
    this.tell(false);
  };

  destroy(): void {
    this.svg.removeEventListener('pointerdown', this.onDown);
    this.svg.removeEventListener('pointermove', this.onMove);
    this.svg.removeEventListener('pointerup', this.onUp);
    this.svg.removeEventListener('pointercancel', this.onUp);
    this.layer.remove();
  }
}
