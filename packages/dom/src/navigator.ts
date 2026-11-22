/**
 * The navigator's controls (navigator.md 3–5): the pointer drags a handle, drags the window, or centres the window
 * where it is pressed outside it; two sliders take the keyboard. The strip itself is in the scene (the core's
 * `navigatorGroups`); this only turns gestures into ranges.
 */
import type { ChartLayout, ChartModel, NavigatorLayout, Range, RangeButton } from '@dzgraph/core/internal';
import { HANDLE_HEIGHT, HANDLE_WIDTH, clampRange, extentOf, panBy, sliderStep, xValueLabel } from '@dzgraph/core/internal';
import type { Messages } from './messages.js';

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

export interface NavigatorPartHooks {
  /** The chart as last laid out, the range shown (null: the whole), and its words. */
  state(): { readonly model: ChartModel; readonly layout: ChartLayout; readonly range: Range | null; readonly locale: string; readonly messages: Messages } | null;
  setRange(range: Range | null, how: 'animate' | 'now'): void;
}

const BUTTONS = ['1m', '3m', 'ytd', '1y', 'all'] as const;

/** The navigator module's part of the chart (ADR 0006): the strip's controls and the range buttons. */
export class NavigatorPart {
  private readonly controls: NavigatorControls;
  private readonly box = document.createElement('div');
  private readonly buttons: HTMLButtonElement[];

  constructor(svg: SVGSVGElement, group: SVGGElement, root: HTMLElement, private readonly hooks: NavigatorPartHooks) {
    this.controls = new NavigatorControls(svg, group, {
      state: () => {
        const s = hooks.state();
        const nav = s?.layout.navigator;
        return s && nav ? { nav, range: s.range, label: (v: number) => xValueLabel(s.model, nav.axisId, v, s.locale) } : null;
      },
      setRange: (r, how) => hooks.setRange(r, how),
      words: () => {
        const m = hooks.state()?.messages;
        return { start: m?.rangeStart ?? '', end: m?.rangeEnd ?? '' };
      },
    });
    // The range buttons (range-buttons.md): a row of HTML buttons in the layout's range bar.
    const box = this.box;
    box.className = 'dzgraph-range-buttons';
    box.hidden = true;
    Object.assign(box.style, { position: 'absolute', zIndex: '2', display: 'flex', gap: '4px' });
    this.buttons = BUTTONS.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.addEventListener('click', () => {
        if (p === 'all') return hooks.setRange(null, 'animate');
        const r = this.span(p);
        if (r) hooks.setRange(r.range, 'animate');
      });
      box.appendChild(b);
      return b;
    });
    root.appendChild(box);
  }

  /** A button's range, kept inside the data (null: the whole), and whether the data reach that far. */
  private span(p: RangeButton): { range: Range | null; fits: boolean; min: number; max: number } | null {
    const s = this.hooks.state();
    const id = s ? xAxisOf(s.model, s.layout) : undefined;
    if (!s || id === undefined) return null;
    const r = s.model.kit.navigator?.span(s.model, id, p);
    const e = extentOf(s.model, id);
    if (!r || !e) return null;
    const c = clampRange(r, e);
    return { range: c.min <= e.min && c.max >= e.max ? null : c, fits: r.fits, min: r.min, max: r.max };
  }

  busy(): boolean {
    return this.controls.busy();
  }

  update(width: number, dir: 'ltr' | 'rtl'): void {
    this.controls.update();
    const s = this.hooks.state();
    const bar = s?.layout.rangeBar;
    const box = this.box;
    box.hidden = !s || !bar || xAxisOf(s.model, s.layout) === undefined;
    // `hidden` loses to the inline display: hide it through the style too.
    box.style.display = box.hidden ? 'none' : 'flex';
    if (!s || !bar || box.hidden) return;
    box.style.insetBlockStart = `${bar.y}px`;
    box.style.insetInlineStart = `${dir === 'rtl' ? width - bar.x - bar.width : bar.x}px`;
    const m = s.messages;
    const names = { '1m': m.range1m, '3m': m.range3m, ytd: m.rangeYtd, '1y': m.range1y, all: m.rangeAll };
    const range = s.range;
    BUTTONS.forEach((p, i) => {
      const b = this.buttons[i]!;
      b.textContent = names[p];
      const r = p === 'all' ? null : this.span(p);
      b.disabled = p !== 'all' && !r?.fits;
      const pressed = p === 'all' ? range === null : r !== null && range !== null && Math.abs(r.min - range.min) < 1 && Math.abs(r.max - range.max) < 1;
      b.setAttribute('aria-pressed', String(pressed));
    });
  }

  destroy(): void {
    this.controls.destroy();
    this.box.remove();
  }
}

/** The x axis the range follows: the laid-out one, else the first. */
const xAxisOf = (m: ChartModel, l: ChartLayout) => l.axes.find((a) => a.dimension === 'x')?.id ?? m.xAxes[0]?.id;
