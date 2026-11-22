/**
 * The points for the keyboard and screen readers (keyboard.md, screen-reader.md 2–3), pattern B of spike S6: each
 * visible series a list, each point an item that takes the real focus; one tab stop for them all (the point focused
 * last). A series of more than 500 points has one item standing for its focused point, replaced on each move so the
 * new point is read. Arrows follow the screen. The items are invisible: focus shows through the hover layer.
 */
import type { PointRef } from '@dzgraph/core';
import type { ChartLayout, ChartModel, SeriesModel, View } from '@dzgraph/core/internal';
import { isShown, navigate, pointAt, pointLabel, rankOf, seriesName, validOrder } from '@dzgraph/core/internal';
import type { Messages } from './messages.js';

const NS = 'http://www.w3.org/2000/svg';
/** Past this many points a series is not written out in full (screen-reader.md 3). */
const FULL_LIST = 500;

export interface KeyboardHooks {
  focused(point: PointRef): void;
  leave(): void;
  clicked(point: PointRef): void;
  escape(): void;
  /** A key the chart takes before the points' navigation (zoom keys, zoom-pan.md 8); true when used. */
  key?(e: KeyboardEvent, point: PointRef): boolean;
}

interface Ready {
  readonly model: ChartModel;
  readonly layout: ChartLayout;
  readonly view: View;
  readonly locale: string;
  readonly messages: Messages;
}

/** The points' DOM items (GLOSSARY: a Point is the app's record; these are what stands for them). */
export class PointItems {
  private ready: Ready | null = null;
  /** Each visible series' points with a value, in index order. */
  private order = new Map<string, Int32Array>();
  private active: PointRef | null = null;
  private readonly lists = new Map<string, SVGGElement>();
  private readonly items = new Map<string, SVGCircleElement>();

  constructor(
    private readonly group: SVGGElement,
    private readonly hooks: KeyboardHooks,
  ) {
    group.addEventListener('keydown', this.onKey);
    group.addEventListener('focusin', this.onFocus);
    group.addEventListener('focusout', this.onBlur);
  }

  update(ready: Ready): void {
    this.ready = ready;
    const shown = ready.model.series.filter((s) => isShown(s, ready.view));
    // A polar series' points in drawing order, « Autres » included (ADR 0007); others by index.
    this.order = new Map(shown.map((s) => {
      const placement = ready.layout.placements.get(s.id);
      return [s.id, placement ? Int32Array.from(placement.order) : validOrder(s)];
    }));
    // The active point stays if it still has a value; else the nearest point of its series that does; else the first
    // point of the first visible series (review 3: the tab stop must never vanish).
    const own = this.active ? this.order.get(this.active.seriesId) : undefined;
    if (this.active && own?.length) {
      const at = Math.min(own.length - 1, rankOf(own, this.active.index));
      if (own[at] !== this.active.index) this.active = { seriesId: this.active.seriesId, index: own[at]! };
    } else {
      const first = shown.find((s) => this.order.get(s.id)!.length > 0);
      this.active = first ? { seriesId: first.id, index: this.order.get(first.id)![0]! } : null;
    }
    const seen = new Set<string>();
    const count = new Intl.NumberFormat(ready.locale);
    // Elements moved only when out of place: moving the focused one would drop the focus (review 1).
    let listCursor: ChildNode | null = this.group.firstChild;
    for (const s of shown) {
      const indices = this.order.get(s.id)!;
      let list = this.lists.get(s.id);
      if (!list) {
        list = document.createElementNS(NS, 'g');
        list.setAttribute('role', 'list');
        this.lists.set(s.id, list);
      }
      list.setAttribute('aria-label', ready.messages.seriesList(seriesName(s, ready.messages), count.format(indices.length)));
      // A gauge's one point is a meter (gauge.md 9), in a group, not a list.
      list.setAttribute('role', ready.layout.placements.get(s.id)?.meter ? 'group' : 'list');
      if (list !== listCursor) this.group.insertBefore(list, listCursor);
      listCursor = list.nextSibling;
      let itemCursor: ChildNode | null = list.firstChild;
      const full = indices.length <= FULL_LIST;
      const wanted = full ? indices : this.active?.seriesId === s.id ? Int32Array.of(this.active.index) : indices.length ? Int32Array.of(indices[0]!) : new Int32Array(0);
      for (const i of wanted) {
        const key = `${s.id}\u0000${i}`;
        seen.add(key);
        const item = this.items.get(key) ?? this.make(s.id, i);
        this.items.set(key, item);
        this.place(item, s, i);
        if (item !== itemCursor) list.insertBefore(item, itemCursor);
        itemCursor = item.nextSibling;
      }
    }
    for (const [key, item] of this.items) if (!seen.has(key)) {
      if (item === document.activeElement) continue;
      item.remove();
      this.items.delete(key);
    }
    for (const [id, list] of this.lists) if (!shown.some((s) => s.id === id)) {
      list.remove();
      this.lists.delete(id);
    }
    this.retab();
  }

  private make(seriesId: string, index: number): SVGCircleElement {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'dzgraph-point');
    c.setAttribute('role', 'listitem');
    c.setAttribute('r', '4');
    c.setAttribute('fill', 'none');
    c.setAttribute('pointer-events', 'none');
    c.dataset['series'] = seriesId;
    c.dataset['index'] = String(index);
    return c;
  }

  /** Where the item sits (so magnifiers follow the focus) and what it reads. */
  private place(item: SVGCircleElement, s: SeriesModel, i: number): void {
    const r = this.ready!;
    const at = pointAt(r.model, r.layout, { seriesId: s.id, index: i });
    if (at) {
      item.setAttribute('cx', String(at.x));
      item.setAttribute('cy', String(at.y));
    }
    const label = pointLabel(r.model, r.layout, { seriesId: s.id, index: i }, r.locale, r.messages, r.view);
    if (label) {
      const n = new Intl.NumberFormat(r.locale);
      item.setAttribute('aria-label', r.messages.point({ ...label, position: n.format(label.position), count: n.format(label.count) }));
      if (label.meter) {
        item.setAttribute('role', 'meter');
        item.setAttribute('aria-valuemin', String(label.meter.low));
        item.setAttribute('aria-valuemax', String(label.meter.high));
        item.setAttribute('aria-valuenow', String(label.meter.now));
        item.setAttribute('aria-valuetext', item.getAttribute('aria-label')!);
      }
    }
  }

  /** One tab stop: the active point. */
  private retab(): void {
    for (const [key, item] of this.items) item.setAttribute('tabindex', this.active && key === `${this.active.seriesId}\u0000${this.active.index}` ? '0' : '-1');
  }

  private readonly onFocus = (e: FocusEvent) => {
    const ref = refOf(e.target);
    if (!ref) return;
    this.active = ref;
    this.retab();
    this.hooks.focused(ref);
  };

  private readonly onBlur = (e: FocusEvent) => {
    if (!refOf(e.relatedTarget)) this.hooks.leave();
  };

  private readonly onKey = (e: KeyboardEvent) => {
    const r = this.ready;
    const at = this.active;
    if (!r || !at) return;
    if (e.key === 'Enter') return void this.hooks.clicked(at);
    if (e.key === 'Escape') return void this.hooks.escape();
    if (this.hooks.key?.(e, at)) return void e.preventDefault();
    // Where the key leads (keyboard.md 2–3): the core decides (navigate.ts).
    const next = navigate(r.model, r.layout, r.view, at, e.key);
    if (!next) return;
    e.preventDefault();
    if (next.seriesId !== at.seriesId || next.index !== at.index) this.moveTo(next);
  };

  /** The point that holds the tab stop. */
  get activePoint(): PointRef | null {
    return this.active;
  }

  /** Whether the keyboard focus is on one of the points. */
  get hasFocus(): boolean {
    return refOf(document.activeElement) !== null;
  }

  /** Moves the focus to a point (a zoom that left the focused one out of view, zoom-pan.md 8). */
  focusPoint(ref: PointRef): void {
    this.moveTo(ref);
  }

  private moveTo(ref: PointRef): void {
    const key = `${ref.seriesId}\u0000${ref.index}`;
    let item = this.items.get(key);
    if (!item && this.ready) {
      // A long series: its one item is replaced by the new point's, so the reader reads it (screen-reader.md 3).
      const s = this.ready.model.series.find((o) => o.id === ref.seriesId)!;
      const old = [...this.items].find(([k]) => k.startsWith(`${ref.seriesId}\u0000`));
      item = this.make(ref.seriesId, ref.index);
      this.place(item, s, ref.index);
      this.items.set(key, item);
      if (old) {
        old[1].replaceWith(item);
        this.items.delete(old[0]);
      } else this.lists.get(ref.seriesId)?.appendChild(item);
    }
    if (!item) return;
    this.active = ref;
    this.retab();
    item.focus();
  }
}

function refOf(target: EventTarget | null): PointRef | null {
  if (!(target instanceof SVGElement) || !target.classList.contains('dzgraph-point')) return null;
  const seriesId = target.dataset['series'];
  const index = Number(target.dataset['index']);
  return seriesId === undefined || !Number.isInteger(index) ? null : { seriesId, index };
}
