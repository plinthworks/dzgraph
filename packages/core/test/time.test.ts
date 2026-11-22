// Time in a zone (time-axis.md, ADR 0004): wall clock through Intl, ISO reading, ticks on the wall clock, labels.
// Step 3.2. Expectations by hand; the tests may use Date.UTC to write instants (the core never does).
import { describe, it, expect } from 'vitest';
import { instantsOf, parseInstant, timeTicks, timeLabels, wallOf } from '../src/time.js';

const H = 3_600_000;
const D = 24 * H;
const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

describe('the wall clock (time-axis.md 2, 5)', () => {
  it('an instant read in a zone', () => {
    expect(wallOf(utc(2026, 3, 28, 23), 'Europe/Paris')).toEqual({ y: 2026, mo: 3, d: 29, h: 0, mi: 0, s: 0, ms: 0 });
  });

  it('a repeated hour has two instants; a skipped one none', () => {
    expect(instantsOf({ y: 2026, mo: 10, d: 25, h: 2, mi: 30, s: 0, ms: 0 }, 'Europe/Paris')).toEqual([utc(2026, 10, 25, 0, 30), utc(2026, 10, 25, 1, 30)]);
    expect(instantsOf({ y: 2026, mo: 3, d: 29, h: 2, mi: 30, s: 0, ms: 0 }, 'Europe/Paris')).toEqual([]);
  });
});

describe('reading ISO values (time-axis.md 1)', () => {
  it('date-times with an offset; a calendar day at its local midnight; never a guess', () => {
    expect(parseInstant('2026-03-29T01:30:00+01:00', 'Europe/Paris')).toBe(utc(2026, 3, 29, 0, 30));
    expect(parseInstant('2026-03-29T00:30:00.250Z', 'Europe/Paris')).toBe(utc(2026, 3, 29, 0, 30) + 250);
    expect(parseInstant('2026-03-29', 'Europe/Paris')).toBe(utc(2026, 3, 28, 23));
    expect(parseInstant('2026-03-08', 'America/Havana')).toBe(utc(2026, 3, 8, 5));
    expect(parseInstant('2026-03-29T01:30:00', 'Europe/Paris')).toBe('ambiguous');
    expect(parseInstant('yesterday', 'Europe/Paris')).toBe('invalid');
    expect(parseInstant('2026-02-30', 'Europe/Paris')).toBe('invalid');
  });
});

describe('ticks on the wall clock (time-axis.md 4–5)', () => {
  it('a day of 23 hours: 23 hourly ticks, no 02:00; the day tick at local midnight', () => {
    const t = timeTicks(utc(2026, 3, 28, 23), utc(2026, 3, 29, 22) - 1, 30, 'Europe/Paris');
    expect([t.unit, t.step, t.values.length]).toEqual(['hour', 1, 23]);
  });

  it('a day of 25 hours: 02:00 twice', () => {
    const t = timeTicks(utc(2026, 10, 24, 22), utc(2026, 10, 25, 23) - 1, 30, 'Europe/Paris');
    expect(t.values.length).toBe(25);
  });

  it('Havana: no midnight on 8 March 2026, the day tick at 01:00 local', () => {
    const t = timeTicks(utc(2026, 3, 6, 5), utc(2026, 3, 10, 5), 5, 'America/Havana');
    expect(t.unit).toBe('day');
    expect(t.values).toContain(utc(2026, 3, 8, 5));
  });

  it('the unit and step whose count is nearest the target: ten days, about six ticks → every two days', () => {
    const t = timeTicks(utc(2026, 3, 1), utc(2026, 3, 11), 6, 'UTC');
    expect([t.unit, t.step]).toEqual(['day', 2]);
    expect(t.values[0]).toBe(utc(2026, 3, 1));
  });

  it('years and months', () => {
    expect(timeTicks(utc(2000, 1, 1), utc(2030, 1, 1), 7, 'UTC')).toMatchObject({ unit: 'year', step: 5 });
    expect(timeTicks(utc(2026, 1, 1), utc(2026, 12, 31), 5, 'UTC')).toMatchObject({ unit: 'month', step: 3 });
  });
});

describe('labels (time-axis.md 6–7)', () => {
  it('what changes at that unit, in the locale; a second tier under days', () => {
    const t = timeTicks(utc(2026, 3, 30), utc(2026, 4, 3), 6, 'UTC');
    const l = timeLabels(t, 'fr-FR', 'UTC');
    expect(l.labels).toEqual(['30', '31', '1', '2', '3']);
    expect(l.second.map((s) => [s.index, s.text])).toEqual([[0, 'mars 2026'], [2, 'avril 2026']]);
  });

  it('hours, then the date under them', () => {
    const t = timeTicks(utc(2026, 3, 5, 12), utc(2026, 3, 5, 16), 5, 'UTC');
    const l = timeLabels(t, 'fr-FR', 'UTC');
    expect(l.labels).toEqual(['12:00', '13:00', '14:00', '15:00', '16:00']);
    expect(l.second.map((s) => s.text)).toEqual(['jeu. 5 mars']);
  });

  it('years: one tier', () => {
    const l = timeLabels(timeTicks(utc(2000, 1, 1), utc(2030, 1, 1), 7, 'UTC'), 'en-US', 'UTC');
    expect(l.labels[0]).toBe('2000');
    expect(l.second).toEqual([]);
  });
});
