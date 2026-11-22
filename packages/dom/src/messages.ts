/**
 * The words a chart writes (CLAUDE.md: sentences belong to the DOM layer's translated messages). English and French
 * ship; an app gives others, or overrides some, through `chart()`'s setup.
 */
import type { Summary } from '@dzgraph/core/internal';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';

/** A point's label parts, its numbers already written in the reader's locale. */
export interface PointWords {
  readonly series: string;
  readonly x: string;
  readonly y: string;
  /** A stacked point's share of its pile and the pile's total (stacking.md 16). */
  readonly share?: string;
  readonly total?: string;
  /** A gauge's bounds and threshold, written (gauge.md 9). */
  readonly meter?: { readonly min: string; readonly max: string; readonly threshold?: string };
  readonly position: string;
  readonly count: string;
}

export interface Messages {
  /** A series without a name, by its place (from 1). */
  readonly seriesName: (place: number) => string;
  /** The plot of a chart without data. */
  readonly noData: string;
  /** What ends a text cut short. */
  readonly ellipsis: string;
  /** Announced when the user hides or shows a series (screen-reader.md 5). */
  readonly seriesHidden: (name: string) => string;
  readonly seriesShown: (name: string) => string;
  /** The chart's name when it has no title nor description. */
  readonly chart: string;
  /** The generated summary (screen-reader.md 1). */
  readonly summary: (s: Summary) => string;
  /** A series' list (screen-reader.md 2): « Pommes, 12 points ». */
  readonly seriesList: (name: string, count: string) => string;
  /** A point (screen-reader.md 2): « Pommes, mars : 160. Point 3 sur 12. ». */
  readonly point: (p: PointWords) => string;
  /** The tooltip's last row under a pile (stacking.md 14). */
  readonly total: string;
  /** The data table's column of a pile's total: the default pile's (null), or a named one's (stacking.md 17). */
  readonly stackTotal: (stack: string | null) => string;
  /** A series' header in the data table with its value axis, when two are in use (combined.md 10). */
  readonly seriesOnAxis: (name: string, axis: string) => string;
  /** A slice without a name, by its place (pie-donut.md 1); the slice of the smallest ones (pie-donut.md 7). */
  readonly pointName: (place: number) => string;
  readonly others: string;
  /** The data table's share column (pie-donut.md 15). */
  readonly share: string;
  /** The tooltip's last line under « Autres » past ten slices (pie-donut.md 8). */
  readonly moreSlices: (count: string) => string;
  /** A slice's label (pie-donut.md 9) and a gauge's note in its tooltip (gauge.md 7). */
  readonly sliceLabel: (name: string, share: string) => string;
  readonly gaugeNote: (min: string, max: string, threshold: string | undefined) => string;
  /** A gauge's columns in the data table (gauge.md 10). */
  readonly meter: { readonly min: string; readonly max: string; readonly threshold: string };
  /** The data table's caption when the chart has no title, and its last row past 1 000 (data-table.md 1, 4). */
  readonly tableCaption: string;
  readonly rowsOmitted: (count: string) => string;
  /** The data table's x column, when the x axis has no title: categories, or values (data-table.md 1). */
  readonly category: string;
  readonly xValue: string;
  /** The button that goes back to the whole data (zoom-pan.md 7). */
  readonly resetZoom: string;
  /** Announced when the keyboard zooms or moves the range (zoom-pan.md 8), its ends already written. */
  readonly rangeShown: (from: string, to: string) => string;
  /** Announced when the range goes back to the whole data. */
  readonly rangeWhole: string;
  /** The navigator's two handles (navigator.md 4). */
  readonly rangeStart: string;
  readonly rangeEnd: string;
  /** The range buttons (range-buttons.md 1). */
  readonly range1m: string;
  readonly range3m: string;
  readonly rangeYtd: string;
  readonly range1y: string;
  readonly rangeAll: string;
  /** The table's range in its caption, and its button (data-table.md 5). */
  readonly tableRange: (from: string, to: string) => string;
  readonly tableAll: string;
  readonly tableVisible: string;
}

const BUILT_IN: Readonly<Record<string, Messages>> = { en, fr };

/** The messages for a locale (its language), English otherwise, with the app's overrides on top. */
export function messagesFor(locale: string, overrides?: Partial<Messages>): Messages {
  const language = locale.toLowerCase().split('-')[0] ?? 'en';
  return { ...(BUILT_IN[language] ?? en), ...overrides };
}
