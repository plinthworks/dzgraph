/**
 * The data as CSV (csv.md): the data table's columns and rows (`tableOf`), all of them, values raw. RFC 4180 by
 * default; the language's separators on demand; a text cell a spreadsheet would run as a formula neutralised. Reached
 * only through the `exporting` module, so an app without it ships none of this.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { View } from './view.js';
import { tableOf, type RawTable, type TableText } from './a11y.js';
import { daysFromCivil, wallOf } from './time.js';

export interface CsvOptions {
  /** The x column's header: the x axis's title, else the DOM's word for it (csv.md 3). */
  readonly xHeader: string;
  /** The chart's language, for `local`. */
  readonly locale: string | undefined;
  /** Semicolons and a decimal comma when the language writes decimals with a comma (csv.md 7). */
  readonly local: boolean;
}

const DAY_MS = 86_400_000;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/**
 * An instant as ISO 8601 on the zone's wall clock, with its offset (`2026-03-08T02:00:00+01:00`); milliseconds only
 * when there are some; `day`: the date alone. A year outside 0–9999 is signed on six digits (ISO's expanded form).
 */
export function isoOf(ms: number, zone: string, day: boolean): string {
  const w = wallOf(ms, zone);
  const year = w.y >= 0 && w.y <= 9999 ? pad(w.y, 4) : `${w.y < 0 ? '-' : '+'}${pad(Math.abs(w.y), 6)}`;
  const date = `${year}-${pad(w.mo)}-${pad(w.d)}`;
  if (day) return date;
  // The offset: the wall clock read as if it were UTC, less the instant.
  const wall = daysFromCivil(w.y, w.mo, w.d) * DAY_MS + w.h * 3_600_000 + w.mi * 60_000 + w.s * 1000 + w.ms;
  const off = Math.round((wall - ms) / 60_000);
  const sign = off < 0 ? '-' : '+';
  const time = `${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}${w.ms ? `.${pad(w.ms, 3)}` : ''}`;
  return `${date}T${time}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** What a spreadsheet would run as a formula (csv.md 8). */
const FORMULA = /^[=+\-@\t\r]/;

export function csvOf(model: ChartModel, layout: ChartLayout, view: View | undefined, text: TableText, which: 'visible' | 'all', opts: CsvOptions): string {
  const t = tableOf(model, layout, view, text, which);
  const comma = opts.local && new Intl.NumberFormat(opts.locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value === ',';
  const sep = comma ? ';' : ',';
  const words = (v: string) => {
    const safe = FORMULA.test(v) ? `'${v}` : v;
    return safe.includes(sep) || safe.includes('"') || safe.includes('\n') || safe.includes('\r') ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  // Raw, never formatted: no grouping, `-0` as 0, the language's decimal mark only when asked.
  const number = (v: number) => {
    const s = String(v === 0 ? 0 : v);
    return comma ? s.replace('.', ',') : s;
  };
  const xCell = xCellOf(model, layout, t);
  const lines = [[words(opts.xHeader), ...t.columns.map((c) => words(c.name))]];
  for (const r of t.rows) lines.push([xCell(r), ...r.cells.map((v) => (v === null ? '' : typeof v === 'string' ? words(v) : number(v)))]);
  return `\uFEFF${lines.map((l) => l.join(sep)).join('\r\n')}\r\n`;

  /** How a row's x is written (csv.md 5): a name as text, a time as ISO, a number raw. */
  function xCellOf(m: ChartModel, l: ChartLayout, table: RawTable): (r: RawTable['rows'][number]) => string {
    const byId = new Map(m.series.map((s) => [s.id, s]));
    // Days alone when every time written is a midnight in its axis's zone.
    const timeOf = (r: RawTable['rows'][number]) => {
      const axis = m.xAxes.find((a) => a.id === byId.get(r.from.seriesId)!.xAxis);
      return axis?.scale === 'time' ? (axis.zone ?? 'UTC') : null;
    };
    const days = table.rows.every((r) => {
      const zone = timeOf(r);
      if (zone === null) return true;
      const w = wallOf(r.x, zone);
      return w.h === 0 && w.mi === 0 && w.s === 0 && w.ms === 0;
    });
    return (r) => {
      const placed = l.placements.get(r.from.seriesId);
      if (placed) return words(placed.name(r.from.index));
      const s = byId.get(r.from.seriesId)!;
      const name = s.names?.[r.from.index];
      if (name) return words(name);
      const axis = m.xAxes.find((a) => a.id === s.xAxis);
      if (axis?.scale === 'category') return words(axis.categories?.[Math.round(r.x)] ?? String(r.x));
      const zone = timeOf(r);
      return zone === null ? number(r.x) : isoOf(r.x, zone, days);
    };
  }
}
