# DzGraph — context for Claude Code

A professional charting library (Highcharts level) written from scratch in TypeScript: a pure core that turns options
and data into a scene, a DOM layer that draws the scene in SVG or Canvas and handles the user, a theme of CSS
variables, an Angular wrapper, and bridges to DzTooltip and DzGrid. Highcharts is the reference for **behaviour
only** — read `CLEANROOM.md` before anything else. Sister projects, whose conventions we follow: DzGrid
(`/Users/nadou/Dev/dzgrid`), DzTooltip (`/Users/nadou/Dev/dztooltip`), tzslot (`/Users/nadou/Dev/tzslot`),
DzCalendar (`/Users/nadou/Dev/dzcalendar`). Never copy anything from `/Users/nadou/Dev/dz-grid-migration/`.

## Where things are

- `ARCHITECTURE.md` — the full plan (packages, modules, signatures, phases). The owner's validated decisions sit at
  its top and win over the rest.
- `packages/core` — `@dzgraph/core`: no DOM, no `Date`, no Temporal, no dependency, no clock, no randomness; `Intl`
  is allowed. Options and data in, a `Scene` (pixels, primitives) out. Text is measured through an injected function.
- `packages/dom` — `@dzgraph/dom`: `chart(el, options)`; SVG and Canvas painters of the same scene, pointer,
  keyboard, legend, tooltip, zoom, animation, export.
- `packages/theme` — `@dzgraph/theme`: SCSS source, built CSS, `--tz-*` shared palette and `--dzgraph-*` own.
- `packages/angular`, `packages/dztooltip`, `packages/dzgrid` — the wrapper and the two bridges.
- Calendar days (`Day`, `YYYY-MM-DD`) and instants (`InstantMs`) are distinct types and never converted into each
  other without a zone. An offset-less date-time string is `ambiguous-instant`, never guessed.
- `docs/behaviors/` — one sheet per imitated behaviour, in our own words, written **before** the code (clean room).
- `spikes/` — Phase 0 questions, each with a decision rule; results in `ARCHITECTURE.md` §12.

## Commands

```bash
npm test             # vitest: core in node and in Chrome, dom in Chrome, theme, tools (the guards)
npm run test:ci      # one worker — catches state shared between files
npm run test:tz      # the suite in Auckland and Los Angeles
npm run test:browsers  # core and dom tests in Chrome, Firefox, WebKit, one after another (phase close, release)
npm run typecheck    # core (lib ES2023, no DOM), dom, then the tests
npm run build        # packages/*/dist; refuses a manifest pointing at src/ and any runtime dependency
npm run check:size   # bundled, minified, gzipped, against size-budget.json (null = recorded only)
npm run gate:step    # every batch's gate: test:ci, test:tz, typecheck, build, check:size
npm run spike        # Phase 0 spikes in real browsers, one after another
```

`npm install` needs `legacy-peer-deps` (set in `.npmrc`). The guards live in `scripts/guards/` and are tested in
`scripts/test/` against planted violations: purity of the core, colours, literal text (DOM layer), logical sides
(`x` is a coordinate, not a side), HTML sinks, invisible characters, the package graph, banned words, test casts.

## Working rules (inherited from DzGrid and DzTooltip)

- **Validate structural decisions with the owner before coding.** Talk to the owner in French, short and plain.
- Every change: a test that fails first, then the fix. Test expectations are written by hand, never copied from the
  output. A test's `as never` / `as any` carries a comment saying why.
- Bad input never throws: it becomes a `Problem` (code + path + raw detail; sentences belong to the DOM layer's
  translated messages). A `Problem` never carries the app's data — a chart may plot health records.
- One scene, many outputs: screen (SVG, Canvas), export (SVG, PNG), print and the data table all come from the same
  computed model. A review checks a new rule reached each of them.
- Logical sides only (`start`/`end`, `inline-*`, `block-*`), never left/right outside the one direction module.
  Right to left is designed in, not added.
- Colours only as CSS variables (`--tz-*` shared, `--dzgraph-*` own); no colour literal in code or SCSS; the Canvas
  painter resolves the variables. Contrast 4.5:1 (text) and 3:1 (marks) checked by script. Colour is never the only
  way to tell series apart.
- Sizes and timings measured, never asserted: minified and gzipped, on a quiet machine.
- **Tests in real browsers wherever possible** (owner, 2026-11-21): no jsdom. The DOM layer's tests run in vitest's
  browser mode (system Chrome; Firefox and WebKit with `test:browsers`), the core's in node and in Chrome. Pixels
  (reference images) through `playwright-core`. One browser at a time.
- Spend little: small fixes directly, not by an agent; reviews only for new code; during work run only the tests
  concerned; one full gate per batch. Every phase ends with an architecture check and a code review.
- Commit or publish only when the owner asks; the owner publishes. The repository is local only for now.
