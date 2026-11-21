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
- **Next: Phase 2** (interactions: hover, shared tooltip, legend clicks, keyboard, screen reader, data table,
  animation, a minimal Angular `<dz-chart>`): its plan to write and have validated before code.

## Working rules

CLAUDE.md. Talk to the owner in French, short. Owner 2026-11-21: « je veux du code craft », « donne-moi la meilleure
des choses, on a le temps », « tu continues, ne t'arrête pas » (work through the steps, report at each). Nothing is
committed yet: commit only when the owner asks.

## Waiting for the owner

- S6 listening (screen reader patterns A and B).
- Size budgets (after Phase 1): measured one line chart 17.0 KB gz in an app, every Phase 1 type 17.7 KB, theme 0.7 KB.
- axes.md 5: a single column of 5 now gives an axis 0–5 (the sheet said 0–6).
- The identity of dense lines without colour (Phase 2 question in the plan).
- The dataviz method flags two things we chose otherwise, to confirm: dual value axes (D.2 keeps them; the method
  calls them the first chart mistake) and square column ends (columns-bars.md 7; the method rounds the free end by
  4 px).
