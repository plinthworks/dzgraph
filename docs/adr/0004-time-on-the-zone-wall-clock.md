# Time ticks on the zone's wall clock, through Intl only

Time axes read instants in an IANA zone and place ticks on that zone's wall clock: a day tick at local midnight (or
the first instant after a skipped midnight), an hour repeated by a clock change gets two ticks, a skipped hour none.
The core uses `Intl` only (no `Date` arithmetic, no Temporal), so it stays pure and dependency-free; spike S4
(2026-11-21) measured it under 1 ms per layout and correct on Paris, Los Angeles, Auckland, Lord Howe and Havana.
Instants and calendar days are distinct types, never converted without a zone.
