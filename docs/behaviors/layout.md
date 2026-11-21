# Layout

## What the user does
Puts a chart in a box of any size, with or without a title and a legend; resizes the box; opens the page before its
font has arrived.

## What they observe
1. The chart fills its box. Its height is the box's height (D.11), never its content's; a box without a height of its
   own uses `aspectRatio` (default 16 ÷ 9) from its width.
2. Space is given in this order, from the outside in: an 8 px margin; the title and subtitle; the legend; the axes
   (their labels, then their titles); the plot area gets what remains.
3. The title starts at the start of the reading direction (`align` changes it), on up to two lines, then « … ». The
   subtitle is smaller, under it, one line.
4. The plot area always keeps at least 40 % of the chart's width and height. What gives way, in order: labels
   beside an upright axis end in « … »; the legend cuts its last rows (its last item ends with « … », Phase 2 pages
   it); then axis titles, the whole legend, the chart's title; then the labels of second axes, then every label (the
   tick marks stay).
5. Too small to show a plot (under 120 × 80 px): only the plot is drawn, without axes, title or legend.
6. A resize lays the chart out again on the next frame, once, however many resize events came.
7. Text is measured before it is placed; a font arriving late lays the chart out once more when it is there (spike S2).
8. Lines and edges are crisp at every device pixel ratio: one-pixel lines on pixel centres, rectangles on whole pixels.

## Where DzGraph differs on purpose
- Rule 1: the height never follows the content (DzGrid's rule, owner): a chart does not jump when its data changes.
