# S3 — M4 vs LTTB on 1 and 10 million points

Run: `node spikes/s3-decimation/run.mjs`; by eye: `node spikes/s3-decimation/look.mjs` (writes `results/full.png`,
`results/m4.png`). Measured 2026-11-21, Chrome, Firefox, WebKit.

**Rule (written before):** M4 by default if it is faithful to 0 pixels and faster; LTTB stays an option.

**Method:** a seeded random walk with rare jumps, drawn on a 1200 × 400 Canvas (1 px antialiased stroke) in full and
decimated, over the whole series, 10 % and 0.1 % of it. Metrics: pixels differing in shade, pixels lost (dark in the
full drawing, blank in the decimated one), per-column envelope gap, time.

**Results**

| 10 M points, whole series | M4 | M4 pyramid | LTTB 2/px | LTTB 4/px |
|---|---|---|---|---|
| Time (Chrome / Firefox / WebKit, ms) | 24 / 36 / 22 | **0.1 / 0.2 / 0.4** | 22 / 20 / 13 | 16 / 19 / 14 |
| Pixels lost (of ~17 000 inked) | 839 | 632 | 747 | 483 |

- At one point per pixel or less (0.1 % window, 1 M), every method gives the same image: 0 pixel lost.
- At many points per pixel, no method is pixel-exact with an **antialiased** stroke: the full drawing's thousands of
  strokes spill half a pixel into the neighbouring columns; any decimation keeps fewer of these spills. The paper's
  0-pixel guarantee is for aliased (Bresenham) lines. M4 with 2 or 4 sub-columns per pixel reduces the lost pixels
  (839 → 135) but not the envelope gap: it is the halo, not the shape.
- **By eye** (`results/*.png`, 1 M points): the same line, the same spikes; M4's is a hair thinner.

**Decision proposed:** M4 through the min/max pyramid by default (as fast as nothing, faithful to the eye, keeps every
column's extremes by construction); LTTB as an option for those who prefer smoothness to extremes. The rule's
« 0 pixel » cannot be met by any decimation with antialiased strokes; the eye test replaces it.
