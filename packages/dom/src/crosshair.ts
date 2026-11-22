/**
 * The crosshair on screen (crosshair.md): what the core's crosshair kit draws at the pointer, or through the focused
 * point, painted in its own layer under the hover layer (the hovered markers and the tooltip stay on top). Comes with
 * the `crosshair` module (ADR 0006).
 */
import type { ChartLayout, ChartModel, CrosshairKit } from '@dzgraph/core/internal';
import type { TextMeasurer } from '@dzgraph/core';
import { svgOf } from '@dzgraph/core/internal';

const NS = 'http://www.w3.org/2000/svg';

export interface CrosshairHooks {
  readonly state: () => { readonly model: ChartModel; readonly layout: ChartLayout; readonly measureText: TextMeasurer; readonly locale: string } | null;
  /** A gesture owns the pointer (a drag, the navigator's handles): no crosshair meanwhile. */
  readonly busy: () => boolean;
}

export class CrosshairPart {
  private readonly layer: SVGGElement;
  private touching = false;
  /** The place the keyboard focus gives, shown when the pointer shows none. */
  private focused: { x: number; y: number } | null = null;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly kit: CrosshairKit,
    private readonly hooks: CrosshairHooks,
  ) {
    this.layer = document.createElementNS(NS, 'g');
    this.layer.setAttribute('class', 'dzgraph-crosshair-layer');
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.style.pointerEvents = 'none';
    // Under the hover layer: the tooltip's markers stay on top (crosshair.md 1). The painter puts its layers before the
    // first thing after its defs, so before this one, and never moves it.
    svg.insertBefore(this.layer, svg.querySelector('.dzgraph-hover'));
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onUp);
    svg.addEventListener('pointerleave', this.onLeave);
  }

  /** Through the focused point (crosshair.md 5); null when the focus leaves the points. */
  focus(at: { x: number; y: number } | null): void {
    this.focused = at;
    this.show(at);
  }

  private show(at: { x: number; y: number } | null): void {
    const s = this.hooks.state();
    const items = at && s ? this.kit.draw(s.model, s.layout, at, s.measureText, s.locale) : null;
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

  private local(e: PointerEvent) {
    const box = this.svg.getBoundingClientRect();
    return { x: e.clientX - box.x, y: e.clientY - box.y };
  }

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && !this.touching) return;
    // A gesture owns the pointer: the crosshair waits (it shows again on the next move).
    if (this.hooks.busy()) return this.show(null);
    this.show(this.local(e));
  };

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.touching = true;
    this.show(this.local(e));
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touching = false;
  };

  private readonly onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.show(this.focused);
  };

  destroy(): void {
    this.svg.removeEventListener('pointermove', this.onMove);
    this.svg.removeEventListener('pointerdown', this.onDown);
    this.svg.removeEventListener('pointerup', this.onUp);
    this.svg.removeEventListener('pointercancel', this.onUp);
    this.svg.removeEventListener('pointerleave', this.onLeave);
    this.layer.remove();
  }
}
