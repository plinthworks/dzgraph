/**
 * Instants and calendar days are distinct (ADR 0004, GLOSSARY: Instant, Day): one is never turned into the other
 * without a zone. Both are branded, so the compiler refuses to mix them; values of these types come only from the
 * core's own checks.
 */
import type { TimeKit } from './kit.js';
declare const instantBrand: unique symbol;
declare const dayBrand: unique symbol;

/** A moment in time, in milliseconds since 1970-01-01T00:00:00Z, without a zone. */
export type InstantMs = number & { readonly [instantBrand]: true };

/** A calendar date, `YYYY-MM-DD`, without a time or a zone. */
export type Day = string & { readonly [dayBrand]: true };

/** An IANA time zone name (`Europe/Paris`), checked by Intl when an axis uses it. */
export type ZoneName = string;

// ---- The wall clock in a zone, through Intl only (ADR 0004, spike S4). ----

/** A wall-clock reading. */
export interface Wall {
  readonly y: number;
  readonly mo: number;
  readonly d: number;
  readonly h: number;
  readonly mi: number;
  readonly s: number;
  readonly ms: number;
}

const wallFormats = new Map<string, Intl.DateTimeFormat>();
function wallFormat(zone: string): Intl.DateTimeFormat {
  let f = wallFormats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    wallFormats.set(zone, f);
  }
  return f;
}

/** The wall clock of an instant in a zone. */
export function wallOf(ms: number, zone: string): Wall {
  let y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0;
  for (const p of wallFormat(zone).formatToParts(ms)) {
    if (p.type === 'year') y = Number(p.value);
    else if (p.type === 'month') mo = Number(p.value);
    else if (p.type === 'day') d = Number(p.value);
    else if (p.type === 'hour') h = Number(p.value);
    else if (p.type === 'minute') mi = Number(p.value);
    else if (p.type === 'second') s = Number(p.value);
  }
  return { y, mo, d, h, mi, s, ms: ((ms % 1000) + 1000) % 1000 };
}

/** Days since 1970-01-01 of a proleptic Gregorian date (the civil-days formula, public domain). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The date of a day number (inverse of `daysFromCivil`). */
export function civilFromDays(z: number): { y: number; mo: number; d: number } {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mo = mp + (mp < 10 ? 3 : -9);
  return { y: yoe + era * 400 + (mo <= 2 ? 1 : 0), mo, d };
}

/** A wall clock as if it were UTC, in milliseconds. */
const wallMs = (w: Wall) => daysFromCivil(w.y, w.mo, w.d) * 86_400_000 + ((w.h * 60 + w.mi) * 60 + w.s) * 1000 + w.ms;

const offsetAt = (ms: number, zone: string) => wallMs(wallOf(ms, zone)) - ms;

/**
 * The instants that show this wall clock in a zone, earliest first: none (a skipped hour), one, or two (a repeated
 * hour). Offsets are read a day before and after: a zone's offset never changes twice within a day.
 */
export function instantsOf(w: Wall, zone: string): number[] {
  const local = wallMs(w);
  const out = new Set<number>();
  for (const o of [offsetAt(local - 86_400_000, zone), offsetAt(local + 86_400_000, zone)]) {
    const t = local - o;
    if (wallMs(wallOf(t, zone)) === local) out.add(t);
  }
  return [...out].sort((a, b) => a - b);
}

/** A day's start in a zone: local midnight, or the first instant after a skipped midnight (time-axis.md 5). */
export function dayStart(y: number, mo: number, d: number, zone: string): number {
  const midnight: Wall = { y, mo, d, h: 0, mi: 0, s: 0, ms: 0 };
  const at = instantsOf(midnight, zone);
  if (at.length) return at[0]!;
  // Skipped: the instant the clock jumped, read with the offset in force before it.
  return wallMs(midnight) - offsetAt(wallMs(midnight) - 86_400_000, zone);
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * An ISO value on a time axis (time-axis.md 1): a date-time with an offset → its instant; a calendar day → its start
 * in the zone; a date-time without an offset → 'ambiguous' (never guessed); anything else → 'invalid'.
 */
export function parseInstant(text: string, zone: string): number | 'ambiguous' | 'invalid' {
  const m = ISO.exec(text.trim());
  if (!m) return 'invalid';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const back = civilFromDays(daysFromCivil(y, mo, d));
  if (back.y !== y || back.mo !== mo || back.d !== d) return 'invalid';
  if (m[4] === undefined) return dayStart(y, mo, d, zone);
  if (m[8] === undefined) return 'ambiguous';
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = m[6] === undefined ? 0 : Number(m[6]);
  if (h > 23 || mi > 59 || s > 59) return 'invalid';
  const ms = m[7] === undefined ? 0 : Math.round(Number(`0.${m[7]}`) * 1000);
  let offset = 0;
  if (m[8] !== 'Z') {
    const sign = m[8].startsWith('-') ? -1 : 1;
    const digits = m[8].slice(1).replace(':', '');
    offset = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60_000;
  }
  return daysFromCivil(y, mo, d) * 86_400_000 + ((h * 60 + mi) * 60 + s) * 1000 + ms - offset;
}

// ---- Ticks on the wall clock (time-axis.md 4–5). ----

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export type TimeUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';

const STEPS: readonly (readonly [TimeUnit, number, readonly number[]])[] = [
  ['millisecond', 1, [1, 2, 5, 10, 20, 50, 100, 200, 500]],
  ['second', 1000, [1, 2, 5, 10, 15, 30]],
  ['minute', 60_000, [1, 2, 5, 10, 15, 30]],
  ['hour', 3_600_000, [1, 2, 3, 6, 12]],
  ['day', 86_400_000, [1, 2, 7, 14]],
  ['month', 2_629_800_000, [1, 2, 3, 6]],
  ['year', 31_557_600_000, [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]],
];

export interface TimeTicks {
  readonly unit: TimeUnit;
  readonly step: number;
  readonly values: readonly number[];
  readonly zone: string;
}

/** The ticks of one unit and step over [a, b], on the zone's wall clock. */
function ticksOf(a: number, b: number, unit: TimeUnit, step: number, zone: string, limit: number): number[] {
  const out: number[] = [];
  if (unit === 'millisecond' || unit === 'second' || unit === 'minute' || unit === 'hour') {
    // Candidates on round instants: every offset in use is a whole number of quarter hours, so a wall-clock minute,
    // second or millisecond boundary is also one in UTC; hours are checked on the wall clock (a repeated hour gives
    // two ticks, a skipped hour none).
    // A minute step's candidates every gcd(step, 15) minutes: offsets are whole quarter hours, so a wall-clock multiple
    // of the step is a UTC multiple of that (review 5: ten-minute ticks in Kathmandu, +5:45).
    const q = unit === 'millisecond' ? step : unit === 'second' ? 1000 * step : unit === 'minute' ? 60_000 * gcd(step, 15) : 900_000;
    for (let t = Math.ceil(a / q) * q; t <= b && out.length <= limit; t += q) {
      if (unit === 'millisecond' || unit === 'second') {
        out.push(t);
        continue;
      }
      const w = wallOf(t, zone);
      if (w.s !== 0 || w.ms !== 0) continue;
      if (unit === 'minute' ? w.mi % step === 0 : w.mi === 0 && w.h % step === 0) out.push(t);
    }
    return out;
  }
  const w = wallOf(a, zone);
  if (unit === 'day') {
    for (let day = daysFromCivil(w.y, w.mo, w.d); out.length <= limit; day++) {
      const c = civilFromDays(day);
      if ((c.d - 1) % step !== 0) continue;
      const t = dayStart(c.y, c.mo, c.d, zone);
      if (t > b) break;
      // A day the clock skipped whole starts where the next one does: one tick (review 4: Apia, 30 December 2011).
      if (t >= a && t !== out[out.length - 1]) out.push(t);
    }
    return out;
  }
  let y = w.y;
  let mo = unit === 'year' ? 1 : w.mo;
  for (; out.length <= limit; ) {
    const aligned = unit === 'year' ? y % step === 0 : (mo - 1) % step === 0;
    if (aligned) {
      const t = dayStart(y, mo, 1, zone);
      if (t > b) break;
      if (t >= a) out.push(t);
    }
    if (unit === 'year') y++;
    else if (++mo > 12) {
      mo = 1;
      y++;
    }
    if (y > 275_000) break;
  }
  return out;
}

/** The unit and step whose tick count over [a, b] is nearest `target`; ties go to the larger step (fewer ticks). */
export function timeTicks(a: number, b: number, target: number, zone: string): TimeTicks {
  const span = Math.max(b - a, 1);
  let best: TimeTicks | null = null;
  let miss = Infinity;
  for (const [unit, ms, steps] of STEPS)
    for (const step of steps) {
      const approx = span / (ms * step);
      if (approx > 4 * target + 10 || approx < 0.3) continue;
      const values = ticksOf(a, b, unit, step, zone, 4 * target + 10);
      const m = Math.abs(values.length - target);
      if (values.length >= 1 && m <= miss) {
        miss = m;
        best = { unit, step, values, zone };
      }
    }
  return best ?? { unit: 'year', step: 1, values: [a], zone };
}

// ---- Labels (time-axis.md 6–8). ----

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(locale: string | undefined, zone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${zone}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
    } catch {
      f = new Intl.DateTimeFormat(undefined, { ...options, timeZone: zone });
    }
    dateFormats.set(key, f);
  }
  return f;
}

const FIRST_TIER: Readonly<Record<TimeUnit, Intl.DateTimeFormatOptions>> = {
  year: { year: 'numeric' },
  month: { month: 'long' },
  day: { day: 'numeric' },
  hour: { hour: '2-digit', minute: '2-digit' },
  minute: { hour: '2-digit', minute: '2-digit' },
  second: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
  millisecond: { minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 },
};

/** The second tier under each unit, and what makes it change (time-axis.md 7). */
const SECOND_TIER: Partial<Record<TimeUnit, { readonly options: Intl.DateTimeFormatOptions; readonly key: (w: Wall) => number }>> = {
  month: { options: { year: 'numeric' }, key: (w) => w.y },
  day: { options: { month: 'long', year: 'numeric' }, key: (w) => w.y * 12 + w.mo },
  hour: { options: { weekday: 'short', day: 'numeric', month: 'short' }, key: (w) => daysFromCivil(w.y, w.mo, w.d) },
  minute: { options: { weekday: 'short', day: 'numeric', month: 'short' }, key: (w) => daysFromCivil(w.y, w.mo, w.d) },
  second: { options: { weekday: 'short', day: 'numeric', month: 'short' }, key: (w) => daysFromCivil(w.y, w.mo, w.d) },
  millisecond: { options: { hour: '2-digit', minute: '2-digit' }, key: (w) => w.h * 60 + w.mi },
};

/** The ticks' labels, and the second tier's: at the first tick and wherever the larger unit changes. */
export function timeLabels(t: TimeTicks, locale: string | undefined, zone: string): { labels: string[]; second: { index: number; text: string }[] } {
  const first = dateFormat(locale, zone, FIRST_TIER[t.unit]);
  const labels = t.values.map((v) => first.format(v));
  const tier = SECOND_TIER[t.unit];
  const second: { index: number; text: string }[] = [];
  if (tier) {
    const f = dateFormat(locale, zone, tier.options);
    let last: number | null = null;
    t.values.forEach((v, index) => {
      const k = tier.key(wallOf(v, zone));
      if (k !== last) second.push({ index, text: f.format(v) });
      last = k;
    });
  }
  return { labels, second };
}

/** An instant as the tooltip's heading and the data table read it: the date, and the time if it has one (time-axis.md 8). */
export function formatInstant(ms: number, locale: string | undefined, zone: string): string {
  const w = wallOf(ms, zone);
  const date: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  if (w.ms !== 0) return dateFormat(locale, zone, { ...date, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }).format(ms);
  if (w.s !== 0) return dateFormat(locale, zone, { ...date, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(ms);
  if (w.h !== 0 || w.mi !== 0) return dateFormat(locale, zone, { ...date, hour: '2-digit', minute: '2-digit' }).format(ms);
  return dateFormat(locale, zone, date).format(ms);
}

// ---- Calendar steps (range-buttons.md 2–3). ----

const daysIn = (y: number, mo: number) => (mo === 2 ? (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(mo) ? 30 : 31);

/** The same wall-clock time `months` calendar months earlier: the same day, or that month's last when it is shorter. */
export function monthsBefore(ms: number, months: number, zone: string): number {
  const w = wallOf(ms, zone);
  const n = w.y * 12 + (w.mo - 1) - months;
  const y = Math.floor(n / 12);
  const mo = n - y * 12 + 1;
  const d = Math.min(w.d, daysIn(y, mo));
  // A wall-clock time the clock skipped that day: the day's start plus the time, as the clock would have read.
  return instantsOf({ ...w, y, mo, d }, zone)[0] ?? dayStart(y, mo, d, zone) + ((w.h * 60 + w.mi) * 60 + w.s) * 1000 + w.ms;
}

/** Midnight of 1 January of the instant's year, on the zone's calendar. */
export function yearStart(ms: number, zone: string): number {
  return dayStart(wallOf(ms, zone).y, 1, 1, zone);
}

/** The time axis's part of the core (ADR 0006): what `timeAxis` lends it. */
export const timeKit: TimeKit = { parse: parseInstant, ticks: timeTicks, labels: timeLabels, format: formatInstant, monthsBefore, yearStart };
