/**
 * The words a chart writes (CLAUDE.md: sentences belong to the DOM layer's translated messages). English and French
 * ship; an app gives others, or overrides some, through `chart()`'s setup.
 */
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';

export interface Messages {
  /** A series without a name, by its place (from 1). */
  readonly seriesName: (place: number) => string;
  /** The plot of a chart without data. */
  readonly noData: string;
  /** What ends a text cut short. */
  readonly ellipsis: string;
}

const BUILT_IN: Readonly<Record<string, Messages>> = { en, fr };

/** The messages for a locale (its language), English otherwise, with the app's overrides on top. */
export function messagesFor(locale: string, overrides?: Partial<Messages>): Messages {
  const language = locale.toLowerCase().split('-')[0] ?? 'en';
  return { ...(BUILT_IN[language] ?? en), ...overrides };
}
