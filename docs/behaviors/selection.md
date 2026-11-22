# Selection

Phase 5a. ARCHITECTURE §14, D.21. GLOSSARY: Selection, Lasso. The `selection` module; option `selection: true` or
`{ shapes: ['rectangle', 'range', 'lasso'] }`; the « Sélection » mode (modes.md).

## What the user does
Picks points to look at, to send to another view (a grid, another chart), or to leave out of attention.

## What they observe
1. In selection mode a drag selects with the current shape. By default: a range of x on charts whose series share
   their tooltip (lines, areas), a rectangle on charts of marks (scatters, columns, bars); `shapes` lists those the
   app offers, and with more than one the mode's button opens a choice of shape (rectangle, range, lasso).
2. Rectangle: the points whose drawn place is inside it. Range: every point whose x is within it, whatever its y; the
   range shows as a band over the plot's height. Lasso: a free outline, closed from the last place back to the first;
   the points inside it (even-odd), exactly, live while drawing, even at a million points (D.21).
3. A drag replaces the selection; with Shift it adds, with Alt it removes. A click on a point selects it alone, Shift
   + click adds or removes it; a click on empty plot clears the selection. Escape clears it.
4. Selected points keep their colour; the others fade to 35 % (as a highlight does, but it lasts). On a line, the
   segments between selected points stay full and the selected points get a marker. A column, a bar or a slice
   selected gets a 2 px ring in the focus colour too, so the selection is not told by colour alone.
5. Keyboard: Space selects or unselects the focused point; Shift + ← → extends the selection from the last point
   chosen to the focused one along its series; Escape clears.
6. Screen readers: a selected point's label ends with « sélectionné »; the live region says how many points are
   selected after each change (« 12 points sélectionnés »); the summary says it too.
7. The table marks selected rows with a « Sélection » column (✓), shown only while there is a selection.
8. The selection is data, not pixels: it survives zoom, pan, resize, and hiding a series (a hidden series' selected
   points come back selected). New data drops the points that are no longer there (by key, or by index).
9. Event `selectionChange` with its count and, per series, the indices and keys selected. Never in a `Problem`.
10. A selected point of a dense scatter (WebGL2, Canvas) is drawn full over its faded cloud.
11. Hidden series are not selectable; their points are left out of a gesture.
12. Polar charts (owner 2026-11-22): a click on a slice selects it, Shift + click adds, Space on the focused slice;
    no rectangle, range or lasso, no mode bar.
