# S2 — Measuring text

Run: `node spikes/s2-text/run.mjs` (needs `fonts/Verdana.ttf`, copied from macOS, not committed).

**Rule (written before):** the fastest of Canvas `measureText` and SVG `getComputedTextLength`, if within ±1 px of
the other; relayout on `document.fonts.ready`.

**Results** (1 000 axis labels: French numbers and dates, words, Arabic)

| | Chrome | Firefox | WebKit |
|---|---|---|---|
| Canvas `measureText` (ms) | 3–7 | 1–9 | 2–10 |
| SVG `getComputedTextLength` (ms) | 6 | 7–8 | 16 |
| Canvas vs SVG, max gap (px) | 0.014 | 0 | **1.8** |
| Canvas vs an HTML span (px) | 0.014 | 0 | 0.014 |

- Late font: 959 of 1 000 labels change width once it arrives. `document.fonts`' `loadingdone` event did **not**
  fire in any browser for a font added through `FontFace`.

**Decisions proposed**
1. Measure with Canvas `measureText` (as fast or faster everywhere, agrees with HTML text to 0.014 px), with a
   cache per font and text.
2. WebKit paints SVG text up to 1.8 px wider than it measures: label boxes get a 2 px safety margin (overlap
   checks, clipping).
3. Fonts: before the first layout, `document.fonts.check(font)`; if false, lay out with the fallback, then
   `document.fonts.load(font)` and lay out again. Never rely on `loadingdone`.
