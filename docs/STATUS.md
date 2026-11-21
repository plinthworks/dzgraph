# Where DzGraph stands

Read this first after a lost session. Then `ARCHITECTURE.md` (decisions D.1–D.22 at its top win over the rest),
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
  `docs/phase-2-steps/plan.md`). Gate green (432), three browsers green (654), references match. Not committed.
- **Next: Phase 3** (time axes with zones, big volumes, Canvas painter, zoom and pan, navigator, range buttons): plan
  to write and validate first. Open question for the owner: the data table shows the visible range, or all data?

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
