# A chart made from what a DzGrid grid selects

Phase 8a. D.15 (DzGrid), ARCHITECTURE §14; owner 2026-11-23 (the block of cells, else the rows ticked, and the pivot;
the chart where the app puts it, following the selection live, a snapshot as an option). The `@dzgraph/dzgrid`
bridge reads the grid by structural types (its kernel, its `range()` and `pivot()` features): no import of DzGrid.

## What the user does
Selects a block of cells, or ticks rows, or turns a pivot on, and sees a chart of it beside the grid; changes the block
and sees the chart follow; picks « Chart » in the grid's cell menu when the app offers it.

## What they observe
1. `chartFromGrid(chart, grid, options)` fills a chart the app made (its element, its modules, its title) with what
   the grid selects, and returns the function that stops. The app's options other than `series` and `xAxis` stay.
2. **Where the data comes from**, the first that applies:
   - the grid's **pivot** is on (`pivot` given): its table for a chart — the groups as categories, one series per
     created column of one value (`pivotValue`, `pivotLevel`; DzGrid's `series()`);
   - a **block of cells** (`range` given, two cells at least): its data rows, its columns;
   - **rows ticked** (an include selection): those rows the grid shows, in its order, every visible column;
   - nothing: the chart keeps what it shows (a press outside the grid drops its block: the chart must not empty
     when the user moves to it). The first fill with nothing: no series.
3. **Columns**: in reading order. Among the columns before the first number column, the first text, choice, yes/no,
   day or date-time column names the points: a date-time column (an
   instant) puts them on a time axis in the grid's zone (`timeZone`, DzGrid's default UTC), a day column on a time
   axis at their midnight — in time order on that axis, whatever the grid's sort — any other column on a category
   axis with the text the grid shows (for a yes/no column, the grid's words given as `yesNo`). No such column: the
   points are evenly spaced. Each number column is a series, named by its header, its id `grid:<column>`; other
   columns are left out. No number column: no series.
4. Values are what the grid shows (its edits included, never its formatting): a blank or a value the column refuses
   is a gap. A point's key is its row's id, so `linkGrid` and a selection by key find it.
5. **Type**: `type` given, else a line on a time axis and columns otherwise (pivot: columns). The user's choice in the
   chart's menu (menu.md) wins, as it is the view's.
6. **Following** (default; `follow: false` takes one snapshot): the chart is filled again after the user changes the
   block or the rows ticked, the rows change (data, sort, filter, an edit), the columns change or the pivot is
   rebuilt — once a frame at most, so a drag over cells redraws once a frame. A block set by code refills it too; rows
   ticked by code (source `api`, as `linkGrid` ticks them) do not: `linkGrid` beside it would otherwise shrink the chart
   to the points selected in it.
7. Stopping ends the following; the chart keeps its last series.
8. A menu entry: `chartMenuItem(label, open)` is an item for DzGrid's cell menu (`items`) that calls the app with the
   cell's context; the label is the app's, translated.
9. Health data: values and labels reach the chart only (its tooltip, table, export); never a `Problem` or an event.

## Not done (said)
- The grid's group rows (grouping without pivot) count for nothing: their data rows are read.
- A column of another type (sparkline, custom) is left out.
- A selection of « every row but these » (select all on server pages) is read as nothing: rows never loaded cannot
  be drawn.
