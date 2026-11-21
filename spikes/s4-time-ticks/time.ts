// Wall clock in an IANA zone through Intl only (no Date arithmetic, no Temporal): what the core would do.
// Throwaway code (Phase 0).

export interface Wall { y: number; mo: number; d: number; h: number; mi: number; s: number }

const fmts = new Map<string, Intl.DateTimeFormat>();
function fmt(zone: string): Intl.DateTimeFormat {
  let f = fmts.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    fmts.set(zone, f);
  }
  return f;
}

export let calls = 0;
export function resetCalls() { calls = 0; }

export function wall(ms: number, zone: string): Wall {
  calls++;
  const w: Wall = { y: 0, mo: 0, d: 0, h: 0, mi: 0, s: 0 };
  for (const p of fmt(zone).formatToParts(ms)) {
    if (p.type === 'year') w.y = +p.value;
    else if (p.type === 'month') w.mo = +p.value;
    else if (p.type === 'day') w.d = +p.value;
    else if (p.type === 'hour') w.h = +p.value;
    else if (p.type === 'minute') w.mi = +p.value;
    else if (p.type === 'second') w.s = +p.value;
  }
  return w;
}

/** Days since 1970-01-01 of a proleptic Gregorian date (Howard Hinnant's public civil-days formula). */
export function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The wall clock as if it were UTC, in ms. */
export function wallMs(w: Wall): number {
  return daysFromCivil(w.y, w.mo, w.d) * 86400000 + ((w.h * 60 + w.mi) * 60 + w.s) * 1000;
}

export function offsetAt(ms: number, zone: string): number {
  return wallMs(wall(ms, zone)) - Math.floor(ms / 1000) * 1000;
}

/**
 * The instants showing this wall time: none (a gap), one, or two (an overlap), earliest first.
 * Offsets are looked up a day before and after: an offset never changes twice within a day.
 */
export function instantsOf(w: Wall, zone: string): number[] {
  const local = wallMs(w);
  const offs = new Set([offsetAt(local - 86400000, zone), offsetAt(local + 86400000, zone)]);
  const out: number[] = [];
  for (const o of offs) {
    const t = local - o;
    if (wallMs(wall(t, zone)) === local) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

export type Unit = 'year' | 'month' | 'day' | 'hour' | 'minute';

/**
 * Ticks over [a, b] at every `step` units, on the zone's wall clock:
 * - year, month, day: local midnight of the day; a skipped midnight gives the first instant after the gap.
 * - hour, minute: every instant whose wall minute (and hour) is a multiple of the step: a repeated hour gives two
 *   ticks, a skipped hour none. Candidates every 15 minutes (every offset in use is a multiple of 15 minutes).
 */
export function ticks(a: number, b: number, unit: Unit, step: number, zone: string): number[] {
  const out: number[] = [];
  if (unit === 'hour' || unit === 'minute') {
    const q = unit === 'minute' && step < 15 ? 60000 * step : 900000;
    let t = Math.ceil(a / q) * q;
    for (; t <= b; t += q) {
      const w = wall(t, zone);
      if (w.s !== 0) continue;
      if (unit === 'minute' ? w.mi % step === 0 : w.mi === 0 && w.h % step === 0) out.push(t);
    }
    return out;
  }
  const w = wall(a, zone);
  let y = w.y;
  let mo = unit === 'year' ? 1 : w.mo;
  let d = unit === 'day' ? w.d : 1;
  for (let guard = 0; guard < 100000; guard++) {
    const midnight = { y, mo, d, h: 0, mi: 0, s: 0 };
    const at = instantsOf(midnight, zone);
    let t: number;
    if (at.length) t = at[0]!;
    else {
      // A gap at midnight: the first instant after it, found by stepping the 15-minute candidates.
      const near = wallMs(midnight) - offsetAt(wallMs(midnight) - 86400000, zone);
      t = near;
      while (wall(t, zone).d !== d) t += 900000;
    }
    if (t > b) break;
    if (t >= a) out.push(t);
    if (unit === 'year') y += step;
    else if (unit === 'month') { mo += step; while (mo > 12) { mo -= 12; y++; } }
    else {
      // Next calendar day (step days), through day numbers.
      const n = daysFromCivil(y, mo, d) + step;
      const c = civilFromDays(n);
      y = c.y; mo = c.mo; d = c.d;
    }
  }
  return out;
}

export function civilFromDays(z: number): { y: number; mo: number; d: number } {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mo = mp + (mp < 10 ? 3 : -9);
  return { y: yoe + era * 400 + (mo <= 2 ? 1 : 0), mo, d };
}
