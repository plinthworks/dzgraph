# Comparison

Phase 5a. ARCHITECTURE §14. GLOSSARY: Comparison, Baseline. The `compare` module; option `compare` on a y axis:
`'value' | 'percent' | 'index'`, and `compareTo` (an x value: a number, an ISO string on a time axis) for a fixed
baseline. The view holds the user's choice (view-state.md 1), which wins over the option.

## What the user does
Sees series as change from a reference rather than as raw values: how much each moved since a date.

## What they observe
1. Each series on that axis is drawn against its baseline: `value` as the difference (y − base), `percent` as the
   change in percent ((y / base − 1) × 100), `index` as base 100 (y / base × 100).
2. The baseline is, by default, each series' first point with a value in the visible range; zooming or panning moves
   it, and the chart is computed again (big-data.md 4: as fast as a zoom). With `compareTo`, each series' point at
   that x, or the last one before it; a fixed baseline does not move with the range.
3. The axis shows the comparison: signed values (+10, −5) for `value`; signed percents (+12 %) for `percent`; plain
   numbers for `index`. A line marks the reference (0, 0 % or 100) a little stronger than the grid.
4. The tooltip gives the compared value first, then the raw value muted, and its heading names the baseline
   (« depuis le 3 mars »).
5. The table gives, per series, the raw value then the compared one; its caption names the comparison and baseline.
6. A series that cannot be compared — no point with a value at or before the baseline, or a base of 0 for `percent`
   and `index` — is not drawn, its legend item stays as it is (greyed means hidden), and a `Problem` says so (`no-baseline`, its series id;
   never a value). It comes back when the range gives it a baseline.
7. Not compared, reported (`invalid-option` at `compare`): stacked series (stacking has its own percent) and log axes.
   Polar charts have no comparison.
8. The navigator shows the raw data: it is the map of the whole.
9. Screen readers: the summary says « comparé au premier point visible » (or the date); each point's label gives the
   compared value then the raw one.
10. Changing the comparison animates as an update (animation.md 2).
