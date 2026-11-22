/**
 * What the imported features lend the core (ADR 0006): the core never imports their code, it receives it here with
 * the options and keeps it on the model, so an app that imports no time axis and no navigator ships neither.
 */
import type { TimeTicks } from './time.js';
import type { navigatorGroups, navigatorLayout, rangeButtonSpan } from './navigator.js';

/** Instants on a zone's wall clock: reading, ticks, labels, calendar steps (time-axis.md). */
export interface TimeKit {
  readonly parse: (text: string, zone: string) => number | 'ambiguous' | 'invalid';
  readonly ticks: (a: number, b: number, target: number, zone: string) => TimeTicks;
  readonly labels: (t: TimeTicks, locale: string | undefined, zone: string) => { labels: string[]; second: { index: number; text: string }[] };
  readonly format: (ms: number, locale: string | undefined, zone: string) => string;
  /** The same wall-clock time a number of calendar months earlier (that month's last day when it is shorter). */
  readonly monthsBefore: (ms: number, months: number, zone: string) => number;
  /** Midnight of 1 January of the instant's year, on the zone's calendar. */
  readonly yearStart: (ms: number, zone: string) => number;
}

/** The navigator and its range buttons (navigator.md, range-buttons.md). */
export interface NavigatorKit {
  /** The strip's height. */
  readonly strip: number;
  readonly layout: typeof navigatorLayout;
  readonly groups: typeof navigatorGroups;
  readonly span: typeof rangeButtonSpan;
}

/** One slot per feature that reaches the core; null: not imported. */
export interface Kit {
  readonly time: TimeKit | null;
  readonly navigator: NavigatorKit | null;
}

export const NO_KIT: Kit = { time: null, navigator: null };
