/**
 * The chart menu (menu.md, D.16): a menu button at the end of the chart's top edge, offering what the app allows and
 * the data suit — a series' type, the aggregation, the value axis's scale, the comparison — and, with the
 * `exporting` module, a download and printing (menu.md 9). WAI-ARIA menu button:
 * Enter, Space or ↓ open it on its first item; ↑ ↓ move; → opens a submenu, ← or Escape closes it; Enter or Space
 * chooses; Escape closes the menu and gives the focus back to the button; Tab closes it. Comes with the `menu` module.
 */
import type { AggregateSpec, ChartModel, MenuItem } from '@dzgraph/core/internal';
import { screenStep, seriesName } from '@dzgraph/core/internal';
import type { Messages } from './messages.js';

export interface MenuChoice {
  readonly kind: 'type' | 'aggregation' | 'scale' | 'compare' | 'export' | 'print';
  /** The series a type is for. */
  readonly seriesId?: string;
  readonly value: string | null;
}

/** One entry of a submenu: a radio item (checked or not), or a plain action (`checked` null: a format to download). */
interface Radio {
  readonly label: string;
  readonly checked: boolean | null;
  readonly choice: MenuChoice;
}

export interface MenuHooks {
  /** What the menu reads to offer its items: the models, the words, the modules, the user's choices so far. */
  readonly state: () => {
    readonly model: ChartModel | null;
    readonly source: ChartModel | null;
    readonly words: Messages;
    readonly typeNames: readonly string[];
    readonly compares: boolean;
    readonly aggregates: boolean;
    /** Whether the exporting module came (menu.md 9). */
    readonly exports: boolean;
    readonly chosen: { readonly types: Readonly<Record<string, string>>; readonly scale: 'linear' | 'log' | undefined; readonly aggregation: AggregateSpec | null | undefined; readonly compare: { readonly mode: string } | null | undefined };
  };
  readonly choose: (c: MenuChoice) => void;
}

/** A top item: a submenu of groups, or (`act`) an action chosen at once. */
type Entry = { readonly item: MenuItem; readonly label: string; readonly groups: readonly { readonly label: string | null; readonly radios: readonly Radio[] }[]; readonly act?: MenuChoice };

/** What the menu offers (menu.md 2–5): the app's items that the data and the modules allow. */
function entriesOf(st: ReturnType<MenuHooks['state']>): Entry[] {
  const { model, source: src, words, chosen } = st;
  if (!model || !src || !model.menu) return [];
  const items = model.menu.items;
  // Export and printing suit every chart, polar ones too (menu.md 9).
  const e = words.exporting;
  const outputs: Entry[] = [
    ...(items.includes('export') && st.exports ? [{ item: 'export' as const, label: e.download, groups: [{ label: null, radios: (['png', 'svg', 'csv'] as const).map((f) => ({ label: e[f], checked: null, choice: { kind: 'export' as const, value: f } })) }] }] : []),
    ...(items.includes('print') && st.exports ? [{ item: 'print' as const, label: e.print, groups: [], act: { kind: 'print' as const, value: null } }] : []),
  ];
  if (model.system !== 'cartesian') return outputs;
  const w = words.menu;
  const out: Entry[] = [];
  const kinds = ['line', 'area', 'column'].filter((t) => st.typeNames.includes(t));
  if (items.includes('type') && kinds.length > 1)
    out.push({ item: 'type', label: w.type, groups: src.series.filter((s) => kinds.includes(s.type)).map((s) => ({ label: seriesName(s, words), radios: kinds.map((t) => ({ label: w.types[t] ?? t, checked: s.type === t, choice: { kind: 'type' as const, seriesId: s.id, value: t } })) })) });
  const x = src.xAxes[0];
  const current = chosen.aggregation !== undefined ? chosen.aggregation : (x?.aggregate ?? null);
  if (items.includes('aggregation') && st.aggregates && x?.scale === 'time') {
    const periods = ['hour', 'day', 'week', 'month', 'quarter', 'year'] as const;
    out.push({ item: 'aggregation', label: w.aggregation, groups: [{ label: null, radios: [{ label: w.none, checked: !current, choice: { kind: 'aggregation', value: null } }, ...periods.map((p) => ({ label: w.periods[p], checked: !!current && 'period' in current && current.period === p, choice: { kind: 'aggregation' as const, value: p } }))] }] });
  }
  // Log only when every value can be on it (menu.md 4).
  const positive = src.series.every((s) => !s.columns.y.some((v) => v <= 0));
  if (items.includes('scale') && positive && src.yAxes[0]?.stacking === null) {
    const log = (chosen.scale ?? src.yAxes[0]?.scale) === 'log';
    out.push({ item: 'scale', label: w.scale, groups: [{ label: null, radios: [{ label: w.linear, checked: !log, choice: { kind: 'scale', value: 'linear' } }, { label: w.log, checked: log, choice: { kind: 'scale', value: 'log' } }] }] });
  }
  if (items.includes('compare') && st.compares) {
    const mode = (chosen.compare !== undefined ? chosen.compare : (src.yAxes[0]?.compare ?? null))?.mode ?? null;
    out.push({ item: 'compare', label: w.compare, groups: [{ label: null, radios: [{ label: w.none, checked: mode === null, choice: { kind: 'compare', value: null } }, ...(['value', 'percent', 'index'] as const).map((k) => ({ label: w.compares[k], checked: mode === k, choice: { kind: 'compare' as const, value: k } }))] }] });
  }
  return [...out, ...outputs];
}

/** Between the button and the chart's edges. */
const INSET = 8;

export class MenuPart {
  readonly button = document.createElement('button');
  private readonly top = document.createElement('div');
  private sub: HTMLDivElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly hooks: MenuHooks,
  ) {
    const b = this.button;
    b.type = 'button';
    b.className = 'dzgraph-menu-button';
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    // Three dots, drawn: the button's name is its label (menu.md 1).
    const NS = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(NS, 'svg');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('aria-hidden', 'true');
    for (const cx of [3, 8, 13]) {
      const dot = document.createElementNS(NS, 'circle');
      for (const [k, v] of Object.entries({ cx, cy: 8, r: 1.6, fill: 'currentColor' })) dot.setAttribute(k, String(v));
      icon.appendChild(dot);
    }
    b.appendChild(icon);
    Object.assign(b.style, { position: 'absolute', zIndex: '3' });
    b.addEventListener('click', () => (this.isOpen() ? this.close(true) : this.open()));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
    });
    this.top.className = 'dzgraph-menu';
    this.top.setAttribute('role', 'menu');
    this.top.hidden = true;
    Object.assign(this.top.style, { position: 'absolute', zIndex: '3' });
    this.top.addEventListener('keydown', this.onKey);
    root.append(b, this.top);
  }

  /** After each layout: shown when something is offered, at the end of the chart's top edge. */
  place(width: number, dir: 'ltr' | 'rtl'): void {
    const label = this.hooks.state().words.menu.button;
    this.button.setAttribute('aria-label', label);
    this.top.setAttribute('aria-label', label);
    this.button.hidden = this.entries().length === 0;
    if (this.button.hidden) this.close(false);
    this.button.style.insetBlockStart = `${INSET / 2}px`;
    this.button.style.insetInlineEnd = `${INSET / 2}px`;
    this.top.style.insetBlockStart = `${INSET / 2 + 28}px`;
    this.top.style.insetInlineEnd = `${INSET / 2}px`;
    void width;
    void dir;
  }

  private entries(): Entry[] {
    return entriesOf(this.hooks.state());
  }

  private isOpen(): boolean {
    return !this.top.hidden;
  }

  private open(): void {
    const items = this.entries().map((e) => {
      const el = document.createElement('div');
      el.setAttribute('role', 'menuitem');
      el.tabIndex = -1;
      el.textContent = e.label;
      el.dataset['item'] = e.item;
      const act = e.act;
      if (act) el.addEventListener('click', () => this.choose(act));
      else {
        el.setAttribute('aria-haspopup', 'menu');
        el.setAttribute('aria-expanded', 'false');
        el.addEventListener('click', () => this.openSub(el));
      }
      return el;
    });
    this.top.replaceChildren(...items);
    this.top.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    // A press anywhere else closes it (review 9).
    document.addEventListener('pointerdown', this.onOutside, true);
    items[0]?.focus();
  }

  private readonly onOutside = (e: Event) => {
    const t = e.target as Node | null;
    if (t && (this.top.contains(t) || this.button.contains(t))) return;
    this.close(false);
  };

  /** A submenu beside its item: radio items, grouped by series for types. */
  private openSub(item: HTMLElement): void {
    this.closeSub();
    const entry = this.entries().find((e) => e.item === item.dataset['item']);
    // An action (Print) has no submenu (review 2).
    if (!entry || entry.act) return;
    const sub = document.createElement('div');
    sub.className = 'dzgraph-menu dzgraph-submenu';
    sub.setAttribute('role', 'menu');
    sub.setAttribute('aria-label', entry.label);
    const radios: HTMLElement[] = [];
    for (const g of entry.groups) {
      const parent = g.label ? document.createElement('div') : sub;
      if (g.label) {
        parent.setAttribute('role', 'group');
        parent.setAttribute('aria-label', g.label);
        const title = document.createElement('div');
        title.className = 'dzgraph-menu-group';
        title.setAttribute('aria-hidden', 'true');
        title.textContent = g.label;
        parent.appendChild(title);
        sub.appendChild(parent);
      }
      for (const r of g.radios) {
        const el = document.createElement('div');
        el.setAttribute('role', r.checked === null ? 'menuitem' : 'menuitemradio');
        if (r.checked !== null) el.setAttribute('aria-checked', String(r.checked));
        el.tabIndex = -1;
        el.textContent = r.label;
        el.addEventListener('click', () => this.choose(r.choice));
        parent.appendChild(el);
        radios.push(el);
      }
    }
    item.setAttribute('aria-expanded', 'true');
    item.after(sub);
    this.sub = sub;
    radios[0]?.focus();
  }

  /** A choice made: the menu closes, the focus back on its button, then the choice applies (printing may take it). */
  private choose(c: MenuChoice): void {
    this.close(true);
    this.hooks.choose(c);
  }

  private closeSub(): HTMLElement | null {
    if (!this.sub) return null;
    const item = this.sub.previousElementSibling as HTMLElement | null;
    item?.setAttribute('aria-expanded', 'false');
    this.sub.remove();
    this.sub = null;
    return item;
  }

  private close(refocus: boolean): void {
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.closeSub();
    this.top.hidden = true;
    this.top.replaceChildren();
    this.button.setAttribute('aria-expanded', 'false');
    if (refocus) this.button.focus();
  }

  private readonly onKey = (e: KeyboardEvent) => {
    const at = document.activeElement as HTMLElement | null;
    if (!at) return;
    const inSub = !!this.sub?.contains(at);
    const list = [...(inSub ? this.sub!.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]') : this.top.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]'))];
    const i = list.indexOf(at);
    const rtl = getComputedStyle(this.top).direction === 'rtl';
    // Into a submenu toward the reading direction's end, out of it toward its start (an arrow along the screen).
    const along = screenStep(e.key, true) * (rtl ? -1 : 1);
    let handled = true;
    if (e.key === 'ArrowDown') list[(i + 1) % list.length]?.focus();
    else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]?.focus();
    else if (e.key === 'Home') list[0]?.focus();
    else if (e.key === 'End') list.at(-1)?.focus();
    else if (!inSub && (e.key === 'Enter' || e.key === ' ') && !at.hasAttribute('aria-haspopup')) at.click();
    else if (!inSub && (along === 1 || e.key === 'Enter' || e.key === ' ')) this.openSub(at);
    else if (inSub && (e.key === 'Enter' || e.key === ' ')) at.click();
    else if (inSub && (along === -1 || e.key === 'Escape')) this.closeSub()?.focus();
    else if (e.key === 'Escape') this.close(true);
    else if (e.key === 'Tab') {
      this.close(false);
      handled = false;
    } else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  destroy(): void {
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.button.remove();
    this.top.remove();
  }
}
