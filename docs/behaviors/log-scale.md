# Logarithmic scale

Phase 4. Owner 2026-11-21: a value of zero or below becomes a gap, reported `non-positive-log-value`, never guessed.

## What the user does
Looks at values spread over several orders of magnitude (10, 1 000, 100 000), where equal steps mean equal ratios.

## What they observe
1. `scale: 'log'` on a value axis (a y axis, or the x axis of a scatter plot): base ten, each power of ten the same
   length along the axis.
2. A value of zero or below has no place on it: the point is a gap everywhere (line-area.md 2: not drawn, not
   hovered, an empty cell in the data table), and the series reports `non-positive-log-value` once, with how many
   points. On a log x axis (a scatter plot), the same for x.
3. The ends are rounded outwards: to powers of ten when the data spans a decade or more (13–87 000 gives 10 to
   100 000), else to the nearest tick of rule 4 (13–87 gives 10 to 100, 130–870 gives 100 to 1 000; 120–180 gives
   100 to 200). A bound the app gives is kept exactly; a bound of zero or below is reported (`invalid-option`) and
   left out.
4. Ticks: every power of ten; where there is room (axes.md 7, about one tick every 64 px upright), also 2 and 5 times
   it; with more room, 2 to 9 times it. With too many decades for the room, every second (fifth, tenth) power of
   ten, always the same step.
5. Labels follow axes.md 10–12 (locale, short forms past 10 000, scientific notation for the very small and very
   large): `0,01  0,1  1  10  100  1 k`.
6. Gridlines on every tick; there is no zero line.
7. One value only: from the power of ten at or below it to the next one above (5 gives 1 to 10); a power of ten alone
   gives one decade on each side (10 gives 1 to 100). No positive value at all: 1 to 10, the plot says « Aucune
   donnée ».
8. Columns, bars and areas grow from the bottom of the axis, not from zero, which is not on it.
9. `reversed` works as on a linear axis (axes.md 18).
10. Stacking on a log axis is reported (`invalid-option`) and the series are drawn side by side: a pile's parts do not
    add up along a log axis.
11. A log axis used as the second value axis (axes.md 9) is not aligned on the first one's gridlines: its own ticks,
    no gridlines of its own.

## Where DzGraph differs on purpose
- Rule 2: the value is never moved to a small positive number to be drawn; a point that cannot be placed is a gap and
  says so.
