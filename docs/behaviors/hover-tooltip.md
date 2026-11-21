# Hover and tooltip

Phase 2. Owner 2026-11-21: DzGraph's own tooltip (the DzTooltip bridge comes in Phase 7); other series dimmed to
35 % while one is hovered.

## What the user does
Moves the pointer over the plot; touches it on a phone; leaves it.

## What they observe
1. Over a line or an area chart, the tooltip is **shared**: the x nearest the pointer is found (anywhere up or down in
   the plot), and every visible line or area series shows its value at that x. A series with a gap there is left
   out of the tooltip.
2. Over columns, bars and scatter plots, the tooltip is **per mark**: the column under the pointer (or, in its band,
   the nearest one), the scatter point within 24 px of the pointer (the nearest), else nothing.
3. Targets are bigger than marks: a line answers anywhere in the plot, a column anywhere in its band.
4. A line chart shows a thin vertical crosshair at the hovered x; the hovered points grow (a 10 px marker with its
   background ring), even on a dense line without markers.
5. A hovered column, bar or scatter point is shown as is; the other series fade to 35 % (GLOSSARY: Highlight; the
   `highlight: false` option turns this off).
   A shared line tooltip dims nothing: every line is in it.
6. The tooltip reads: a heading (the category, the formatted x, or the point's name), then one row per series in
   series order — its sign (colour and symbol, as in the legend), its name, its value in the chart's locale: six
   significant digits, or two decimals when that keeps more (a large amount keeps its cents).
7. It sits beside the hovered point, on the end side of the reading direction, 12 px away; with no room there it goes
   to the start side; it stays inside the chart and never covers the hovered point.
8. It appears at once and follows the pointer; it goes as soon as the pointer leaves the plot.
9. Touch: a tap shows it for the nearest point, sliding the finger moves it, a tap outside the plot hides it. No
   hover on touch alone.
10. The tooltip is for the eyes only (`aria-hidden`): keyboard and screen-reader users get the same content by focus
    (keyboard.md, screen-reader.md).
11. Events: `pointHover` (series id, point index, and its key when it has one) when the point under the pointer
    changes, `null` when it leaves — the pointer's only, not the keyboard's (that is `pointFocus`);
    `pointClick` on a click or a tap on a point. With a shared tooltip, the hovered point is, of the points at that x,
    the one nearest the pointer.
12. A chart mixing lines and marks (columns and a line): the mark under the pointer (or in its band) gets its own
    tooltip; elsewhere the lines' shared one.
