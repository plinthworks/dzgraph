# Lines and areas

## What the user does
Looks at a series drawn as a line or an area: a few points, thousands, millions; with gaps; with values that go
backwards along x.

## What they observe
1. The points are joined in x order by straight segments (smooth curves come in wave 1.1).
2. A gap (`null`, or a non-finite value) breaks the line; a point alone between two gaps is shown as a marker, else it
   would be invisible.
3. Markers show on every point when points are far enough apart to read them (fewer points than the plot's width ÷ 12
   px). A denser line keeps a marker about every 80 px, each series starting at its own offset, so it is told apart
   without colour (owner 2026-11-21). `marker: true` puts one on every point, `false` none.
4. Each series has its own marker symbol (circle, square, diamond, triangle, triangle pointing down, then again), so
   series are told apart without colour. Markers are 8 px, ringed by 2 px of the chart's background so they stand
   out on their own line and where lines cross.
5. The line is 2 px wide, drawn inside the plot area (clipped); markers on its edge show whole.
6. An area is a line with its surface filled down to zero (rule 1 of axes.md puts zero on the axis), translucent,
   with the line drawn on top; below zero, it fills up to zero.
7. More points than the plot has pixel columns: the line looks the same but is drawn from far fewer points (M4,
   ADR 0002; spike S3: the same line to the eye, every column's highest and lowest point kept). The tooltip and the
   data table always show the real points.
8. x values going backwards: the line is drawn in the order given (it may cross itself), without decimation, and the
   chart reports `unsorted-x` once for the series.
