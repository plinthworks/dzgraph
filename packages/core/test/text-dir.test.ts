// A label in the other direction keeps its own (direction.md 6): its first strong letter decides, its anchor turned so
// it stays where the layout put it. Phase 8b (the sheet audit found the rule untested and not kept). By hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, Scene, TextMeasurer, TextPrimitive } from '@dzgraph/core';
import { line, pie } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { textDir } from '../src/dir.js';

const types = [line, pie];
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
function scene(options: unknown, dir: 'ltr' | 'rtl'): Scene {
  const { model } = normalize(options, types);
  const l = layout({ model, types, width: 600, height: 400, dir, measureText, text, locale: 'en-US' });
  return composeScene({ model, types, layout: l, measureText });
}
const texts = (s: Scene) => s.layers.flatMap((l) => l.groups.flatMap((g) => g.items)).filter((p): p is TextPrimitive => p.kind === 'text');
const find = (s: Scene, t: string) => texts(s).find((p) => p.text === t)!;
/** « Sales » in Arabic, written as escapes. */
const SALES_AR = 'مبيعات';

describe('a label\'s own direction (direction.md 6)', () => {
  it('the first strong letter decides; no strong letter: the chart\'s', () => {
    expect(textDir('Sales (2026)', 'rtl')).toBe('ltr');
    expect(textDir(`${SALES_AR} 2026`, 'ltr')).toBe('rtl');
    expect(textDir('(2026) Sales', 'rtl')).toBe('ltr');
    expect(textDir('1 234,5 %', 'rtl')).toBe('rtl');
    expect(textDir('', 'ltr')).toBe('ltr');
  });

  it('a Latin series name in a right-to-left legend: left to right, at the same place', () => {
    const rtl = scene({ series: [{ type: 'line', name: 'Sales (2026)', data: [1, 2, 3] }, { type: 'line', name: 'Costs', data: [2, 1, 2] }] }, 'rtl');
    const label = find(rtl, 'Sales (2026)');
    expect(label.dir).toBe('ltr');
    // The layout placed it by its start in right to left (its right edge at x): left to right, that edge is its end.
    expect(label.anchor).toBe('end');
    // A number keeps the chart's direction, as the locale wrote it (direction.md 5).
    expect(texts(rtl).filter((p) => p.font === 'tick-label').map((p) => p.dir)).not.toContain('ltr');
  });

  it('an Arabic title in a left-to-right chart: right to left; a number keeps the chart\'s direction', () => {
    const ltr = scene({ title: { text: SALES_AR }, series: [{ type: 'line', data: [1, 2, 3] }] }, 'ltr');
    const title = find(ltr, SALES_AR);
    expect([title.dir, title.anchor]).toEqual(['rtl', 'end']);
    const tick = texts(ltr).find((p) => p.font === 'tick-label' && /^[\d.,]+$/.test(p.text))!;
    expect(tick.dir).toBe('ltr');
  });

  it('a pie slice\'s label too', () => {
    const rtl = scene({ series: [{ type: 'pie', data: [['Apples (made up)', 3], ['Pears', 2]] }] }, 'rtl');
    expect(texts(rtl).filter((p) => p.text.startsWith('Apples')).every((p) => p.dir === 'ltr')).toBe(true);
  });
});
