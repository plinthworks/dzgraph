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
  `docs/phase-3-steps/plan.md`). Phase 3 closed; staged, the commit waits for the owner (the permission check
  refused it). Owner 2026-11-21: Phase 4 next, Phase 3 bis (WebGL2) after it.

## 2026-11-22 — Phase 4 (modules, stacking, log scale, pie, donut, gauge), plan `docs/phase-4-steps/plan.md`

- **Step 1 done: features are imported modules (ADR 0006).** `chart(el, options, { types, features })`, `allFeatures`;
  `timeAxis`, `zoom`, `navigatorStrip` (brings `zoom`; not `navigator`, the browser's global), `canvas`. The core
  receives a kit (`kit.ts`: time, navigator) with the options and keeps it on the model; `missing-module` problem;
  `setRange()` needs no module. DOM: `features.ts`, `ZoomControls` (gestures + reset button), `NavigatorPart`
  (controls + range buttons). One-line app 37.3 → 30.6 KB gz; everything 39.1 KB (+0.9 KB for the seams). Budgets:
  apps lowered to measure + 5 %, dom raised to 15 850 (it holds every feature), new entry « every type and feature ».
  Found on the way by the hit property test (seed 855148467), a Phase 3 bug fixed: above a short column, more than a
  cell away, the hover missed it (the grid kept a column's band to its own height).
- **Step 2 done: the sheets** `stacking.md`, `log-scale.md`, `combined.md`, `pie-donut.md`, `gauge.md`; glossary:
  Stack, Share, Others, Threshold. Choices made on the way are listed in the plan's notes.
- **Step 3 done: stacking.** `stack: true | 'name'` on columns, bars and areas; `stacking: 'percent'` on a y axis.
  `stack.ts` computes the piles once per layout (`layout.stacks`): positives up, negatives down, gaps add nothing,
  areas by equal x. Columns: one slot per pile, 2 px between segments, only the pile's end rounded. Stacked areas:
  filled down to the layer below, never decimated. Tooltip: share and the pile's total; screen readers: « 25 % of 4 »,
  « Stacked column chart »; the table adds a total column per pile. Table rule changed on the way: columns share a
  row per x (a series of marks gets a row per point only when it repeats an x). Reference images: three new cases
  (160 images, 0 differ). Budgets: core 5 350, line app 33 800, all types 34 750.
- **Step 4 done: the log scale.** `scale: 'log'` drawn (the Phase 1 seam `not-available` for scales is gone):
  values ≤ 0 become gaps reported `non-positive-log-value` (count), bounds ≤ 0 `invalid-option`, no stacking on log.
  `logTicks` (ticks.ts): ends to powers of ten over a decade, to 1-2-5 within one; the densest tick set that fits
  (1–9, 1-2-5, powers, every 2nd/5th/10th power); `logScale` maps ≤ 0 to the axis's bottom, so columns and areas
  grow from there; labels each with their own decimals. Reference case `log` (168 images, 0 differ). Budget: the
  app with everything 43 850. 631 tests.
- **Step 5 done: combined charts and two value axes.** With two value axes in use, each shows its visible series'
  signs before its title (`AxisLayout.signs`, drawn in the axes layer); the summary names the kinds (« Combined
  chart: columns, areas, and lines ») and each series' axis; the table's headers add the axis's title. Lines, areas
  and scatters now follow the chart's orientation (a line in a bar chart runs down the categories); only columns and
  bars set it. 651 tests, 168 images (the `dual` case redrawn with its signs).
- **Step 6 done: the polar system (ADR 0007).** One coordinate system per chart (the first series'); `pie`, `donut`
  and `gauge` place themselves (`SeriesType.place` → a `Placement` kept in `layout.placements`: anchor, order, share,
  members, legend items, meter). Slices are points: the legend lists them and hides one by its point key in the view;
  « Autres » is the point one past the data. Arcs hit-tested from the scene; a slice pointed at comes 6 px out, the
  others fade; the keyboard goes round; the table gives shares (pie) or bounds and threshold (gauge, a WAI-ARIA
  `meter`). Theme tokens `--dzgraph-others`, `--dzgraph-track`. The import guard no longer reads `'from'` in a
  string as an import. Reference cases `pie`, `donut`, `gauge` (192 images, 0 differ). 730 tests. Budgets raised to
  measure + 5 % (line app 38 200: the polar, log and legend seams in layout, a11y and the words).
- **Step 7 done: Phase 4 closed.** Chrome, Firefox and WebKit: 1 173 tests. Architecture check: no series type named
  outside its module; a one-line app ships no polar code. Code review (9 findings, each a test that failed first,
  `review-phase4.test.ts`): a whole-turn slice drawn in SVG (two half arcs), « Autres » read by screen readers,
  unnamed slices named in the table, a gauge without value not « no data », a y gap on a log axis keeps its row, the
  meter's value within its bounds, slice labels and the gauge's note worded by the DOM's messages, a pile's tooltip
  ordered by where segments end, a pie hidden from the start keeps its legend item. 748 tests, 192 images.
  Seen once and not reproduced in 9 000 runs: the decimation property test (Phase 1 code, unchanged) failed in a gate.
- Next: the owner's commits (Phase 3 staged, Phase 4 unstaged), then Phase 3 bis (WebGL2).

## 2026-11-22 — Phase 3 bis (WebGL2 for dense scatters), plan `docs/phase-3bis-steps/plan.md`, ADR 0008

- Owner: « continue sans m'attendre ». Decisions taken alone, to review: ADR 0008, the WebGL threshold (100 000 points,
  measured; D.20 said ~1 M).
- **Steps 1–6 done.** A scatter past 2 000 points is one `points` primitive in data units (its columns, an affine map
  per direction, `Scale.affine`); SVG draws it as markers (only those in the plot), Canvas without an object per point
  (same pixels as markers), WebGL2 (`webgl` module, brings `canvas`) past 100 000. WebGL2: points on the card as int32
  steps + float32 rests (a float high/low split broke under Metal's fast math), symbols in the fragment shader,
  colours through the probe read back from a 1×1 Canvas, context opened on demand, freed on destroy, Canvas while it is
  lost. Hit test: a typed grid per batch. The benches found the slow part elsewhere: the data table (one merge in x
  order, a bounded heap for series out of order) and the value axis fit (buckets on x, `x-buckets.ts`). Measured:
  100 k on Canvas 19 → 3.4 ms a zoom frame; 1 M and 10 M on WebGL2 0.9 ms. Reference case `cloud` (200 images, 0
  differ). Gate green (785 tests); Chrome, Firefox, WebKit green (1 275). Budgets raised to measure + 5 % (dom 20 450,
  line app 40 250).
- **Step 7 done: Phase 3 bis closed.** Code review (agent): no serious defect; fixed with failing tests first — an
  int32 wrap in the shader (step now within 2²⁹), black drawn when no colour could be read (now nothing), and an older
  one: marks did not fade in as they appeared (opacity now interpolated). Architecture check: `chart.ts` reaches WebGL2
  only through its module; every output reads the batch (SVG, export, Canvas, WebGL2, hit, hover, animation); ADR 0006
  and the Angular wrapper mention `webgl`. Gate green (789), Chrome, Firefox, WebKit green (1 284), 200 images match.
  Leftovers at the end of the plan.
- Next: the owner's commits (Phase 3 staged; Phase 4 and 3 bis unstaged), review of ADR 0007, ADR 0008 and the WebGL
  threshold; then Phase 5 (exploration).

## 2026-11-22 — Phase 6 (export and printing), plan `docs/phase-6-steps/plan.md`

- Owner's decisions: the picture is the view without the controls; colours as on screen (printing always light);
  CSV universal by default, `exporting: { csv: { locale: true } }` for `;` and a decimal comma; menu entries and API.
- **Built and closed.** Module `exporting`: `exportSvg`, `exportPng`, `exportCsv`, `download`, `print`; core
  `exportScene`, `tableOf`, `csvOf`; theme print rules; `<dz-chart>`'s `chart`. Code review: 9 findings fixed (list
  in the plan). Budgets raised (core 11 340, dom 33 950, everything 80 480, theme 2 000). Next: Phase 7 (Angular
  complete, sparklines, DzTooltip and DzGrid bridges).

## 2026-11-22 — Phase 7 (Angular complete, sparklines, bridges), plan `docs/phase-7-steps/plan.md`

- Owner's decisions: sparklines outside grids only (DzGrid keeps its own in cells); grid ↔ chart: selection both ways,
  filter as an option; DzTooltip draws the points' tooltip; 7a then 7b, a review each.
- **7a built and closed.** `@dzgraph/core/sparkline`, `@dzgraph/dom/sparkline` (1.9 KB gz alone), theme
  `.dzgraph-sparkline`, `<dz-sparkline>`, `<dz-chart>`'s missing `drill` output, `npm run check:angular` (Angular 19.2,
  20.3, 21.2, 22.3 compile the built package). Review: 4 findings fixed. Gate green (1 051), three browsers green
  (1 806). Committed (`dc7c9fc`).
- **7b built.** The tooltip seam (`Feature.tooltip`, `TooltipDrawer`), `@dzgraph/dztooltip` (`dzTooltip(look)`),
  `@dzgraph/dzgrid` (`linkGrid`: selection both ways, filter on a named column by selection or range; DzGrid's row
  keys written as it writes them, tested against its `dataKey`). A Phase 1 bug of the SVG painter found and fixed.
  Gate green (1 069), three browsers green (1 848), 232 images match.
- **7b closed, Phase 7 closed.** Review: 7 findings fixed (list in the plan). Gate green (1 076), three browsers green
  (1 869). 7b committed. Next: Phase 8 (a chart from a DzGrid selection; full check; 1.0 preparation).

## 2026-11-23 — Phase 8 (a chart from DzGrid, full check, 1.0), plan `docs/phase-8-steps/plan.md`

- Owner's decisions: the block of cells, else the rows ticked, and the pivot; the chart where the app puts it,
  following live (snapshot as an option); a cell-menu item; WebGL threshold 100 000 (D.20 settled); 1.0 all ready,
  the owner publishes; the documentation site stays Phase 9. ARCHITECTURE D.24.
- **8a built.** `chartFromGrid`, `gridTable`, `chartMenuItem` in `@dzgraph/dzgrid` (sheet `chart-from-grid.md`); the
  bridge split into `link.ts` and `from-grid.ts`. Found on the way, from 7b: `linkGrid` did not accept a real DzGrid
  grid at compile time (DzGrid brands its row keys; another event carries a `selection` of another shape) — fixed,
  the link test now type-checks; the DzTooltip bridge measured 427 B against a 350 budget. The 7b close had misread
  its gate on these two. Budgets: DzTooltip bridge 450, DzGrid bridge 790, chart from DzGrid 1 360. Gate green
  (1 089, every stage read), three browsers green (1 908).
- **8a closed.** Code review (agent): 2 findings fixed, each a test that failed first — a yes/no column named the
  points « true »/« false » (now the grid's words, option `yesNo`); on a time axis the points kept the grid's sort
  (`unsorted-x`), now in time order. Gate green (1 091), three browsers green (1 914). Committed. Next: 8b (full
  check, API frozen, packages ready for 1.0.0).

- **8b built (2026-11-23).** API frozen: `scripts/api.mjs`, `api/*.api.txt` (six packages, 142 exports; reviewed —
  the scene contract stays public, the `animate` hook gives scenes), `check:api` in the gate. Release: `release:check`
  (pack, size, API, manifests, typings, source maps carrying their sources, Angular 19–22 compiling every entry and the
  bridges on a real DzGrid and DzTooltip from npm, no legacy-peer-deps), `publish:latest` / `publish:verify` for the
  owner. README (root and each package, examples type-checked), CHANGELOG 1.0.0, LICENSE, versions 1.0.0. Sheet audit
  (agent): about forty rules without a test — each tested now; four were false in the code and fixed (a label's own
  direction, a wide column's hover reach, every series hidden says « no data », Angular never draws on the server).
  Weakly covered rules listed in the plan. Gate green (1 161), three browsers green (2 040), 232 images (4 redone,
  looked at), benches as before.
- **8b closed, Phase 8 closed.** Review: 1 finding fixed (a column's hover reach capped only beside lines). Gate green
  (1 163), three browsers green (2 046), 232 images, release check green. Committed. Next: the owner publishes
  1.0.0 (`npm run publish:latest -- --otp=…`); then Phase 9 (documentation site).

## 2026-11-23 — Phase 9 (documentation site), plan `docs/phase-9-steps/plan.md`

- Owner's decisions: Astro Starlight as DzGrid's site, English and French, getting started → guides → one page per
  option → API reference, plus a gallery of live charts; GitHub Pages (`plinthworks.github.io/dzgraph`). ARCHITECTURE
  D.25.
- **Batch 1 (skeleton) done.** `website/`, both languages, the sidebar and its stubs, the home page and the getting
  started pages written, `LiveChart`, `CodeTabs`, the site's tests (every example compiled, twins, links), the workflow.
  37 pages built; Chrome en/fr light/dark: every demo drawn, no console message. Gate green (1 179). Committed.
- **Batch 2 (guides) done.** The 12 guides written in both languages (24 pages, 26 live demos), every example compiled.
  The demos found two bugs, fixed test first: a time axis with one value (a lone aggregated year) showed milliseconds
  — now centred a period (or a day) each side (axes.md 5), and a lone column no longer pads half a unit; a time drill
  into a year the data only begin moved the year back to fit the data — the period is now shown whole (drilldown.md 6).
  Also: the Angular README's `$event.point` (the output gives the `PointRef`), and two getting-started sentences
  (outputs' detail; `types`/`features` do not shrink the bundle: `DzChart` imports `allTypes`/`allFeatures` as defaults
  — owner to decide). An Angular test proves the guide's linking of two charts (a `read` callback after the charts'
  own) on Angular 21. Committed.
- **Batch 3 (one page per option) done.** 69 pages per language under `options/` (chart 20, series 10, series types
  8, axes 14, setup 4, features 13) and the overview. The facts come from the sources: `@default` and `@feature` tags
  in the option comments, `scripts/gen-options.mjs` → `website/src/generated/options.json`, shown by `<OptionFacts>`;
  `website/test/options.test.ts` (facts up to date, every option a page in both languages, every token worded), and
  `packages/dom/test/option-facts.test.ts` holds each `@feature` to the chart's own `missing-module`. That test found
  a series' `drilldown` without its feature ignored without a word: now reported (`series[i].drilldown`). A demo with
  the data table shown takes no fixed height (the table is inside the chart's element, past its height); the
  `dataTable` page says so. Chrome: 142 pages, every demo drawn, no console message, every link answers. Gate green
  (1 205). Committed.
- **The richer gauge (owner 2026-11-24, before batch 4).** The owner asked for a gauge from −2000 to 2000 with ticks,
  coloured zones on the arc and labels, and for clients to draw any chart. Decided: proposal A (ARCHITECTURE D.26):
  `origin`, `ticks: { step, labels }`, `thresholdsOn: 'ring' | 'track'`, all optional (gauge.md 13–18, written
  first); then, as a phase of its own, custom series types made public (an ADR to write). Done: 12 core tests first,
  the playground case `gauge-rich` and its 8 reference images (240 in all, green), the site's gauge page (both
  languages, a live demo of the owner's example), the facts regenerated. Core budget raised to its measure + 5 %
  (12 630 B). Then the bar (owner, same day): `shape: 'bar'` on the gauge, not a type of its own, and
  `orientation: 'horizontal' | 'vertical'` (gauge.md 19–24); 14 more core tests, the cases `gauge-bar` and
  `gauge-bar-upright` and their 16 reference images, two demos on the gauge page. Appearing now grows only a rect that
  draws a point. Core budget raised to its measure + 5 % (14 340 B). Then (owner 2026-11-25) `thickness` in pixels for both shapes
  (gauge.md 25), numbers on the arc no longer overlap one another (rule 14), and the gauge workshop: every part set
  with buttons, the options written live, on the site's gauge page and in the playground (`playground/workshop.html`),
  one module for both (`website/src/components/demo/gauge-workshop.ts`). Gate green (1 267). Committed (70ac02a).
- **Three choices left to Claude (owner 2026-11-25, « fais au mieux », ARCHITECTURE D.27).** `<dz-chart>` imports no
  type or feature: `provideDzGraph()` or the tag (angular.md 9); the time drill starts at the axis's own year or month
  (drilldown.md 6); `messages` merged word by word (words.md, new sheet). API changes accepted in `api/`. Site pages
  and the three Angular examples that leaned on the old defaults fixed. Committed (247ff97).
- **Batch 4 built (2026-11-25): API reference, gallery, `llms.txt`.** `scripts/gen-api.mjs` makes one page per package
  from `api/*.api.txt` (both languages, the declarations as accepted); the gallery: 20 live charts (every series type,
  the bar gauge, every way of exploring, one right to left), each linked to its page; `scripts/llms.mjs` makes
  `llms.txt` and `llms-full.txt` (getting started, guides, every option page, the facts as a line) at the root, the
  site serves both. Both taken from DzGrid's. The README and each package's README link to the site. Site tests 35
  (api, llms new), Chrome en light / fr dark: 20 demos drawn, no console message. Gate green (1 289). Committed.
- **Batch 5 built (2026-11-26): the close.** Review alone, then one browser at a time. Fixed, each rule in its sheet
  and a failing test first: the thick gauge's ticks and numbers past the centre (gauge.md 25), the scale's ends always
  written (14, 22, 23), a threshold outside the scale not drawn (15), 201 ticks let through, a word of the wrong kind
  (words.md 3), a lone column at x = 0 (axes.md 5: −1 to 1), a site demo drawn twice. `scripts/browser-site.mjs`: 186
  pages, 220 demos, console, 360 px, axe in Chrome; Chrome, Firefox, WebKit clean. axe found the sidebar's current page
  unreadable (`--tz-accent-fg` is DzGrid's, not ours: `--tz-bg`) and unnamed scrolling code blocks (code now wraps).
  Orphaned previews: Astro backgrounds itself under an agent; `--ignore-lock`. `llms.txt` not shipped in a package
  (owner). Budget "every type and feature" raised to 84 590 B. Gate green (1 308).
- **A real DzGrid example (owner 2026-11-27, « un vrai exemple pour utiliser dzgrid »).** The DzGrid guide's two demos
  were the chart side alone; now `<GridDemo>` (`website/src/components/demo/grid-demo.ts`) runs the page's code: a real
  DzGrid grid (its own theme, `@dzgrid/theme` 1.15 as a dev dependency) beside a real chart, `linkGrid()` (ticking a
  row selects its column, clicking a column ticks its row) and `chartFromGrid()` (the whole table the first block, the
  chart following the block the reader drags). English and French. Checked in Chrome (axe, 360 px), Firefox, WebKit;
  the link driven both ways. The page examples show `checkbox: true`.

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

## 2026-11-22 — Phase 5 (exploration), plan `docs/phase-5-steps/plan.md`

- Plan validated by the owner: a mode bar (Zoom, Selection, Measure), aggregation by type (sum for columns, mean for
  lines), polar charts select by click only, two halves 5a (view, crosshair, compare, measure, selection) and 5b
  (aggregation, drilldown, menu, linked charts).
- **5a steps 1–6 built (2026-11-22).** The view as JSON (`getView`, `setView`, `viewChange`; `invalid-view`), modules
  `crosshair`, `compare` (an affine per series composed with its axis's scale), `measure`, `selection` (rectangle,
  range, exact live lasso — 1 M points at 5.4 ms a move), the mode bar. Gate green (881), three browsers green
  (1 464), 224 reference images. Budgets raised (line app 45 000).
- **Phase 5a closed.** Code review: 8 findings fixed (list in the plan); `<dz-chart>` outputs for the new events.
  Gate green (894), three browsers green (1 488), 224 images. Next: Phase 5b (aggregation, drilldown, menu, links).
- **Phase 5b built and closed (2026-11-22).** Modules `aggregation` (periods on the zone's calendar, steps; selection
  both ways), `drilldown` (details by key or loaded, breadcrumb, Backspace, automatic year → month → day), `menu`
  (WAI-ARIA menu button: type, aggregation, scale, comparison), `linkCharts` (crosshair, range, selection, drill).
  Code review: 10 findings fixed (list in the plan). Gate green (937), three browsers green (1 554 → 1 587), 232
  images. Budgets raised (line app 48 800). Phase 5 closed; nothing of it committed yet. Next: Phase 6 (exports).
