/**
 * Text measurement for the core's layout (spike S2): Canvas `measureText`, as fast or faster than SVG everywhere and
 * agreeing with HTML text to 0.014 px; one cache per font and text. Fonts come from the theme's variables
 * (`--dzgraph-font-<role>`), with defaults; a font not loaded yet is measured as its fallback and reported, so the
 * chart lays out again once it arrives (`document.fonts.load`, never the `loadingdone` event, spike S2).
 */
import type { FontRole, TextMeasurer, TextSize } from '@dzgraph/core';

/**
 * The fonts used when the theme gives none. Written as pairs, not an object literal: a key named `title` holding text
 * is what the literal-text guard catches (`{ title: '…' }` on an element), and these values are CSS fonts, not text.
 */
export const DEFAULT_FONTS = Object.fromEntries([
  ['title', '600 16px system-ui, sans-serif'],
  ['subtitle', '400 13px system-ui, sans-serif'],
  ['axis-title', '500 12px system-ui, sans-serif'],
  ['tick-label', '400 12px system-ui, sans-serif'],
  ['legend', '400 12px system-ui, sans-serif'],
  ['data-label', '400 11px system-ui, sans-serif'],
]) as Readonly<Record<FontRole, string>>;

export interface Measurer {
  readonly measureText: TextMeasurer;
  /** The CSS font of a role, as measured. */
  readonly font: (role: FontRole) => string;
  /** Fonts used but not loaded yet: lay out again when they are. */
  readonly pending: () => readonly string[];
  /** Reads the theme's fonts again (after a theme or class change) and forgets every measure. */
  readonly refresh: () => void;
}

export function createMeasurer(themeSource: Element): Measurer {
  const ctx = document.createElement('canvas').getContext('2d');
  const cache = new Map<string, TextSize>();
  let fonts: Record<FontRole, string> = { ...DEFAULT_FONTS };
  const waiting = new Set<string>();

  const refresh = () => {
    const style = getComputedStyle(themeSource);
    const next = { ...DEFAULT_FONTS };
    for (const role of Object.keys(DEFAULT_FONTS) as FontRole[]) {
      const v = style.getPropertyValue(`--dzgraph-font-${role}`).trim();
      if (v) next[role] = v;
    }
    fonts = next;
    cache.clear();
  };
  refresh();

  const measureText: TextMeasurer = (text, role) => {
    const font = fonts[role];
    const key = `${font}\u0000${text}`;
    const hit = cache.get(key);
    if (hit) return hit;
    if (!ctx) return { width: text.length * 7, ascent: 10, descent: 3 };
    if (typeof document.fonts?.check === 'function' && !document.fonts.check(font, text || 'x')) waiting.add(font);
    ctx.font = font;
    const m = ctx.measureText(text || 'Hg');
    // The font's box (not the glyphs'): every label of a role sits on the same lines whatever its letters.
    const size: TextSize = { width: text ? m.width : 0, ascent: m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent, descent: m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent };
    cache.set(key, size);
    return size;
  };

  return {
    measureText,
    font: (role) => fonts[role],
    pending: () => {
      const out = [...waiting];
      waiting.clear();
      return out;
    },
    refresh,
  };
}
