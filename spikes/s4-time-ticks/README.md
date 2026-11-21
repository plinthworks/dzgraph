# S4 — Time ticks in a zone, through Intl only

Run: `node spikes/s4-time-ticks/run.mjs`. Code: `time.ts` (wall clock through `formatToParts`, civil-day arithmetic,
the instants of a wall time: none, one or two).

**Rule (written before):** acceptable under 2 ms per layout; otherwise cache offsets per range.

**Correctness** (expectations written by hand) — all pass in Chrome, Firefox, WebKit:
Paris spring forward (23 hourly ticks, no 02:00) and fall back (25, 02:00 twice); Los Angeles; Auckland (02:00 twice);
Lord Howe (half-hour change: 24 ticks); Havana (midnight does not exist: the day tick is 01:00 local = 05:00Z).

**Cost** (2 000 random views from 1 hour to 20 years, about 8 ticks each, labels formatted): median 0 ms, p95
0.4 ms (Chrome) / 1 ms (Firefox, WebKit: their timers round to 1 ms), at most 475 `formatToParts` calls per layout.

**Decision proposed:** Intl alone, a formatter cached per zone, no offset cache. The rules above (midnight or the first
instant after a skipped midnight; hour ticks on the wall clock, twice when repeated) go into the behaviour sheet.
