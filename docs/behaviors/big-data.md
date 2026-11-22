# Big data

Phase 3 (Canvas); Phase 3 bis (WebGL2, D.20). ADR 0002; spikes S1, S3, S5, S7, S8.
The Canvas plane comes with the `canvas` module (ADR 0006); without it every series is drawn in SVG, the same picture.

## What the user does
Draws, hovers, zooms and pans series of hundreds of thousands to millions of points.

## What they observe
1. Lines and areas of any length look the same as drawn in full and stay crisp: decimated (M4 over a pyramid) and
   drawn in SVG.
2. A series drawing more than 2 000 marks (markers, columns) is painted on a Canvas, under the axes and labels,
   looking the same: same colours, same sizes, aligned to the pixel (S5).
3. Hovering a dense scatter finds the nearest point at once (a grid of cells, S8).
4. Zooming and panning 10 million points of a line stays fluid (60 images a second on an average machine), measured
   by the benches (`npm run bench`).
5. New data in a typed column is read without a copy.
6. A scatter of many points (past 100 000, the WebGL threshold, set by the benches) is drawn by WebGL2 with the `webgl` module
   (ADR 0008), looking the same as on Canvas: same colours read from the theme, same symbols and sizes, the same
   translucency (piles read darker), on the device-pixel grid, under the axes and labels.
7. Zooming and panning such a scatter costs almost no script: the points stay on the graphics card in data units;
   a frame changes where they go, not the points. Their position stays exact to the pixel however deep the zoom,
   time values included (milliseconds since 1970).
8. Hovering one finds the nearest point within 24 px, as with fewer points; the focus ring and the tooltip are the
   same.
9. Without WebGL2 (an old browser, too many charts on the page, the graphics card lost), the same picture is drawn
   on Canvas, without anything said to the user; when the card comes back, WebGL2 draws again. Without the `canvas`
   module either, in SVG.
10. A chart that does not need WebGL2 never opens a WebGL context (a browser allows only about sixteen per page);
    a chart destroyed frees its context at once.
11. The export (SVG), and SVG on screen without the `canvas` module, draw a dense scatter's points one element each,
    as the screen does (piles read darker there too), but only those that can show in the plot: a zoomed export is
    the size of what it shows.
