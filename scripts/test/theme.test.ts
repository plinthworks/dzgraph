// The theme (step 1.9): the compiled CSS matches its source, and the palette's contrasts hold in both modes (CLAUDE.md:
// text 4.5:1, marks 3:1, on the chart's surface). Contrast by WCAG 2.2's relative luminance formula.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './files.js';
// @ts-expect-error a plain .mjs script without declarations
import { compile } from '../build-theme.mjs';

const scss = readFileSync(join(ROOT, 'packages/theme/dzgraph.scss'), 'utf8');

/** The (light, dark) pairs of a palette map in the SCSS. */
function pairs(name: string): Record<string, [string, string]> {
  const start = scss.indexOf(`$${name}: (`);
  const block = scss.slice(start, scss.indexOf(') !default;', start));
  const out: Record<string, [string, string]> = {};
  for (const m of block.matchAll(/([a-z0-9-]+): \((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/g)) out[m[1]!] = [m[2]!, m[3]!];
  return out;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('theme', () => {
  it('the contrast formula, on known pairs', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('the compiled CSS matches its source (npm run build:theme)', () => {
    expect(readFileSync(join(ROOT, 'packages/theme/dzgraph.css'), 'utf8')).toBe(compile(true));
    expect(readFileSync(join(ROOT, 'packages/theme/dzgraph.unlayered.css'), 'utf8')).toBe(compile(false));
  });

  const tz = pairs('tz-palette');
  const series = pairs('dzgraph-palette');

  it('eight series colours, in order', () => {
    expect(Object.keys(series)).toEqual(['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8']);
  });

  for (const [mode, i] of [['light', 0], ['dark', 1]] as const) {
    it(`${mode}: text 4.5:1 on the surface`, () => {
      const bg = tz['bg']![i];
      for (const t of ['fg', 'fg-muted']) expect(contrast(tz[t]![i], bg), t).toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: every series 3:1 on the surface`, () => {
      const bg = tz['bg']![i];
      for (const [name, c] of Object.entries(series)) expect(contrast(c[i], bg), name).toBeGreaterThanOrEqual(3);
    });
  }
});
