# Data table

Phase 2.

## What the user does
Needs the numbers behind the chart: a screen-reader user, someone who cannot tell colours apart, someone who prints.

## What they observe
1. Every chart has a table equivalent: a caption (the title), a first column with the x values (categories,
   formatted x, or point names), then one column per visible series, values formatted as in the tooltip.
2. It is hidden from sight but read by screen readers, after the chart; `dataTable: true` shows it under the chart.
3. A hidden series is not in it (GLOSSARY: Hidden series).
4. At most 1 000 rows; beyond, its last row says how many were left out (the CSV export of Phase 6 gives them all).
5. Zoomed (Phase 3), the table shows the visible range by default — zooming is showing a part — and says so in its
   caption (« de 3 mars à 9 mars »); a button under it switches to all the data and back, so both can be seen
   (owner 2026-11-21, D.23). The app may choose the start (`dataTable: { show, rows: 'visible' | 'all' }`). The CSV export
   follows the same choice.
