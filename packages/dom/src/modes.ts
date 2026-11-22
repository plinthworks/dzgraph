/**
 * The mode bar (modes.md): what a drag across the plot does — zoom, select or measure. A row of HTML toggle buttons
 * in one tab stop (`role="toolbar"`, arrows between them), at the start of the plot's top edge. It comes with the
 * modules that add a mode (measure, selection), never with zoom alone, and shows only with two modes or more.
 */
import { screenStep, type SelectShape } from '@dzgraph/core/internal';

export type Mode = 'zoom' | 'selection' | 'measure';

export interface ModeBarHooks {
  /** The modes the chart has, in order, and their names in the reader's words. */
  readonly modes: () => readonly { readonly mode: Mode; readonly name: string }[];
  readonly current: () => Mode;
  readonly choose: (mode: Mode) => void;
  /** In selection mode with more than one shape offered: the shapes, the current one, and choosing (selection.md 1). */
  readonly shapes: () => readonly { readonly shape: SelectShape; readonly name: string }[];
  readonly shape: () => SelectShape;
  readonly chooseShape: (shape: SelectShape) => void;
}

/** Between the bar and the plot's edges. */
const INSET = 8;

export class ModeBar {
  private readonly box = document.createElement('div');
  private buttons: HTMLButtonElement[] = [];
  private act = new Map<string, () => void>();

  constructor(
    root: HTMLElement,
    private readonly hooks: ModeBarHooks,
  ) {
    const box = this.box;
    box.className = 'dzgraph-modes';
    box.setAttribute('role', 'toolbar');
    box.hidden = true;
    Object.assign(box.style, { position: 'absolute', zIndex: '2', display: 'flex', gap: '2px' });
    box.addEventListener('keydown', this.onKey);
    root.appendChild(box);
  }

  /** After each layout: its buttons, their state, its place. */
  place(plot: { readonly x: number; readonly y: number; readonly width: number }, width: number, dir: 'ltr' | 'rtl', label: string): void {
    const modes = this.hooks.modes();
    const current = this.hooks.current();
    // The shapes follow the modes, in the same row, while selecting with a choice of shapes (selection.md 1).
    const shapes = current === 'selection' ? this.hooks.shapes() : [];
    const entries = [...modes.map((m) => ({ key: `mode:${m.mode}`, name: m.name, on: m.mode === current, act: () => this.hooks.choose(m.mode) })), ...(shapes.length > 1 ? shapes.map((x) => ({ key: `shape:${x.shape}`, name: x.name, on: x.shape === this.hooks.shape(), act: () => this.hooks.chooseShape(x.shape) })) : [])];
    const box = this.box;
    box.hidden = modes.length < 2 && shapes.length < 2;
    if (box.hidden) return;
    box.setAttribute('aria-label', label);
    if (this.buttons.length !== entries.length || this.buttons.some((b, i) => b.dataset['key'] !== entries[i]!.key)) {
      this.buttons = entries.map((x) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset['key'] = x.key;
        b.dataset['mode'] = x.key.startsWith('mode:') ? x.key.slice(5) : '';
        b.addEventListener('click', () => this.act.get(x.key)?.());
        return b;
      });
      box.replaceChildren(...this.buttons);
    }
    this.act = new Map(entries.map((x) => [x.key, x.act]));
    // One tab stop: the pressed mode (modes.md 3); the focus kept where it is when the row is rebuilt.
    const focused = this.buttons.indexOf(document.activeElement as HTMLButtonElement);
    this.buttons.forEach((b, i) => {
      b.textContent = entries[i]!.name;
      b.setAttribute('aria-pressed', String(entries[i]!.on));
      b.tabIndex = (focused === -1 ? entries[i]!.on && entries[i]!.key.startsWith('mode:') : i === focused) ? 0 : -1;
    });
    box.style.insetBlockStart = `${plot.y + INSET}px`;
    box.style.insetInlineStart = `${dir === 'rtl' ? width - plot.x - plot.width + INSET : plot.x + INSET}px`;
  }

  private readonly onKey = (e: KeyboardEvent) => {
    const i = this.buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    const rtl = getComputedStyle(this.box).direction === 'rtl';
    // An arrow moves along the screen (navigate.ts); the row runs the other way in RTL.
    const step = e.key === 'Home' ? -i : e.key === 'End' ? this.buttons.length - 1 - i : screenStep(e.key, true) * (rtl ? -1 : 1);
    if (!step) return;
    e.preventDefault();
    const next = this.buttons[(i + step + this.buttons.length) % this.buttons.length]!;
    this.buttons.forEach((b) => (b.tabIndex = b === next ? 0 : -1));
    next.focus();
  };

  destroy(): void {
    this.box.remove();
  }
}
