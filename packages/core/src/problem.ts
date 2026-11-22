/**
 * Bad or ambiguous input never throws (CLAUDE.md): it becomes a Problem the chart reports, and the chart draws what
 * it can. A Problem names what is wrong and where, never the app's values: a chart may plot health records.
 *
 * Codes are open, like series types (ADR 0005): a type module adds its own (a negative slice, a hierarchy cycle) to
 * `ProblemCodes` by declaration merging. Translations are written as `Partial<Record<ProblemCode, string>>`, so a new
 * code never breaks an app's message table.
 */
export interface ProblemCodes {
  /** An option the chart does not know (a typo, or an option of another series type). */
  'unknown-option': true;
  /** An option of the wrong kind (a string where a number is expected, a colour name that is no CSS name…). */
  'invalid-option': true;
  /** A series whose `type` was not given to `chart()` in `types`. */
  'unknown-series-type': true;
  /** Two series, or two axes, with the same `id`; or an `id` starting with `#` (reserved for default ids). */
  'duplicate-id': true;
  /** A series naming an axis that does not exist. */
  'unknown-axis': true;
  /** Series that need different orientations in one chart (bars across, columns up). */
  'mixed-orientation': true;
  /** Data in none of the accepted shapes. */
  'invalid-data': true;
  /**
   * Values that are not finite numbers in an array the app wrote (NaN, Infinity): drawn as gaps; one Problem per
   * series, its detail the count. In a typed column, NaN is the way to write a gap and is not reported.
   */
  'non-finite-value': true;
  /** Two points of one series with the same key: the later one is left out of selection and links. */
  'duplicate-key': true;
  /** Points of a line or an area whose x values go backwards: drawn in the given order, decimation off. */
  'unsorted-x': true;
  /** A date-time string without an offset: never guessed, the point is a gap. */
  'ambiguous-instant': true;
  /** A value a logarithmic axis cannot show (zero, negative): the point is a gap. */
  'non-positive-log-value': true;
  /** An app callback (a formatter…) threw or returned the wrong kind: its default is used instead. */
  'callback-failed': true;
  /**
   * Something this version accepts but does not draw yet (a type whose coordinate system has no layout yet, range
   * buttons off a time axis): drawn the closest way, or left out; the detail names it.
   */
  'not-available': true;
  /**
   * An option whose feature the app did not pass to `chart()` (ADR 0006): a time axis drawn linear, a navigator or
   * range buttons left out. The detail names the module to import (`timeAxis`, `navigatorStrip`).
   */
  'missing-module': true;
}

export type ProblemCode = keyof ProblemCodes;

export interface Problem {
  readonly code: ProblemCode;
  /** Where, as an option path: `series[2].data[17]`, `yAxis[0].min`. */
  readonly path: string;
  /** The series concerned, by id: a path's index shifts when series are added, the id does not. */
  readonly seriesId?: string;
  /** A raw detail for developers (an option name, a type name, a count), never a value from the data. */
  readonly detail?: string;
}
