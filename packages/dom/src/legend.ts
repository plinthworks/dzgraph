/**
 * The legend's items as toggle buttons (legend-interaction.md): a transparent, focusable shape over each drawn item,
 * named by its series, pressed while the series is shown. Click, Enter and Space toggle; pointing or focusing
 * highlights (the other series fade). The drawing stays the scene's; these only make it operable.
 */
import type { ChartLayout, ChartModel, View } from '@dzgraph/core/internal';
import { isShown, seriesName } from '@dzgraph/core/internal';

const NS = 'http://www.w3.org/2000/svg';
/** Room around an item's sign and name, so the target is bigger than what is drawn. */
const PAD = 3;

/** By an item's key: its series' id, or a slice's point key (ADR 0007). */
export interface LegendHooks {
  toggle(key: string): void;
  highlight(key: string | undefined): void;
}

export class LegendButtons {
  private readonly buttons = new Map<string, SVGRectElement>();

  constructor(
    private readonly group: SVGGElement,
    private readonly hooks: LegendHooks,
  ) {}

  /** Places one button per drawn item; removes those of items no longer drawn. */
  update(model: ChartModel, layout: ChartLayout, view: View, text: { seriesName(place: number): string }): void {
    const seen = new Set<string>();
    // Elements moved only when out of place: moving the focused one would drop the focus (review 1).
    let cursor: ChildNode | null = this.group.firstChild;
    for (const item of layout.legend?.items ?? []) {
      const s = model.series.find((o) => o.id === item.seriesId);
      if (!s) continue;
      seen.add(item.key);
      let b = this.buttons.get(item.key);
      if (!b) {
        b = this.make(item.key);
        this.buttons.set(item.key, b);
      }
      // The item's box, as laid out, a little larger (the target bigger than what is drawn).
      const { box } = item;
      for (const [k, v] of Object.entries({ x: box.x - PAD, y: box.y - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD })) b.setAttribute(k, String(v));
      b.setAttribute('aria-label', item.point ? item.name : seriesName(s, text));
      b.setAttribute('aria-pressed', String(item.point ? !item.hidden : isShown(s, view)));
      if (b !== cursor) this.group.insertBefore(b, cursor);
      cursor = b.nextSibling;
    }
    for (const [id, b] of this.buttons) if (!seen.has(id)) {
      b.remove();
      this.buttons.delete(id);
    }
  }

  private make(seriesId: string): SVGRectElement {
    const b = document.createElementNS(NS, 'rect');
    b.setAttribute('class', 'dzgraph-legend-button');
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('fill', 'none');
    b.setAttribute('pointer-events', 'all');
    b.style.cursor = 'pointer';
    b.addEventListener('click', () => this.hooks.toggle(seriesId));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this.hooks.toggle(seriesId);
    });
    const on = () => this.hooks.highlight(seriesId);
    const off = () => this.hooks.highlight(undefined);
    b.addEventListener('pointerenter', on);
    b.addEventListener('pointerleave', off);
    b.addEventListener('focus', on);
    b.addEventListener('blur', off);
    return b;
  }
}
