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
  /** The data table's caption when the chart has no title, and its last row past 1 000 (data-table.md 1, 4). */
  readonly tableCaption: string;
  readonly rowsOmitted: (count: string) => string;
  /** The data table's x column, when the x axis has no title: categories, or values (data-table.md 1). */
  readonly category: string;
  readonly xValue: string;
}

const BUILT_IN: Readonly<Record<string, Messages>> = { en, fr };

/** The messages for a locale (its language), English otherwise, with the app's overrides on top. */
export function messagesFor(locale: string, overrides?: Partial<Messages>): Messages {
  const language = locale.toLowerCase().split('-')[0] ?? 'en';
  return { ...(BUILT_IN[language] ?? en), ...overrides };
}
