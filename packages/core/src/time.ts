/**
 * Instants and calendar days are distinct (ADR 0004, GLOSSARY: Instant, Day): one is never turned into the other
 * without a zone. Both are branded, so the compiler refuses to mix them; values of these types come only from the
 * core's own checks.
 */
declare const instantBrand: unique symbol;
declare const dayBrand: unique symbol;

/** A moment in time, in milliseconds since 1970-01-01T00:00:00Z, without a zone. */
export type InstantMs = number & { readonly [instantBrand]: true };

/** A calendar date, `YYYY-MM-DD`, without a time or a zone. */
export type Day = string & { readonly [dayBrand]: true };

/** An IANA time zone name (`Europe/Paris`), checked by Intl when an axis uses it. */
export type ZoneName = string;
