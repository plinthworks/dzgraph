# Combined charts and two value axes

Phase 4. D.2: combined charts and two axes are in v1, kept knowingly (owner 2026-11-21) though the dataviz method
advises against two scales; rule 5 makes them readable.

## What the user does
Looks at series of different types in one chart (columns with a line, areas with a scatter), possibly measured in
different units on two value axes.

## What they observe
1. Any cartesian types mix on one x axis: columns, bars, lines, areas, scatter. They are drawn in series order, later
   over earlier.
2. Only columns take room in the band: the column series share it (columns-bars.md 1); a line or an area over a
   category axis passes through the middle of each band, over the group's centre.
3. One orientation per chart (GLOSSARY: Orientation): a chart with bars is horizontal, and its lines run down along
   the categories.
4. Two value axes: `yAxis: [{ … }, { opposite: true }]`, each series saying which (`yAxis: 'y2'`). The second axis's
   ticks fall on the first one's gridlines (axes.md 9).
5. With two value axes, each axis shows the signs of its series (as in the legend) before its title, so the reader
   knows which series is read on which axis without relying on colour. An axis with no series is drawn without signs.
6. The legend has one item per series, each with its type's sign (legend.md 3).
7. Hover: the mark under the pointer gets its own tooltip, elsewhere the lines' shared one (hover-tooltip.md 12);
   values are formatted by their own axis.
8. Keyboard: ↑ and ↓ move between series at the same x whatever their type, by value on screen (keyboard.md 2).
9. Screen readers: the summary names the kinds (« Graphique combiné : colonnes et ligne, 2 séries ») and, with two
   value axes, which axis each series is on (by the axis's title).
10. Data table: with two value axes, each series' header adds its axis's title (« Pluie (mm) »).
11. Stacked columns and a line: the line is never in the pile (stacking.md 1).
12. A series of another coordinate system (a pie among columns) is reported (`invalid-option`, at its `type`) and
    left out: a chart has one coordinate system, the one of its first series.
