# Stacking

Phase 4. Owner 2026-11-21: `stack: 'name'` on each series (`true` = the default stack), `stacking: 'percent'` on the
y axis for shares.

## What the user does
Looks at parts that add up: columns, bars or areas stacked on each other, in values or in shares of the whole; with
negative values, gaps, a hidden series.

## What they observe

### Which series stack
1. Series of one type (columns, bars or areas) with the same `stack` name, on the same x and y axes, stack on each
   other; `stack: true` is the stack named `default`. A series without `stack` stands alone, as before. `stack` is not
   an option of lines and scatter plots (`unknown-option`): a stacked line reads as its own values, which it is not.
2. Several stacks of columns on one axis stand side by side in each band, like grouped columns (columns-bars.md 1):
   one slot per stack, in the order of their first series.
3. In a stack, the first series lies on zero and the next ones go on top, in series order. The legend keeps
   series order.

### Values
4. Positive values stack upwards from zero, negative values downwards from zero, each on its own pile: a negative
   never eats into the positive pile.
5. A gap (`null`) adds nothing: that column is absent and the ones above close down on the one below. In a stacked
   area the gap counts as zero for the layers above it; the series' own line breaks there (line-area.md 2).
6. Areas stack by equal x values. A series with no point at an x where another has one counts as zero there.
7. Stacked series are not decimated: a layer drawn from other points than the one beneath it would cross it. Past
   2 000 marks they are painted on the Canvas (ADR 0002), all their points kept.
8. The value axis takes the piles in: from the bottom of the lowest negative pile to the top of the highest positive
   one, rounded as in axes.md 2; zero is always in (axes.md 1).

### Percent
9. `stacking: 'percent'` on the y axis: at each x, each stack's values become shares of that stack's total (of the
   sum of the absolute values, so positives and negatives keep their side). The axis runs from 0 to 100 % (−100 %
   with negatives) and its labels read `25 %` in the locale. Fixed `min` and `max` are read in percent.
10. An x whose stack totals zero draws nothing in that stack.
11. `stacking` on an x axis, or on a y axis that carries no stacked series, is reported (`invalid-option`).

### Look
12. Two px of the chart's background between stacked segments (the same gap as between columns), so the parts are
    told apart without colour. Only the top of a pile (the bottom of a negative one) is rounded (columns-bars.md 7);
    the segments inside are straight.
13. A stacked area's fill runs from the layer below to its own line, so layers never overlap; they are filled fuller
    than a lone area (half opaque), each with its line on top.

### Hover, keyboard, screen readers, table
14. The tooltip of a stacked column gives its value, its share of the pile and the pile's total (« Pommes : 120 kg
    (40 %) — total 300 kg »). The shared tooltip of stacked areas lists the layers top to bottom, as drawn, then the
    total. In percent, value and share both.
15. ↑ and ↓ move between the segments of a pile, as drawn (keyboard.md 2).
16. Screen readers read a point with its share when stacked (« Pommes, mars : 120 kg, 40 % de 300 kg. »); the
    summary says the series are stacked.
17. The data table adds, after the series of each stack, a column with the stack's total (« Total », translated;
    one per stack when there are several).
18. A hidden series leaves its pile and the others close up (animated as an update, animation.md 2); shares are
    computed again without it.

## Where DzGraph differs on purpose
- Rule 1: lines do not stack; an app that wants a running total computes it.
- Rule 17: some libraries leave totals to the reader; the table gives them, as the tooltip does.
