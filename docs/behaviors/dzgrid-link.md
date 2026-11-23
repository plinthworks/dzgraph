# A chart linked to a DzGrid grid

Phase 7b. D.15 (linked charts, with DzGrid too), ARCHITECTURE §14; owner 2026-11-22 (selection both ways by default,
filter as an option). The `@dzgraph/dzgrid` bridge describes the grid by structural types (its kernel's commands and
events): no import of DzGrid, any DzGrid 1.x fits.

## What the user does
Selects points in the chart and sees their rows selected in the grid beside it, or selects rows and sees their points
stand out; optionally, narrows the grid to what the chart selects or shows.

## What they observe
1. `linkGrid(chart, grid, options)` links them and returns the function that unlinks. A point and a row match by key:
   the point's `key` (data items' `key`) is the row's key (DzGrid's `getRowId`).
2. **Selection, both ways** (default; `selection: false` turns it off): the chart's selection (selection.md) becomes
   the grid's, replacing it; the grid's selection becomes the chart's (the points with those keys, in every series).
   Neither echoes back: a change the link made is not linked again. Needs the chart's `selection` module.
3. A grid's « every row but these » selection (select all on server pages) is not carried to the chart: the chart is
   left as it is (it cannot know rows it was never given).
4. **Filter** (`filter: { column, by }`): DzGrid has no filter of its own for a host, so the link sets the filter of
   one column of the grid, the user's filters on the other columns still applying:
   - `by: 'selection'`: the rows whose `column` value is one of the selected points' keys (a set filter); none
     selected: no filter;
   - `by: 'range'`: the rows whose `column` value is in the chart's visible range (zoom-pan.md) — a number filter, or
     with `as: 'instant'` a date-time filter (ISO instants); the whole data: no filter. Set once a zoom or a pan rests
     (not at every frame: a server's grid asks once), and at once when the chart is zoomed already at link time.

   While linked, the link owns that column's filter: it replaces what was there. The filter comes before the
   selection, so a grid that clears its selection when filtered (`keepOnFilter: false`) still gets the chart's; with
   `by: 'range'` on such a grid, a zoom clears both selections (the grid's rule, followed by the chart).
5. A key one side does not have is skipped, never an error; rows the grid does not hold yet (server pages) are
   selected when they come, as DzGrid keeps a selection by key.
6. Unlinking stops both ways and lifts the link's filter — only if it is still the link's (a filter the user set on
   that column since stays). A chart destroyed stops telling the link.
7. Screen readers: each side says its own change as it does without the link.
