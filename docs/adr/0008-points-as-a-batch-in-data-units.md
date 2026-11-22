# Dense scatters: one batch of points in data units, drawn by our own WebGL2

Phase 3 measured a scatter of 100 000 points on Canvas at 19 ms a frame while zooming (budget 16.7 ms), and spike S7
showed Canvas cannot draw a million. Most of that time was not drawing: the core built one `marker` primitive per
point, each with its scene id string, then the hit grid one object per point — every frame.

- **A `points` primitive.** Past the Canvas threshold (2 000 marks) a scatter gives one primitive for all its points:
  the series' own columns (no copy, gaps left in), the symbol, the size, the paint, and for each screen direction an
  affine map (`pixel = r0 + (v − d0) · k`, `v` the value or its log10 on a log axis). The scene stays a description
  in pixels — the map is exact — but its size no longer grows with the data, and a frame of zoom builds nothing.
  Every output reads it: SVG (one path per batch, screen and export), Canvas (one loop, no allocation), WebGL2, the
  hit test (a typed grid built once per scene, lazily), the animation (the map interpolated so every point moves in
  a straight line). Scales give their affine map (`Scale.affine`).
- **WebGL2 past a second threshold**, 100 000 points (`WEBGL_THRESHOLD`), for groups made only of `points`. Set by the
  benches (2026-11-22): with the batch, Canvas draws 100 000 points in about 3 ms of script a frame, 200 000 already
  miss frames while zooming; WebGL2 stays under 1 ms a frame up to 10 million. Not lower, because a page allows only
  about sixteen WebGL contexts. The
  core names the painter; the DOM falls back to Canvas (then SVG) when the `webgl` module is missing, WebGL2 is not
  there or its context is lost. In each layer the core orders WebGL2 groups, then Canvas, then SVG; the screen stacks
  its planes the same way, the export draws in that order.
- **The points stay on the card in data units**, so a frame only sends the maps. Each value is split into a whole
  number of steps (int32) and a rest (float32), the step a power of two per column putting its largest value within
  2²⁹ steps (an origin clamped to 2³⁰ then never wraps an int32); the shader subtracts the map's origin from each part — integers from integers — then scales. That keeps
  the pixel exact at any zoom (time in milliseconds needs 41 bits, a float has 24). A split into two floats (high and
  low) was tried first and failed on a Mac: Metal compiles shaders with fast math, which reorders float sums and lost
  the low part; an integer subtraction cannot be reordered with floats. Buffers are kept per batch and sent again when
  a column is read again (a new `x`; an app's `y` is forgotten when read, `column-cache.ts`).
- **Our own painter, no library** (ADR 0003): one context per chart, opened only when a WebGL2 group first comes, freed
  on destroy (`WEBGL_lose_context`); a lost context falls back to Canvas and comes back when restored. Symbols are drawn
  in the fragment shader from their distance to the shape's edge, with one device pixel of antialiasing; colours are
  the theme's, resolved through the same probe as Canvas and read back as bytes from a 1×1 Canvas, so any CSS colour
  (light-dark, color-mix, forced colours) works.

- **What a frame reads stays small too.** The benches found the rest of a frame scanning every point: the data table
  (a row object per point, then a sort — 0.5 s for 1 M) and the value axis fitting the points in view. The table now
  merges every series in x order and takes from a series out of order only its first 1 000 points, kept in a bounded
  heap, and its count; the value axis reads buckets on x built once per column (`x-buckets.ts`), scanning only the two
  at the range's ends.

## Measured (Chrome, 2026-11-22, `npm run bench`)

Script per frame while zooming, median: 1 M points 0.9 ms, 10 M points 0.9 ms (first drawing 400 ms); Phase 3 drew
100 000 on Canvas at 19 ms, now 3.4 ms. Hovering 10 M points after a zoom builds the hit grid once: 26 ms at the 95th
percentile.

## Considered options

- Pixels computed by the core into a Float32Array each frame: simpler, the scene literally pixels, but a million
  points cost the core ~5 ms and the upload as much each frame; ten million would not hold.
- One primitive per point with WebGL2 only for drawing: keeps the per-frame cost that made Canvas slow.
- Instancing quads instead of point sprites: sizes past the hardware's point limit, but our markers are 8 px; point
  sprites are simpler and every WebGL2 allows at least 1 px — we check `ALIASED_POINT_SIZE_RANGE` and fall back.
