# @dzgraph/theme

The charts' colours and fonts, as CSS variables: `--tz-*` (the palette shared with DzGrid, DzTooltip, tzslot,
DzCalendar) and `--dzgraph-*` (DzGraph's own). Load it once:

```js
import '@dzgraph/theme/dzgraph.css'; // or dzgraph.unlayered.css when the app's reset is unlayered
```

Without it a chart draws its geometry but no colours: every colour is a variable (no colour is written in code).

## The series palette

Eight colours in a fixed order. The order and the steps were validated (2026-11-21) with a colour-blind simulation:
worst adjacent CVD ΔE 8.4 light and dark (target ≥ 8, OKLab ×100), worst adjacent normal-vision ΔE 19.3 (floor 15),
and every colour at least 3:1 on the chart's surface in both modes (`scripts/test/theme.test.ts` holds the contrast).
The light steps of aqua, yellow and magenta are the darker ones so they clear 3:1 on white. Past eight series the
colours start again; each series keeps its own marker symbol, so identity never rests on colour alone.

Documentation: [plinthworks.github.io/dzgraph](https://plinthworks.github.io/dzgraph/guides/theming-rtl/).
