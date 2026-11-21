/**
 * The one module that writes a colour as CSS (CLAUDE.md: colours only as variables): a token becomes
 * `var(--dzgraph-<token>)`, a mix of two tokens `color-mix()` of their variables. Exports and standalone SVG pass a
 * `resolve` that turns a token into the theme's value.
 */
import type { ColorRef, ColorToken } from './scene.js';

export type ResolveColor = (token: ColorToken) => string;

export function cssColor(ref: ColorRef, resolve?: ResolveColor): string {
  const one = (t: ColorToken) => (resolve ? resolve(t) : `var(--dzgraph-${t})`);
  if (typeof ref === 'string') return one(ref);
  const [a, b, amount] = ref.mix;
  const pct = Math.round(Math.min(1, Math.max(0, amount)) * 1000) / 10;
  return `color-mix(in oklab, ${one(a)}, ${one(b)} ${pct}%)`;
}
