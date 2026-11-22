# Pie and donut

Phase 4. Owner 2026-11-21: labels outside with a leader line and the share in %; past 7 slices or under 2 %, the
smallest join « Autres » (an option stops it). A polar coordinate system (ADR 0005).

## What the user does
Looks at the parts of one whole; points at a slice; hides one from the legend; reads it with the keyboard or a screen
reader.

## What they observe

### Slices
1. `type: 'pie'` or `'donut'`. Data: pairs `[['Pommes', 120], …]`, or points `{ name, y, key }`; a number alone is
   named by its place (« Part 3 », translated).
2. Each slice's angle is its share of the total. The first slice starts at the top and the slices follow clockwise,
   in data order (no sorting: the order is the app's). In right to left with `mirror: true` (D.10), anticlockwise.
3. A donut is a pie with a hole of 60 % of the radius (`hole` from 0 to 0.9 changes it). Its centre shows the total
   and the word « Total » (translated), or what the app gives (`center: { label, value }`, `center: false` for
   nothing).
4. Zero gives no slice; `null` is a gap. A negative value cannot be a part of a whole: reported (`invalid-data`) and
   left out. No positive value: « Aucune donnée ».
5. The pie fills the plot area, centred, leaving room for the labels (rule 9).
6. Two px of the chart's background between slices. Colours follow the theme's palette in data order; a hidden slice
   keeps its colour for when it comes back, and the others keep theirs.

### « Autres »
7. More than 7 slices: the 6 largest stay and the rest join one slice « Autres » (translated), drawn last in a
   neutral colour (`--dzgraph-others`). Then any slice under 2 % of the total joins it too. A group of one slice is
   not made: that slice stays itself. `others: false` stops all grouping.
8. The tooltip of « Autres » lists its slices (the 10 largest, then « et 4 autres »). The data table lists every
   slice, never « Autres ».

### Labels and legend
9. Each slice is labelled outside: its name and its share (« Pommes 34 % »), joined to the slice by a thin leader
   line that leaves the edge at the slice's middle angle. Labels stand in two columns, beside the pie on each side,
   moved up or down so they never overlap (axes.md 15's 2 px). The pie shrinks to make room, down to a third of the
   plot's smaller side; below that, labels are dropped and the legend is shown instead.
10. Shares are whole percents; one decimal under 10 % (« 4,5 % »); « < 0,1 % » below. They are rounded one by one, so
    they may not add up to 100 %: the tooltip gives the exact value.
11. The legend is hidden when the labels show (they name every slice), shown when they do not or with `legend: true`;
    its items are the slices. Clicking one hides the slice: the others share the whole again.

### Hover, keyboard, screen readers, table, animation
12. Pointing at a slice brings it 6 px out along its middle angle and fades the others (highlight, hover-tooltip.md
    5); the tooltip gives its name, its value and its share. A tap does the same on touch.
13. The slices are one tab stop (keyboard.md 1); → and ↓ go to the next slice (clockwise as drawn), ← and ↑ to the
    previous one, Home and End to the first and last. The focus ring follows the slice's outline. Enter is a click.
14. Screen readers: the summary names the kind, the count and the largest part (« Graphique en secteurs, 5 parts. La
    plus grande : Pommes, 34 %. »); a slice is read « Pommes : 120 kg, 34 %. Part 1 sur 5. »
15. Data table: one row per slice, with its value and its share.
16. Appearing: the slices open clockwise from the top (400 ms, animation.md 1). Updating: angles move from where they
    were.
17. One pie or donut per chart in Phase 4; a second one is reported (`invalid-option`) and left out (rings inside
    rings come in a 1.x wave).

## Where DzGraph differs on purpose
- Rule 2: right to left turns the pie only with `mirror`, as the x axis (D.10).
- Rule 7: grouping is on by default, so a pie never shows a fan of slivers; the table keeps every slice.
