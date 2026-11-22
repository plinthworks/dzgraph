# Export of the data (CSV)

Phase 6. D.23 (the export follows the table's choice), data-table.md. The `exporting` module; owner's decisions
2026-11-22.

## What the user does
Takes the numbers behind the chart into a spreadsheet or a program.

## What they observe
1. The same columns as the data table (data-table.md): the x values, then one column per visible series, in series
   order; a pile's total after its last series; a compared chart adds the compared values after the raw ones; a
   selection its « selected » column (1 for a selected row). A hidden series is not in it. An aggregated chart gives
   its groups, as drawn (each named by its period's start).
2. The rows the table shows — the visible range, or all the data when the table was switched to it (D.23) — but all
   of them: no limit of 1 000 rows, no « left out » row.
3. Headers: the x axis's title (else « x » translated), then each series' name (« Série 1 »… when it has none),
   with its axis's title when the chart has two value axes.
4. Values raw, never formatted: `1234.5`, not « 1 234,5 € »; no thousands separator; an empty cell for a gap.
5. Times as ISO 8601 date-times with their offset, in the axis's zone (`2026-03-08T02:00:00+01:00`); days without
   time (`2026-03-08`) when every time written is a midnight in the zone (data by day, or by week, month, quarter,
   year); milliseconds only when there are some; categories and point names as text; a share as a fraction (0.25).
6. Universal by default (RFC 4180): comma between cells, dot for decimals, CRLF between rows, a cell quoted when it
   holds a comma, a quote or a line break (its quotes doubled). UTF-8 with a byte order mark, so a spreadsheet reads
   accents.
7. `csv: { locale: true }`: semicolons between cells and a decimal comma when the chart's language writes decimals
   with a comma (French) — what a French spreadsheet opens as columns.
8. A text cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return is written after an apostrophe: a
   spreadsheet would run it as a formula (formula injection). Numbers are never touched (`-3` stays `-3`).
9. A chart with no rows gives the header row alone.
10. Polar charts: one row per slice (its name, its value, its share); a gauge, its value and bounds.
