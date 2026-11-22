/**
 * A sparkline's words (sparkline.md 6), English and French, apart from the chart's messages: an app drawing only
 * sparklines ships these and nothing else. The numbers come written in the page's language.
 */
export interface SparklineWords {
  /** « 12 values, from 3 to 41, last 27 ». */
  readonly summary: (count: string, min: string, max: string, last: string) => string;
  /** « 1 value: 27 ». */
  readonly one: (value: string) => string;
  readonly noData: string;
  /** The app's label, then the summary. */
  readonly labelled: (label: string, summary: string) => string;
}

export const sparklineEn: SparklineWords = {
  summary: (count, min, max, last) => `${count} values, from ${min} to ${max}, last ${last}`,
  one: (value) => `1 value: ${value}`,
  noData: 'No data',
  labelled: (label, summary) => `${label}: ${summary}`,
};

export const sparklineFr: SparklineWords = {
  summary: (count, min, max, last) => `${count} valeurs, de ${min} à ${max}, dernière ${last}`,
  one: (value) => `1 valeur\u00A0: ${value}`,
  noData: 'Aucune donnée',
  labelled: (label, summary) => `${label}\u00A0: ${summary}`,
};
