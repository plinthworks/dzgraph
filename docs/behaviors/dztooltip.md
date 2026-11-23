# The points' tooltip drawn by DzTooltip

Phase 7b. D.4 (the `@dzgraph/dztooltip` bridge); owner 2026-11-22 (DzTooltip draws the points' tooltip; the buttons'
names stay the chart's). DzTooltip's own sheet (`tooltips-popovers.md`, rule 38: a virtual anchor — « a chart's mark »)
says how a bubble behaves; this one says what the chart hands it.

## What the user does
Points at a point, or moves the keyboard focus onto one, and reads its tooltip — in the page's DzTooltip look.

## What they observe
1. `chart(el, options, { features: [dzTooltip({ tone, placement, animation, shape, … })] })`: the points' tooltip is a
   DzTooltip bubble, with that look (DzTooltip's `TipLook`); without the bridge, the chart's own card (hover-tooltip.md).
2. **What it says** is the chart's, unchanged: the heading, a row per series with its sign, name and value, shares,
   totals, notes (hover-tooltip.md 5–6, stacking.md 14, compare.md 4, aggregation.md 3) — in the chart's language and
   direction, the series' colours from the theme.
3. **When** is the chart's: shown at once on the point under the pointer or the focus, moved from point to point,
   hidden when the pointer leaves the plot, on Escape (keyboard.md 4), and on a tap outside (hover-tooltip.md 9).
   DzTooltip's hover delays do not apply (there is no element to rest on): the bubble follows the chart. DzTooltip's
   own rule holds too: a scroll of the page hides it (the next point pointed at or focused shows it again, the same
   one too). An Escape is the chart's to decide (keyboard.md 4): one pressed elsewhere in the page, or one that only
   cleared a measure or a selection, leaves the bubble.
4b. The pointer moving over the same point changes nothing in the bubble (no new placing, no animation restarted);
   the page moving the chart (a reflow, a resize) moves the bubble with it.
4. **Where**: beside the point (its mark's centre, or a column's top), DzTooltip placing it (`placement`, default
   `top`), flipping and shifting to stay in the window, following the point as the pointer moves.
5. **Screen readers**: as without the bridge — the bubble is for the eyes only; the focused point's label and the live
   region say the same (screen-reader.md). One tooltip on screen at a time with the page's other DzTooltip tooltips.
6. **Peer**: `@dztooltip/core` 1.x, imported by the bridge only: a chart without the bridge ships none of it.
7. Destroying the chart hides and removes its bubble.
