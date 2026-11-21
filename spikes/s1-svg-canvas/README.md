# S1 — SVG or Canvas, and from when · S7 — Canvas limits at 1 and 10 million points

Run: `node spikes/s1-svg-canvas/run.mjs` (`SPIKE=s1|s7`, `BROWSERS=chrome,chrome-4x,firefox,webkit`, `FRAMES=60`).
Raw numbers: `results/result.json`. Measured 2026-11-21 on a Mac Studio M4 Max, headless, one browser at a time;
`chrome-4x` is Chrome with the CPU slowed four times (CDP), our stand-in for an average machine.

## Questions and decision rules (written before measuring)

- **S1**: the Canvas threshold is the smallest number of points where a frame takes over 16 ms in one browser,
  rounded down.
- **S7**: the WebGL2 painter (D.9) is written only if Canvas takes over 16 ms a frame for a decimated line or a dense
  scatter at 1 or 10 M points.

## Method

A bare stage (`lib/stage.ts`): one series, 1200 × 500 px, no axes. Each case runs 60 frames (after 8 warm-up frames)
of one action: **zoom** (between the whole series and its middle half: the series is redrawn each frame), **hover**
(a crosshair in an SVG overlay follows a moving x; the series is not redrawn), **resize** (width 800 ↔ 1200, redrawn).
A frame is the time between two `requestAnimationFrame` callbacks; « fluid » = 95th percentile ≤ 20 ms (no missed
60 Hz refresh). Renderers: `svg` (one `<path>` for a line, one `<circle>` per point for a scatter), `svg-dots` (a
scatter as one path of zero-length round-capped segments), `canvas` (`lineTo` / `fillRect` 3 × 3), `canvas-pixels`
(one device pixel per point, written into an `ImageData`). Data: a seeded random walk (line) and a two-blob cloud
(scatter).

## Results — S1 (undecimated: every point drawn), « fluid up to »

| Case | Chrome | Chrome ×4 | Firefox | WebKit |
|---|---|---|---|---|
| SVG line, zoom | 100 k | 20 k | 100 k | 100 k |
| Canvas line, zoom | 1 M | 200 k | 200 k | 200 k |
| SVG scatter (`<circle>`), zoom | 10 k | **2 k** | 5 k | 5 k |
| SVG scatter (one path), zoom | 100 k | 20 k | 10 k | 50 k |
| Canvas scatter, zoom | 100 k | 50 k | 100 k | 50 k |
| SVG scatter (`<circle>`), resize | 10 k | **2 k** | 5 k | 5 k |
| Hover over SVG line | 1 M | 1 M | 1 M | 100 k |
| Hover over a 1 M Canvas series | fluid everywhere |

## Results — S7 (zoom, median / p95 ms per frame)

| Case | Chrome | Chrome ×4 | Firefox | WebKit |
|---|---|---|---|---|
| Line 10 M, no decimation | 83 / 117 | 333 / 450 | 365 / 483 | 935 / 1236 |
| Line 10 M, M4 each frame | 17 / 33 | 67 / 83 | 33 / 50 | 17 / 19 |
| Line 10 M, M4 through a pyramid | **17 / 17** | **17 / 17** | **17 / 18** | **17 / 18** |
| Line 10 M, M4 pyramid, work per frame | 0.4 | 1.2 | 1 | 0 |
| Scatter 1 M, Canvas `fillRect` | 200 / 250 | 450 / 467 | 167 / 183 | 249 / 254 |
| Scatter 1 M, Canvas pixels | 17 / 17 | 17 / 17 | 17 / 18 | 17 / 37 |
| Scatter 10 M, Canvas pixels | 17 / 17 | 67 / 83 | 17 / 33 | 27 / 29 |

Pyramid build for 10 M points: first paint 100–390 ms (once, when the data arrives).

## Decisions proposed

1. **The renderer is chosen by marks drawn, not by points in the data.** A decimated line never draws more than
   about 4 × width points: SVG stays fluid for it at 10 M points of data. Lines and areas: **always decimated (M4
   through a pyramid), always SVG**.
2. **Canvas threshold: 2 000 marks** (markers, columns, bubbles) drawn by a series: the `<circle>` SVG scatter is the
   first to fail, at 5 k in Firefox and WebKit and 2 k on the slowed CPU. Rounded down per the rule.
3. **M4 through a min/max pyramid**, not M4 on every frame: 10 M points zoom at 60 fps everywhere, even slowed.
4. **Hover never redraws the series**: the crosshair lives in an SVG overlay; it is free in every case.
5. **S7 rule triggers for dense scatters**: drawn as real markers, Canvas fails from 1 M points (167–450 ms); as
   pixels it holds 1 M everywhere but not 10 M on the slowed CPU (67 ms) nor WebKit (27 ms). So a WebGL2 painter is
   justified **for scatters and bubbles above about 1 M points**, nothing else. It can share its foundations with the
   3D engine (D.18). Owner to decide when (1.0 or a 1.x wave).
