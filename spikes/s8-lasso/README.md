# S8 — Lasso and rectangle selection over a million points

Run: `node spikes/s8-lasso/run.mjs`. A 240-move lasso gesture around a dense cloud (points already in pixels).

**Rule (written before):** under 16 ms per move; otherwise a grid of cells and the exact selection on release only.

**Results** (per move, median / p95 ms; same count of selected points for both methods)

| | Chrome | Firefox | WebKit |
|---|---|---|---|
| 100 k, every point tested | 8 / 22 | 8 / 20 | 5 / 11 |
| 100 k, grid 128 × 128 | **2 / 3** | **2 / 3** | **1 / 2** |
| 1 M, every point tested | 82 / 219 | 75 / 193 | 45 / 113 |
| 1 M, grid | 17 / 22 | 15 / 20 | 9 / 11 |
| 1 M, rectangle | 4 / 7 | 4 / 7 | 5 / 7 |

Grid build: 2–4 ms when the gesture starts.

**Decision proposed:** the grid always (cells untouched by the lasso's edges are wholly in or out). At 1 M points it
is just over budget in Chrome and Firefox, so per the rule: during the gesture, a preview by cells (and only the new
edge's cells re-tested); the exact selection on release. Rectangles are exact live at 1 M.
