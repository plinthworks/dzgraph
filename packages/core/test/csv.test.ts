// The data as CSV (csv.md): the table's columns and rows, raw values, RFC 4180 or the language's separators, formula
// injection neutralised. Phase 6 step 3. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { layout } from '../src/layout.js';
import { csvOf, isoOf } from '../src/csv.js';
import { daysFromCivil } from '../src/time.js';
import { normalizeFull as normalize } from './helpers/kit.js';
import type { View } from '../src/view.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…', share: 'Share', selectedColumn: 'Selected', compared: (n: string) => `${n} (compared)` };
const BOM = '﻿';

function csv(options: object, opts: { view?: View; which?: 'visible' | 'all'; locale?: string; local?: boolean } = {}) {
  const { model } = normalize(options, allTypes);
  const locale = opts.locale ?? 'en-US';
  const l = layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale, ...(opts.view ? { view: opts.view } : {}) });
  return csvOf(model, l, opts.view, text, opts.which ?? 'visible', { xHeader: 'x', locale, local: opts.local ?? false });
}

describe('the table as CSV (csv.md 1–4, 6)', () => {
  it('a header, then a row per x, values raw, a gap empty, a name with a comma quoted, CRLF and a BOM', () => {
    const out = csv({ series: [{ type: 'line', id: 'a', name: 'Sales, net', data: [10, 20.5, null, 1234567.25] }] });
    expect(out).toBe(`${BOM}x,"Sales, net"\r\n0,10\r\n1,20.5\r\n2,\r\n3,1234567.25\r\n`);
  });

  it('a quote doubled, a line break quoted; the unnamed series by its place', () => {
    const out = csv({ series: [{ type: 'line', id: 'a', name: 'The "big" one\nsecond line', data: [1] }, { type: 'line', id: 'b', data: [2] }] });
    expect(out).toBe(`${BOM}x,"The ""big"" one\nsecond line",Series 2\r\n0,1,2\r\n`);
  });

  it('a hidden series is not in it (csv.md 1)', () => {
    const view: View = { hidden: new Set(['b']) };
    expect(csv({ series: [{ type: 'line', id: 'a', data: [1, 2] }, { type: 'line', id: 'b', data: [3, 4] }] }, { view })).toBe(`${BOM}x,Series 1\r\n0,1\r\n1,2\r\n`);
  });

  it('categories by name; no row limit (csv.md 2)', () => {
    expect(csv({ xAxis: { scale: 'category', categories: ['North', 'South'] }, series: [{ type: 'column', id: 'a', data: [5, -3] }] })).toBe(`${BOM}x,Series 1\r\nNorth,5\r\nSouth,-3\r\n`);
    const long = csv({ series: [{ type: 'line', id: 'a', data: Array.from({ length: 1500 }, (_, i) => i) }] });
    const lines = long.split('\r\n');
    // The header, 1 500 rows, and the empty string after the last CRLF.
    expect([lines.length, lines[1500]]).toEqual([1502, '1499,1499']);
  });

  it('the visible range, or all of it as the table was switched (csv.md 2, D.23)', () => {
    const options = { series: [{ type: 'line', id: 'a', data: [10, 20, 30, 40] }] };
    const view: View = { range: { x: { min: 1, max: 2 } } };
    expect(csv(options, { view })).toBe(`${BOM}x,Series 1\r\n1,20\r\n2,30\r\n`);
    expect(csv(options, { view, which: 'all' })).toBe(`${BOM}x,Series 1\r\n0,10\r\n1,20\r\n2,30\r\n3,40\r\n`);
  });

  it('no rows: the header alone (csv.md 9)', () => {
    expect(csv({ series: [{ type: 'line', id: 'a', name: 'A', data: [] }] })).toBe(`${BOM}x,A\r\n`);
  });

  it('a compared series: its raw values, then its compared ones, raw (csv.md 1)', () => {
    const out = csv({ yAxis: { compare: 'percent' }, series: [{ type: 'line', id: 'a', name: 'A', data: [10, 20, 5] }] });
    // Percent from 10: 0, 100, -50.
    expect(out).toBe(`${BOM}x,A,A (compared)\r\n0,10,0\r\n1,20,100\r\n2,5,-50\r\n`);
  });

  it('the selection marked 1 (csv.md 1)', () => {
    const view: View = { selection: new Map([['a', Uint8Array.from([0, 1, 0])]]) };
    expect(csv({ series: [{ type: 'line', id: 'a', name: 'A', data: [1, 2, 3] }] }, { view })).toBe(`${BOM}x,A,Selected\r\n0,1,\r\n1,2,1\r\n2,3,\r\n`);
  });

  it('a pie: each slice by name, its value and its share as a fraction (csv.md 10)', () => {
    const out = csv({ series: [{ type: 'pie', id: 'p', name: 'P', data: [['Tea', 1], ['Milk', 3]] }] });
    expect(out).toBe(`${BOM}x,P,Share\r\nTea,1,0.25\r\nMilk,3,0.75\r\n`);
  });
});

describe('the language\'s separators (csv.md 7)', () => {
  it('French: semicolons and a decimal comma; a comma in a name needs no quotes then', () => {
    const options = { series: [{ type: 'line', id: 'a', name: 'Ventes, nettes', data: [10, 20.5] }] };
    expect(csv(options, { locale: 'fr-FR', local: true })).toBe(`${BOM}x;Ventes, nettes\r\n0;10\r\n1;20,5\r\n`);
  });

  it('a language writing a decimal point keeps the universal form; without the option, French too', () => {
    const options = { series: [{ type: 'line', id: 'a', name: 'A', data: [20.5] }] };
    expect(csv(options, { locale: 'en-GB', local: true })).toBe(`${BOM}x,A\r\n0,20.5\r\n`);
    expect(csv(options, { locale: 'fr-FR' })).toBe(`${BOM}x,A\r\n0,20.5\r\n`);
  });
});

describe('formula injection (csv.md 8)', () => {
  it('a text cell starting with = + - @ tab or return is written after an apostrophe; numbers never', () => {
    const out = csv({ xAxis: { scale: 'category', categories: ['=SUM(A1)', '+1', '-x', '@a', '\tb', 'ok'] }, series: [{ type: 'column', id: 'a', name: '=cmd', data: [1, -2, 3, 4, 5, 6] }] });
    expect(out).toBe(`${BOM}x,'=cmd\r\n'=SUM(A1),1\r\n'+1,-2\r\n'-x,3\r\n'@a,4\r\n'\tb,5\r\nok,6\r\n`);
  });
});

describe('times (csv.md 5)', () => {
  it('ISO date-times with the zone\'s offset, across a change of hour', () => {
    const out = csv({ xAxis: { scale: 'time', zone: 'Europe/Paris' }, series: [{ type: 'line', id: 'a', name: 'A', data: [['2026-03-08T01:00:00Z', 1], ['2026-03-29T01:30:00Z', 2]] }] });
    expect(out).toBe(`${BOM}x,A\r\n2026-03-08T02:00:00+01:00,1\r\n2026-03-29T03:30:00+02:00,2\r\n`);
  });

  it('days alone when every time is a midnight in the zone', () => {
    const out = csv({ xAxis: { scale: 'time', zone: 'Europe/Paris' }, series: [{ type: 'line', id: 'a', name: 'A', data: [['2026-03-08', 1], ['2026-03-09', 2]] }] });
    expect(out).toBe(`${BOM}x,A\r\n2026-03-08,1\r\n2026-03-09,2\r\n`);
  });

  it('isoOf: milliseconds when there are some, UTC as +00:00, a far year signed on six digits', () => {
    expect(isoOf(Date.UTC(2026, 0, 2, 3, 4, 5, 6), 'UTC', false)).toBe('2026-01-02T03:04:05.006+00:00');
    expect(isoOf(Date.UTC(2026, 0, 2), 'Asia/Kolkata', false)).toBe('2026-01-02T05:30:00+05:30');
    expect(isoOf(Date.UTC(2026, 0, 2), 'America/Los_Angeles', false)).toBe('2026-01-01T16:00:00-08:00');
    expect(isoOf(Date.UTC(12026, 0, 2), 'UTC', true)).toBe('+012026-01-02');
  });

  it('review 3: years 0 and before, astronomical (1 BC is year 0), signed below 0', () => {
    const day = (y: number) => daysFromCivil(y, 3, 4) * 86_400_000;
    expect([isoOf(day(0), 'UTC', true), isoOf(day(-1), 'UTC', true), isoOf(day(-1), 'UTC', false)]).toEqual(['0000-03-04', '-000001-03-04', '-000001-03-04T00:00:00+00:00']);
  });

  it('review 4: a fraction of a millisecond is dropped, not written', () => {
    expect(isoOf(1500.5, 'UTC', false)).toBe('1970-01-01T00:00:01.500+00:00');
  });
});
