# Time axes

Phase 3. ADR 0004 (ticks on the zone's wall clock, Intl only); spike S4 (correct on Paris, Los Angeles, Auckland,
Lord Howe, Havana; under 1 ms a layout). Owner 2026-11-21: two-tier labels.
Comes with the `timeAxis` module (ADR 0006); `scale: 'time'` without it is reported `missing-module` and drawn linear.

## What the user does
Looks at values over time: hours, days, years; in a zone where the clock changes; across a long series.

## What they observe
1. An x axis with `scale: 'time'` reads instants: numbers (milliseconds since 1970 UTC) or ISO date-times **with**
   an offset (`2026-03-29T01:30:00+01:00`, `…Z`). A date-time without an offset is never guessed: the point is a gap,
   reported `ambiguous-instant`. A calendar day (`2026-03-29`) stands at its local midnight in the axis's zone.
2. The axis's zone is its `zone` (IANA name); absent, the page's zone. Labels, ticks and the tooltip all read the
   wall clock of that zone.
3. The axis runs from the first instant to the last (not rounded), like a numeric x axis (axes.md 3).
4. Ticks fall on round wall-clock values: years (1, 2, 5, 10…), months (1, 2, 3, 6), days (1, 2, 7, 14), hours (1, 2,
   3, 6, 12), minutes and seconds (1, 2, 5, 10, 15, 30), milliseconds (round steps) — the unit and step whose count is
   nearest the axis's target (axes.md 7).
5. A day tick is at local midnight, even on a day of 23 or 25 hours; where midnight does not exist (a clock jumping at
   midnight), at the first instant after the jump. An hour that repeats has two ticks; an hour that is skipped has
   none.
6. Labels say only what changes at that unit, in the locale (Intl): a year « 2026 », a month « mars », a day « 3 », an
   hour « 14:00 », a minute « 14:05 », a second « 14:05:30 ».
7. Two tiers (owner): when ticks are days or finer, a second row under them names the larger unit — the month and
   year under days, the date under hours — at its first tick and wherever it changes.
8. The tooltip's heading is the full date and time in the zone, to the precision of the data (« jeu. 5 mars 2026,
   14:05 »); the data table's x column reads the same.
9. Time gaps (nights, weekends) keep their room: an axis that skips them is wave 1.2.
