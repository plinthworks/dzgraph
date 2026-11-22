/**
 * Zoom and pan gestures (zoom-pan.md, owner 2026-11-21): drag to zoom on x, Shift + drag to pan, Ctrl/⌘ + wheel to
 * zoom around the pointer, pinch on touch and a one-finger slide once zoomed, keys on a focused point. Gestures only
 * turn into ranges here; clamping, zooming and panning are the core's (`zoom.ts`), drawing is the chart's.
 */
import { clampRange, panBy, screenStep, zoomAround, type Extent, type Range } from '@dzgraph/core/internal';

const NS = 'http://www.w3.org/2000/svg';
/** Shorter than this, a drag is a click (zoom-pan.md 1). */
const CLICK_SLOP = 5;
/** How much one wheel pixel zooms: about 18 % for a notch of 100. */
const WHEEL_RATE = 0.002;
/** Keyboard steps (zoom-pan.md 8): + halves the range, − doubles it, Shift + arrow moves it by a tenth. */
const KEY_ZOOM = 0.5;
const KEY_PAN = 0.1;

/** What a gesture needs from the chart as last drawn. */
export interface GestureFrame {
  /** The plot in scene pixels. */
  readonly plot: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Whether the x axis runs across the screen (columns, lines) or down it (bars). */
  readonly horizontal: boolean;
  /** Where the shown range's two ends are on screen, along the axis (reversed or mirrored axes swap them). */
  readonly ends: readonly [number, number];
  readonly extent: Extent;
  /** The shown range: the visible range, or the whole extent. */
  readonly shown: Range;
  readonly zoomed: boolean;
}

export interface GestureHooks {
  frame(): GestureFrame | null;
  /** A new range (`null`: the whole). `animate`: the end of a gesture, eased; else at once (wheel, pinch, pan). */
  setRange(range: Range | null, how: 'animate' | 'now', from: 'pointer' | 'keyboard'): void;
  /** Whether a plain drag zooms (the zoom mode, modes.md); Shift + drag pans in every mode. Absent: always. */
  dragZooms?(): boolean;
  /** Whether Shift + drag pans (not in selection mode, where Shift adds, modes.md 4). Absent: always. */
  dragPans?(): boolean;
}

type Drag =
  | { readonly kind: 'zoom'; readonly id: number; readonly start: number; readonly frame: GestureFrame; moved: boolean; band: SVGRectElement | null }
  | { readonly kind: 'pan'; readonly id: number; readonly start: number; readonly frame: GestureFrame; moved: boolean }
  | { readonly kind: 'pinch'; readonly frame: GestureFrame; readonly ids: readonly [number, number]; readonly mid: number; readonly distance: number };

export class Gestures {
  private readonly layer: SVGGElement;
  private drag: Drag | null = null;
  /** Touch pointers down, by id: their position along the axis. */
  private readonly touches = new Map<number, number>();
  /** A drag just ended: the click that follows is not a click on a point. */
  private swallow = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly svg: SVGSVGElement,
    private readonly hooks: GestureHooks,
  ) {
    this.layer = document.createElementNS(NS, 'g');
    this.layer.setAttribute('class', 'dzgraph-gestures');
    this.layer.setAttribute('aria-hidden', 'true');
    svg.appendChild(this.layer);
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onCancel);
    svg.addEventListener('wheel', this.onWheel, { passive: false });
    // Capture on the root runs before the point's click handler on the drawing.
    root.addEventListener('click', this.onClick, true);
  }

  /** Whether a gesture holds the pointer: the hover and the tooltip stand aside. */
  busy(): boolean {
    return this.drag !== null && (this.drag.kind === 'pinch' || this.drag.moved);
  }

  /** A key on a focused point (zoom-pan.md 8); true when it was a zoom key and was used. */
  key(e: KeyboardEvent, x: number | null): boolean {
    const f = this.hooks.frame();
    if (!f) return false;
    const span = f.shown.max - f.shown.min;
    if ((e.key === '+' || e.key === '=') && x !== null) {
      // Through `whole`: on data too short to zoom, the clamped range is the whole, which is no zoom (review 2).
      this.whole(zoomAround(f.shown, KEY_ZOOM, x, f.extent), f, 'animate', 'keyboard');
      return true;
    }
    if ((e.key === '-' || e.key === '_') && x !== null) {
      this.whole(zoomAround(f.shown, 1 / KEY_ZOOM, x, f.extent), f, 'animate', 'keyboard');
      return true;
    }
    if (e.key === '0') {
      if (f.zoomed) this.hooks.setRange(null, 'animate', 'keyboard');
      return f.zoomed;
    }
    if (!e.shiftKey || !f.zoomed) return false;
    // Arrows follow the screen: → shows what is to the right, whatever the axis's direction.
    const screen = screenStep(e.key, f.horizontal);
    if (!screen) return false;
    const towardMax = f.ends[1] > f.ends[0] ? screen : -screen;
    this.hooks.setRange(panBy(f.shown, towardMax * KEY_PAN * span, f.extent), 'now', 'keyboard');
    return true;
  }

  destroy(): void {
    this.svg.removeEventListener('pointerdown', this.onDown);
    this.svg.removeEventListener('pointermove', this.onMove);
    this.svg.removeEventListener('pointerup', this.onUp);
    this.svg.removeEventListener('pointercancel', this.onCancel);
    this.svg.removeEventListener('wheel', this.onWheel);
    this.root.removeEventListener('click', this.onClick, true);
    this.layer.remove();
  }

  /** A position along the axis, in scene pixels. */
  private along(e: MouseEvent, f: GestureFrame): number {
    const box = this.svg.getBoundingClientRect();
    return f.horizontal ? e.clientX - box.x : e.clientY - box.y;
  }

  private inPlot(e: MouseEvent, f: GestureFrame): boolean {
    const box = this.svg.getBoundingClientRect();
    const x = e.clientX - box.x;
    const y = e.clientY - box.y;
    return x >= f.plot.x && x <= f.plot.x + f.plot.width && y >= f.plot.y && y <= f.plot.y + f.plot.height;
  }

  /** The data value at a screen position along the axis, for the range shown when the gesture began. */
  private valueAt(p: number, f: GestureFrame): number {
    const [a, b] = f.ends;
    return f.shown.min + ((p - a) / (b - a || 1)) * (f.shown.max - f.shown.min);
  }

  /** A range, or the whole (null) when it covers the extent. */
  private whole(r: Range, f: GestureFrame, how: 'animate' | 'now', from: 'pointer' | 'keyboard'): void {
    this.hooks.setRange(r.min <= f.extent.min && r.max >= f.extent.max ? null : r, how, from);
  }

  private readonly onDown = (e: PointerEvent) => {
    this.swallow = false;
    const f = this.hooks.frame();
    if (!f) return;
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, this.along(e, f));
      if (this.touches.size === 2) {
        const [[i, p], [j, q]] = [...this.touches] as [[number, number], [number, number]];
        this.drag = { kind: 'pinch', frame: f, ids: [i, j], mid: this.valueAt((p + q) / 2, f), distance: Math.max(Math.abs(p - q), 1) };
      } else if (this.touches.size > 2) {
        // A third finger ends the pinch: its pair is no longer the one it started with (review 12).
        this.end(true);
      } else if (this.touches.size === 1 && f.zoomed && this.inPlot(e, f)) {
        this.drag = { kind: 'pan', id: e.pointerId, start: this.along(e, f), frame: f, moved: false };
      }
      return;
    }
    if (e.button !== 0 || !this.inPlot(e, f)) return;
    const pan = e.shiftKey && f.zoomed && this.hooks.dragPans?.() !== false;
    if (!pan && this.hooks.dragZooms && !this.hooks.dragZooms()) return;
    this.drag = pan ? { kind: 'pan', id: e.pointerId, start: this.along(e, f), frame: f, moved: false } : { kind: 'zoom', id: e.pointerId, start: this.along(e, f), frame: f, moved: false, band: null };
    // No text selection, no native drag while the pointer draws a band.
    e.preventDefault();
    try {
      this.svg.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser does not know (a synthetic one) cannot be captured: the gesture still works inside.
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) this.touches.set(e.pointerId, this.along(e, d.frame));
    if (d.kind === 'pinch') {
      const p = this.touches.get(d.ids[0]);
      const q = this.touches.get(d.ids[1]);
      if (p === undefined || q === undefined) return;
      const f = d.frame;
      const span = (f.shown.max - f.shown.min) * (d.distance / Math.max(Math.abs(p - q), 1));
      // The value first between the fingers stays between them.
      const rel = ((p + q) / 2 - f.ends[0]) / (f.ends[1] - f.ends[0] || 1);
      this.whole(clampRange({ min: d.mid - rel * span, max: d.mid - rel * span + span }, f.extent), f, 'now', 'pointer');
      return;
    }
    if (e.pointerId !== d.id) return;
    const now = this.along(e, d.frame);
    if (!d.moved && Math.abs(now - d.start) < CLICK_SLOP) return;
    d.moved = true;
    if (d.kind === 'pan') {
      this.svg.style.cursor = 'grabbing';
      const f = d.frame;
      const delta = ((d.start - now) / (f.ends[1] - f.ends[0] || 1)) * (f.shown.max - f.shown.min);
      this.hooks.setRange(panBy(f.shown, delta, f.extent), 'now', 'pointer');
      return;
    }
    this.showBand(d, now);
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pinch') {
      // One finger lifted: the gesture is over (the other one does not start a pan).
      if (this.touches.size < 2) this.end(true);
      return;
    }
    if (e.pointerId !== d.id) return;
    if (d.kind === 'zoom' && d.moved) {
      const f = d.frame;
      const a = this.valueAt(d.start, f);
      const b = this.valueAt(this.along(e, f), f);
      this.whole(clampRange({ min: Math.min(a, b), max: Math.max(a, b) }, f.extent), f, 'animate', 'pointer');
    }
    this.end(d.moved);
  };

  private readonly onCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId);
    if (this.drag) this.end(false);
  };

  private end(moved: boolean): void {
    if (this.drag?.kind === 'zoom') this.drag.band?.remove();
    this.drag = null;
    this.svg.style.cursor = '';
    this.swallow = moved;
  }

  private showBand(d: Extract<Drag, { kind: 'zoom' }>, now: number): void {
    if (!d.band) {
      d.band = document.createElementNS(NS, 'rect');
      d.band.setAttribute('class', 'dzgraph-zoom-band');
      this.layer.appendChild(d.band);
    }
    const p = d.frame.plot;
    const lo = Math.max(Math.min(d.start, now), d.frame.horizontal ? p.x : p.y);
    const hi = Math.min(Math.max(d.start, now), d.frame.horizontal ? p.x + p.width : p.y + p.height);
    const box = d.frame.horizontal ? { x: lo, y: p.y, width: hi - lo, height: p.height } : { x: p.x, y: lo, width: p.width, height: hi - lo };
    for (const [k, v] of Object.entries(box)) d.band.setAttribute(k, String(v));
  }

  private readonly onWheel = (e: WheelEvent) => {
    // The wheel scrolls the page (owner 2026-11-21); with Ctrl or ⌘ (and a trackpad's pinch, sent as Ctrl) it zooms.
    if (!e.ctrlKey && !e.metaKey) return;
    const f = this.hooks.frame();
    if (!f || !this.inPlot(e, f)) return;
    e.preventDefault();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    this.whole(zoomAround(f.shown, Math.exp(delta * WHEEL_RATE), this.valueAt(this.along(e, f), f), f.extent), f, 'now', 'pointer');
  };

  private readonly onClick = (e: MouseEvent) => {
    if (!this.swallow) return;
    this.swallow = false;
    // Only the click a drag ends with, on the drawing: a button of the chart still works.
    if (e.target instanceof Node && this.svg.contains(e.target)) e.stopPropagation();
  };
}

export interface ZoomHooks extends GestureHooks {
  /** The reset button was pressed from the keyboard and goes away: the focus goes back to the points. */
  refocus(): void;
}

/** Between the reset button and the plot's edges. */
const RESET_INSET = 8;

/** The zoom module's part of the chart (ADR 0006): the gestures and the reset button (zoom-pan.md 7). */
export class ZoomControls {
  private readonly gestures: Gestures;
  private readonly reset = document.createElement('button');

  constructor(root: HTMLElement, svg: SVGSVGElement, hooks: ZoomHooks) {
    this.gestures = new Gestures(root, svg, hooks);
    const reset = this.reset;
    reset.type = 'button';
    reset.className = 'dzgraph-reset';
    reset.hidden = true;
    Object.assign(reset.style, { position: 'absolute', zIndex: '2' });
    reset.addEventListener('click', () => {
      const had = document.activeElement === reset;
      hooks.setRange(null, 'animate', had ? 'keyboard' : 'pointer');
      if (had) hooks.refocus();
    });
    root.appendChild(reset);
  }

  busy(): boolean {
    return this.gestures.busy();
  }

  key(e: KeyboardEvent, x: number | null): boolean {
    return this.gestures.key(e, x);
  }

  /** At the end of the plot's top edge, shown when zoomed. */
  place(plot: { readonly x: number; readonly y: number; readonly width: number }, width: number, dir: 'ltr' | 'rtl', range: Range | null, label: string): void {
    const reset = this.reset;
    reset.textContent = label;
    reset.hidden = range === null;
    reset.style.insetBlockStart = `${plot.y + RESET_INSET}px`;
    reset.style.insetInlineEnd = `${dir === 'rtl' ? plot.x + RESET_INSET : width - plot.x - plot.width + RESET_INSET}px`;
  }

  destroy(): void {
    this.gestures.destroy();
    this.reset.remove();
  }
}
