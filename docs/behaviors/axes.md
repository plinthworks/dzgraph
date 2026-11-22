# Axes, ticks and labels

Phase 1: linear and category scales. Time: time-axis.md (Phase 3); log: log-scale.md (Phase 4).

## What the user does
Looks at a chart and reads values off its axes; resizes the window; looks at a chart with one value, no data, or
values that cross zero.

## What they observe

### The range of a value axis
1. Columns, bars and areas always include zero: a column's height is its value, so it must start at zero. Lines and
   scatter plots fit their data and do not force zero in.
2. The ends of a value axis are rounded outwards to ticks: values 13–87 give an axis from 0 to 100 with ticks every
   20, not 13 to 87.
3. A continuous x axis (numbers along x) runs from the first point to the last, not rounded: the line touches both
   sides of the plot. A scatter plot's x axis is rounded like a value axis (rule 2), so no marker sits on the edge.
4. Bounds the app gives (`min`, `max`) are kept exactly, not rounded; ticks fall inside them. With one bound
   only, the other end is still rounded to a tick (`min: 0` over data 13–87: 0 to 100). A bound on the wrong side
   of the data (`min` above every value) is reported (`invalid-option`) and left out.
5. One value only, or all values equal: the axis is centred on the value with a round step around it (5 → 4–6).
   With rule 1, a column of 5 gets 0–5 (owner 2026-11-21: the column's top on the last gridline). Value 0 alone:
   0–1.
6. No data at all: the axes are drawn without labels, and the plot area says so (« Aucune donnée », translated).

### Ticks
7. Round steps only: 1, 2, 2.5 or 5 times a power of ten (0.25, 50, 2 000). Among them, the one whose tick count is
   closest to what the axis's length invites: about one tick every 64 px on an axis drawn upright, every 100 px on an
   axis drawn across (labels are wider than tall). Never fewer than two ticks, and the axis is never more than 2.5
   times the data's range (a few ticks on a long axis must not shrink the data to a sliver). `ticks.target`
   overrides the count.
8. When the axis crosses zero, zero is a tick and its gridline is drawn stronger (the baseline).
9. Two value axes (`opposite` on the second): the second's ticks are placed on the first's gridlines (same count, its
   own round step, its ends set so each tick falls on one of the first's — even when the first has fixed bounds), so
   one set of gridlines serves both; only the first axis draws gridlines.

### Labels
10. Numbers follow the chart's locale (Intl): `1 234,5` in French, `1,234.5` in English.
11. All labels of one axis show the same number of decimals, the fewest that tell the ticks apart (0, 0.5, 1, 1.5 →
    `0,0  0,5  1,0  1,5`). With short forms (rule 12) zero is written `0`.
12. Large numbers are shortened when the axis's largest label passes 10 000: `12 k`, `3,4 M` (Intl compact notation,
    so the suffix is the locale's). Numbers too small (under 10⁻⁶) or too large (from 10¹⁵) to read in full are
    written in scientific notation: `1,5E-75`.
13. A category axis has one band per category, its label centred under the band. Points past the categories the
    app listed get bands of their own, named by their position, and are reported.
14. Labels across an axis that would overlap: first, fewer ticks (numbers: a larger round step). Categories: rotated
    by 45° when that makes them fit within a third of the chart's height; still too many: every second (third…)
    label shown, always the first one, the same step all along; a label still too long ends with « … » and shows whole
    in the tooltip (Phase 2).
15. Labels never touch: at least 2 px between two labels' boxes, measured with the same 2 px margin around text as
    the layout (spike S2: WebKit draws SVG text up to 1.8 px wider than measured).

### Lines and titles
16. Gridlines across the plot from each value-axis tick (on by default), not from x-axis ticks (off by default);
    `ticks.grid` turns either on or off. They are drawn crisp: on a pixel's centre at every device pixel ratio.
17. An axis's title sits beyond its labels: under an x axis; beside a y axis, turned to read upwards.
18. `reversed`: the axis runs from its end to its start, every rule above unchanged.

## Where DzGraph differs on purpose
- Rule 1: some libraries let a column axis start above zero by default; a column that does not start at zero misleads.
- Rule 12 uses the locale's own short forms (Intl), not fixed `k` / `M` letters.
