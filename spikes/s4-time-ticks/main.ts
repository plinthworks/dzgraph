// S4: correctness on days that change the clock (expectations written by hand), then the cost of a layout's ticks.
import { calls, resetCalls, ticks, wall, type Unit } from './time.ts';
import { prng } from '../lib/data.ts';

const H = 3600000;
const iso = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi); // test page only
const local = (t: number, z: string) => { const w = wall(t, z); return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`; };

/** Hand-written: zone, local day, expected hour ticks (local labels) and the instant of the day tick (UTC). */
const cases = [
  // Paris, spring forward 2026-03-29 02:00 → 03:00: no 02:00, 23 ticks. Midnight is 23:00Z the day before.
  { zone: 'Europe/Paris', day: [2026, 3, 29], hours: 23, missing: '02:00', dayTick: iso(2026, 3, 28, 23) },
  // Paris, fall back 2026-10-25 03:00 → 02:00: 02:00 twice, 25 ticks.
  { zone: 'Europe/Paris', day: [2026, 10, 25], hours: 25, twice: '02:00', dayTick: iso(2026, 10, 24, 22) },
  // Los Angeles, 2026-03-08 02:00 → 03:00.
  { zone: 'America/Los_Angeles', day: [2026, 3, 8], hours: 23, missing: '02:00', dayTick: iso(2026, 3, 8, 8) },
  // Auckland, 2026-04-05 03:00 → 02:00 (NZDT ends): 02:00 twice. Midnight is 11:00Z on the 4th (+13).
  { zone: 'Pacific/Auckland', day: [2026, 4, 5], hours: 25, twice: '02:00', dayTick: iso(2026, 4, 4, 11) },
  // Lord Howe, 2026-04-05 02:00 → 01:30 (half an hour back): every hour once, 24 ticks. Midnight at +11.
  { zone: 'Australia/Lord_Howe', day: [2026, 4, 5], hours: 24, dayTick: iso(2026, 4, 4, 13) },
  // Havana, 2026-03-08 00:00 → 01:00: midnight does not exist; the day starts at 01:00 local (UTC−4) = 05:00Z.
  { zone: 'America/Havana', day: [2026, 3, 8], hours: 23, missing: '00:00', dayTick: iso(2026, 3, 8, 5) },
];

function check() {
  const res = [];
  for (const c of cases) {
    const [y, mo, d] = c.day as [number, number, number];
    // The whole local day: from its first tick to the next day's.
    const dayTicks = ticks(iso(y, mo, d) - 16 * H, iso(y, mo, d) + 40 * H, 'day', 1, c.zone);
    const start = dayTicks.find((t) => wall(t, c.zone).d === d)!;
    const end = dayTicks.find((t) => t > start)!;
    const hs = ticks(start, end - 1, 'hour', 1, c.zone);
    const labels = hs.map((t) => local(t, c.zone));
    const ok = {
      dayTick: start === c.dayTick,
      count: hs.length === c.hours,
      missing: c.missing ? !labels.includes(c.missing) : true,
      twice: c.twice ? labels.filter((l) => l === c.twice).length === 2 : true,
    };
    res.push({ zone: c.zone, day: c.day.join('-'), ok: Object.values(ok).every(Boolean), detail: ok, got: { dayTick: new Date(start).toISOString(), hours: hs.length } });
  }
  return res;
}

/** A realistic layout: about 8 ticks across the view, the unit chosen by span. */
function pick(span: number): [Unit, number] {
  const table: [Unit, number, number][] = [
    ['minute', 1, 60e3], ['minute', 5, 300e3], ['minute', 15, 900e3], ['minute', 30, 1800e3],
    ['hour', 1, H], ['hour', 3, 3 * H], ['hour', 6, 6 * H], ['hour', 12, 12 * H],
    ['day', 1, 24 * H], ['day', 7, 168 * H], ['month', 1, 730 * H], ['month', 3, 2190 * H],
    ['year', 1, 8766 * H], ['year', 5, 43830 * H],
  ];
  for (const [u, s, ms] of table) if (span / ms <= 10) return [u, s];
  return ['year', 10];
}

function bench(zone: string) {
  const r = prng(4);
  const times: number[] = [];
  let maxCalls = 0;
  const labels = new Intl.DateTimeFormat('fr-FR', { timeZone: zone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  for (let i = 0; i < 2000; i++) {
    const span = Math.exp(Math.log(H) + r() * (Math.log(20 * 8766 * H) - Math.log(H)));
    const a = iso(2000, 1, 1) + r() * 25 * 8766 * H;
    const [u, s] = pick(span);
    resetCalls();
    const t0 = performance.now();
    const ts = ticks(a, a + span, u, s, zone);
    for (const t of ts) labels.format(t);
    times.push(performance.now() - t0);
    maxCalls = Math.max(maxCalls, calls);
  }
  times.sort((x, y) => x - y);
  return { median: +times[1000]!.toFixed(3), p95: +times[1900]!.toFixed(3), max: +times[1999]!.toFixed(3), maxIntlCallsPerLayout: maxCalls };
}

(window as any).run = () => ({
  cases: check(),
  bench: Object.fromEntries(['Europe/Paris', 'Pacific/Auckland', 'Australia/Lord_Howe', 'UTC'].map((z) => [z, bench(z)])),
});
(window as any).ready = true;
