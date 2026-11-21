# Angular: `<dz-chart>`

Phase 2, minimal; complete in Phase 7 (D.13).

## What the developer does
Writes `<dz-chart [options]="options()" [types]="types" (pointClick)="…" />` in a standalone component.

## What they observe
1. The chart takes its host's size (the host is a block; its height comes from the app's CSS, D.11, or the
   `aspectRatio` option).
2. `options` is an input read as a signal: a new value updates the chart (`update`), never re-creates it.
3. One output per event (`problems`, `pointHover`, `pointClick`, `pointFocus`, `legendToggle`).
4. Destroying the component destroys the chart (nothing left behind).
5. On the server (SSR) nothing is drawn and nothing fails; the chart is drawn in the browser.
6. Angular 19 to 22.
