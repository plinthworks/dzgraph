# S5 — Canvas under SVG: pixel alignment

Run: `node spikes/s5-align/run.mjs`. The same gridlines, columns and line drawn by SVG then by Canvas (backing store =
box × DPR), screenshot, compared pixel by pixel; DPR 1, 1.5, 2; box width 1200 and 1201; start offset 10 and 10.5 px.

**Rule (written before):** no visible gap; otherwise the whole series goes to Canvas, hover included.

**Results** (share of inked pixels differing; centre-of-mass shift in px)

- Box on whole CSS pixels: **identical** at DPR 1 and 2 everywhere; at DPR 1.5 with an odd width, shifts of 0.15–0.24 px.
- Box at a half CSS pixel (10.5 px): Chrome stays ≤ 0.13 px; **Firefox and WebKit shift up to 0.9–1 px** at DPR 1.5
  and 2 (6–11 % of pixels differ): the browser resamples the Canvas when its box is not on the device-pixel grid.

**Decision proposed:** keep the hybrid, and snap the Canvas to device pixels: read the box's position and size in
device pixels, size the backing store to whole device pixels, offset the Canvas by the fraction and draw with the
same fraction. Phase 3 reruns this harness as a regression check on the real painter. If snapping does not reach
« no visible gap » in Firefox and WebKit, the rule applies (that series moves wholly to Canvas).
