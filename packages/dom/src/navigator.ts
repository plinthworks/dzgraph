/**
 * The navigator's controls (navigator.md 3–5): the pointer drags a handle, drags the window, or centres the window
 * where it is pressed outside it; two sliders take the keyboard. The strip itself is in the scene (the core's
 * `navigatorGroups`); this only turns gestures into ranges.
 */
import type { NavigatorLayout, Range } from '@dzgraph/core/internal';
import { HANDLE_HEIGHT, HANDLE_WIDTH, clampRange, panBy, sliderStep } from '@dzgraph/core/internal';

const NS = 'http://www.w3.org/2000/svg';
/** How near a handle the pointer must be to take it. */
const HANDLE_REACH = 6;

export interface NavigatorHooks {
  /** The navigator as last laid out, and the range shown (null: the whole). */
  state(): { readonly nav: NavigatorLayout; readonly range: Range | null; readonly label: (v: number) => string } | null;
  setRange(range: Range | null, how: 'animate' | 'now'): void;
  words(): { readonly start: string; readonly end: string };
}

type Grab =
  | { readonly kind: 'start' | 'end' }
  /** Both handles under the pointer (a narrow window): the first move's direction picks one (review 6). */
  | { readonly kind: 'either'; readonly from: number }
  | { readonly kind: 'window'; readonly from: number; readonly range: Range };

export class NavigatorControls {
  private grab: Grab | null = null;
  private readonly sliders: Record<'start' | 'end', SVGRectElement>;

  constructor(
    private readonly svg: SVGSVGElement,
    group: SVGGElement,
    private readonly hooks: NavigatorHooks,
  ) {
    const make = (part: 'start' | 'end') => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('class', 'dzgraph-nav-handle');
      r.setAttribute('role', 'slider');
      r.setAttribute('aria-orientation', 'horizontal');
      r.setAttribute('tabindex', '0');
      r.setAttribute('rx', '2');
      r.addEventListener('keydown', (e) => this.onKey(e, part));
      return r;
    };
    this.sliders = { start: make('start'), end: make('end') };
    group.append(this.sliders.start, this.sliders.end);
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onUp);
  }

  /** The sliders follow the window (after each layout, and each change of range). */
  update(): void {
    const s = this.hooks.state();
    const words = this.hooks.words();
    for (const part of ['start', 'end'] as const) {
      const el = this.sliders[part];
      el.style.display = s ? '' : 'none';
      if (!s) continue;
      const { nav, range } = s;
      const r = range ?? nav.extent;
      const v = part === 'start' ? r.min : r.max;
      const at = { x: nav.map(v) - HANDLE_WIDTH / 2, y: nav.box.y + (nav.box.height - HANDLE_HEIGHT) / 2, width: HANDLE_WIDTH, height: HANDLE_HEIGHT };
      for (const [k, n] of Object.entries(at)) el.setAttribute(k, String(n));
      el.setAttribute('aria-label', part === 'start' ? words.start : words.end);
      el.setAttribute('aria-valuemin', String(nav.extent.min));
      el.setAttribute('aria-valuemax', String(nav.extent.max));
      el.setAttribute('aria-valuenow', String(v));
      el.setAttribute('aria-valuetext', s.label(v));
    }
  }

  destroy(): void {
    this.svg.removeEventListener('pointerdown', this.onDown);
    this.svg.removeEventListener('pointermove', this.onMove);
    this.svg.removeEventListener('pointerup', this.onUp);
    this.svg.removeEventListener('pointercancel', this.onUp);
    this.sliders.start.remove();
    this.sliders.end.remove();
  }

  /** A range from its two ends, ordered and kept inside the data; the whole is null. */
  private settle(min: number, max: number, nav: NavigatorLayout, how: 'animate' | 'now'): void {
    const r = clampRange({ min: Math.min(min, max), max: Math.max(min, max) }, nav.extent);
    this.hooks.setRange(r.min <= nav.extent.min && r.max >= nav.extent.max ? null : r, how);
  }

  private onKey(e: KeyboardEvent, part: 'start' | 'end'): void {
    const s = this.hooks.state();
    if (!s) return;
    const { nav } = s;
    const towardEnd = nav.map(nav.extent.max) > nav.map(nav.extent.min);
    const step = sliderStep(e.key, towardEnd);
    if (step === null) return;
    e.preventDefault();
    const whole = nav.extent.max - nav.extent.min;
    const r = s.range ?? nav.extent;
    // Shift moves the window, both ends (navigator.md 4).
    if (e.shiftKey) {
      const moved = panBy(r, Math.max(-whole, Math.min(whole, step * whole)), nav.extent);
      return this.settle(moved.min, moved.max, nav, 'now');
    }
    const v = (part === 'start' ? r.min : r.max) + Math.max(-whole, Math.min(whole, step * whole));
    const min = part === 'start' ? Math.min(Math.max(v, nav.extent.min), r.max - 2 * nav.extent.step) : r.min;
    const max = part === 'end' ? Math.max(Math.min(v, nav.extent.max), r.min + 2 * nav.extent.step) : r.max;
    this.settle(min, max, nav, 'now');
  }

  /** Scene pixels of an event, and whether it is on the strip. */
  private at(e: PointerEvent, nav: NavigatorLayout): { x: number; on: boolean } {
    const box = this.svg.getBoundingClientRect();
    const x = e.clientX - box.x;
    const y = e.clientY - box.y;
    const b = nav.box;
    return { x, on: x >= b.x - HANDLE_REACH && x <= b.x + b.width + HANDLE_REACH && y >= b.y && y <= b.y + b.height };
  }

  private readonly onDown = (e: PointerEvent) => {
    const s = this.hooks.state();
    if (!s || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const { nav } = s;
    const { x, on } = this.at(e, nav);
    if (!on) return;
    e.preventDefault();
    const r = s.range ?? nav.extent;
    const ps = nav.map(r.min);
    const pe = nav.map(r.max);
    const nearEnd = Math.abs(x - pe) <= HANDLE_REACH;
    const nearStart = Math.abs(x - ps) <= HANDLE_REACH;
    if (nearEnd && nearStart) this.grab = { kind: 'either', from: nav.invert(x) };
    else if (nearEnd) this.grab = { kind: 'end' };
    else if (nearStart) this.grab = { kind: 'start' };
    else if (x > Math.min(ps, pe) && x < Math.max(ps, pe)) this.grab = { kind: 'window', from: nav.invert(x), range: r };
    else {
      // Outside the window: centre it there, then the pointer holds it (navigator.md 3).
      const half = (r.max - r.min) / 2;
      const v = nav.invert(x);
      const centred = clampRange({ min: v - half, max: v + half }, nav.extent);
      this.settle(centred.min, centred.max, nav, 'animate');
      this.grab = { kind: 'window', from: v, range: centred };
    }
    try {
      this.svg.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer cannot be captured: the drag still works over the strip.
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    let g = this.grab;
    const s = this.hooks.state();
    if (!g || !s) return;
    const { nav } = s;
    const v = nav.invert(this.at(e, nav).x);
    if (g.kind === 'either') {
      if (v === g.from) return;
      g = this.grab = { kind: v < g.from ? 'start' : 'end' };
    }
    const r = s.range ?? nav.extent;
    if (g.kind === 'window') {
      const moved = panBy(g.range, v - g.from, nav.extent);
      return this.settle(moved.min, moved.max, nav, 'now');
    }
    const min = g.kind === 'start' ? Math.min(Math.max(v, nav.extent.min), r.max - 2 * nav.extent.step) : r.min;
    const max = g.kind === 'end' ? Math.max(Math.min(v, nav.extent.max), r.min + 2 * nav.extent.step) : r.max;
    this.settle(min, max, nav, 'now');
  };

  private readonly onUp = () => {
    this.grab = null;
  };

  /** Whether the navigator holds the pointer (the chart's own gestures stand aside). */
  busy(): boolean {
    return this.grab !== null;
  }
}
