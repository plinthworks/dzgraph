# Crosshair

Phase 5a. ARCHITECTURE §14. GLOSSARY: Crosshair. The `crosshair` module, `crosshair: true` (or `{ horizontal: true }`).
Not on polar charts (owner 2026-11-22).

## What the user does
Reads values off the axes at any place of the plot.

## What they observe
1. Over the plot, a thin vertical line follows the pointer exactly (not snapped to points); with `horizontal: true` a
   horizontal one too. The lines are in the axis-line colour, dashed, under the tooltip and the hovered markers.
2. On the x axis, a tag at the line's foot gives the x value under the pointer, written as the tooltip's heading
   writes x (a time in the axis's zone, a category's name); with the horizontal line, each value axis has a tag with
   its value at the pointer's height, in the axis's format.
3. Tags are small raised boxes (background, border, text colours), kept inside the chart's edges, on the axis's side.
4. The shared tooltip and its snapped crosshair (hover-tooltip.md) still show: the snapped line marks the points read,
   the free line, dashed, where the pointer is.
5. Keyboard: on a focused point the lines go through it (snapped) and the tags give its values.
6. Touch: the lines follow the finger while it is down on the plot, as the tooltip does.
7. Leaving the plot (or the focus leaving the points) removes the lines and tags.
8. In measure and selection modes the crosshair stays: it helps aim.
9. Screen readers: nothing more is said; the values are the focused point's, already announced.
