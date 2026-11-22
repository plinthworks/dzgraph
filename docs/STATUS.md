# Where DzGraph stands

Read this first after a lost session. Then `ARCHITECTURE.md` (decisions D.1–D.23 at its top win over the rest),
`GLOSSARY.md`, `docs/adr/`, `docs/behaviors/`.

## 2026-11-21 — Phase 1 (the base) closed

- **Phase 0** (spikes S1–S8, `spikes/`): measured; decisions validated by the owner (ARCHITECTURE §12). S6 (screen
  reader listening) waits for the owner: `node spikes/s6-screen-reader/serve.mjs`, see its README.
- **Phase 1**, plan `docs/phase-1-steps/plan.md`, steps 1.1–1.10 done:
  - tooling and guards (`scripts/guards/`, tested against planted violations); tests in real browsers (owner: no
    jsdom; `npm run test:browsers` for Chrome, Firefox, WebKit);
  - public types (reviewed by an agent, 17 findings fixed); behaviour sheets; options and data checking (never
    throws, no data in a Problem — property tests); scales, ticks (the sheet's rule, not Talbot: see the plan), Intl
    formats; layout (passes until sizes settle; property tests found and fixed 7 real defects); five series types and
    exact M4 decimation over a min/max pyramid (10 M points: 66 ms once, ~1 ms a frame); the scene, its SVG (shared by
    the DOM painter and the standalone export); `chart()`; the theme (8 series colours validated for colour-blind
    separation and contrast); the playground (`npm run playground`, port 4750) and 80 reference images
    (`npm run test:reference`, `-- --update` after looking at them).
  - Sizes: see « Waiting for the owner » (measured after the close). Budgets to be set by the owner
    (`size-budget.json`, null = recorded).
- **Step 1.11, closed 2026-11-21**: a code review (14 findings, all fixed, `packages/*/test/review-phase1.test.ts`) and
  an architecture check (seams added now: `not-available` problems, `View` and `isShown`, `chart()` reading options
  only when they change and keeping the last scene, the `Painter` interface, `allTypes`; documents brought in line;
  what belongs to later phases listed at the end of `docs/phase-1-steps/plan.md`). Gate green (345 tests), three
  browsers green (462), 80 reference images match.
- **Phase 2** (plan `docs/phase-2-steps/plan.md`, owner's decisions at its end), steps 2.1–2.8 built 2026-11-21:
  seven behaviour sheets; core `hit.ts`, `tooltip.ts`, `a11y.ts`, `interpolate.ts` (+ `appearFrom`), view emphasis;
  DOM hover and tooltip, legend buttons and live region, keyboard (pattern B, one tab stop, long series as one
  replaced item), figure and summary, data table, animator (appear 400 ms, updates 250 ms, reduced motion, `animate`
  hook); `@dzgraph/angular` `<dz-chart>` (Angular tests compiled and run in the real browsers). Gate green (410),
  three browsers green (600), reference images with hover, focus and hidden states. Budgets raised (dom 9 300,
  line chart app 26 400, theme 1 150).
- **Phase 2 closed 2026-11-21**: code review (12 findings fixed, `packages/dom/test/review-phase2.test.ts`; the worst:
  every redraw dropped the keyboard focus) and architecture check (fixed now: `pointAt`, `navigate.ts` in the core,
  `highlight` out of the view and renamed from `emphasis`, keys on events, `pointHover` for the pointer only,
  `setSeriesVisible`, aids rebuilt only with the layout, `table.ts`, raw `dataRows`; later phases' items at the end of
  `docs/phase-2-steps/plan.md`). Gate green (432), three browsers green (654), references match. Committed and pushed (`526b271`).
- **Phase 3 in progress** (plan and owner decisions: `docs/phase-3-steps/plan.md`; the table question settled by D.23).
  Done, uncommitted: 3.1 sheets (time-axis, zoom-pan, navigator, range-buttons, big-data); 3.2 time in the core
  (`time.ts`: wall clock through Intl, ISO reading, ticks on the wall clock, two-tier labels, `formatInstant`; tested
  in node, three browsers, Auckland and Los Angeles); 3.3 visible range as data (`zoom.ts`, `View.range`, value axes
  fit the points in view through `rangeMinMax` on the pyramid, categories zoom by whole bands) and `hitMark` through a
  per-scene grid (property against the old scan); 3.4 Canvas painter (`canvas-painter.ts`, shared `geometry.ts`,
  three planes: back SVG for background and grid, Canvas, main SVG first in the document with `z-index: 1`; theme
  colours read through `.dzgraph-probe`); reference cases `crowd` (5 000 points on Canvas) and `time` (128 images).
  3.5 zoom and pan in the DOM (`gestures.ts`: drag, Shift + drag, Ctrl/⌘ + wheel, pinch, one-finger pan once zoomed,
  + / − / 0 / Shift + arrows on a focused point; reset button; `rangeChange`; the click ending a drag is not a point
  click; tested in three browsers). Budgets raised (dom 12600, apps 34100 / 34950, theme 1280).
  3.6 navigator (`navigator: true`; core `navigator.ts`: strip layout, drawing, `rangeButtonSpan` on the zone's
  calendar; DOM `navigator.ts`: handles, window, click to centre, two keyboard sliders), range buttons (shown with the
  navigator on a time axis, or `rangeButtons: true`; disabled when longer than the data; `aria-pressed`), the table
  following the visible range with its caption and a button for all data (D.23; `dataTable: { show, range }`),
  `chart.setRange()`; second-tier time labels kept inside the chart. Gate green (514), references 136. Budgets
  raised again (dom 14500, apps 37850 / 38700, theme 1390).
  3.7 benches (`npm run bench`, `bench/`; Chrome, one run; script time per frame, budget 16.7 ms), first run then
  after fixes (2026-11-21): line 10M first draw 6.3 s → 355 ms, zoom 501 → 2.1 ms (median), pan 212 → 2.1 ms;
  time 1M with navigator zoom 73 → 8.9 ms; scatter 100k on Canvas zoom 58 → 19 ms (over budget: Phase 3 bis);
  hover ≤ 0.3 ms everywhere. Fixes: `dataRows` merged with a limit and a total (property against the old reading),
  `extentOf` kept per model, column bounds and pyramids kept per column and forgotten when an app column is read
  again (`column-cache.ts`; it also fixes a stale pyramid after an in-place write, a Phase 1 bug), summary from
  cached bounds, aids (summary, points, table) written once a gesture rests (200 ms), container measured only on
  resize, `sceneId` fast path, Canvas styles set only when they change.
  Close: code review (12 findings) and architecture check done, fixes with failing tests first (list at the end of
  `docs/phase-3-steps/plan.md`). Phase 3 closed, uncommitted. Next: Phase 3 bis (WebGL2). Open question for the
  owner: opt-in feature modules (ADR 0006) at the start of Phase 4.

## Working rules

CLAUDE.md. Talk to the owner in French, short. Owner 2026-11-21: « je veux du code craft », « donne-moi la meilleure
des choses, on a le temps », « tu continues, ne t'arrête pas » (work through the steps, report at each). Commit and push only when
the owner asks. On GitHub since 2026-11-21 (`git@github.com:plinthworks/dzgraph.git`, `main`; first push: Phase 1).

## Owner decisions after the close (2026-11-21)

- Budgets: measure + 5 % (`size-budget.json`); « tu peux augmenter la taille, pas besoin de ma validation » — raise when
  needed, say so. Core raised 4 500 → 4 900 the same day (rounded ends, sparse markers, `allTypes`).
- Dense lines: sparse markers about every 80 px (line-area.md 3); markers 8 px with a 2 px background ring.
- A single column of 5: axis 0–5. Columns' free end rounded 4 px. Dual value axes kept.
- Reference images: threshold tightened to 0.02 % of pixels (0.2 % let real changes pass).
- Not reproduced: one failure of the decimation property in a browser run (log not kept); 27 000 browser cases and
  80 000 node cases passed since. If it returns, fast-check prints the seed: replay it.

## Waiting for the owner

- S6 listening (screen reader patterns A and B): `node spikes/s6-screen-reader/serve.mjs`.
