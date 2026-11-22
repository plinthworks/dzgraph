# Big data

Phase 3 (Canvas); Phase 3 bis (WebGL2, D.20). ADR 0002; spikes S1, S3, S5, S7, S8.

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
6. From about a million scatter points, WebGL2 draws them (Phase 3 bis).
