# Gauge

Phase 4. Owner 2026-11-21: a solid half arc, the value in its centre, optional thresholds; no needle. A polar
coordinate system (ADR 0005).

## What the user does
Reads one value against its scale (a load, a score, a speed), and where it stands among thresholds.

## What they observe
1. `type: 'gauge'`, one value (`data: 72` or `[72]`), on a scale from `min` (default 0) to `max` (default 100).
   `min` not below `max` is reported (`invalid-option`) and the defaults are used.
2. A half ring, open downwards, centred in the plot and as large as it allows; its thickness a quarter of its
   radius. The track (the whole scale) is drawn in a neutral colour (`--dzgraph-track`); the part from `min` to the
   value in the series' colour.
3. It fills along the reading direction: from the left end in left to right, from the right end in right to left (as
   a progress bar does).
4. Under the arc's middle, the value, large, in the chart's locale (with the series' format); `min` and `max` under
   the arc's two ends, smaller.
5. A value past the scale fills the arc (or leaves it empty); the text shows the real value. No value (`null`): an
   empty track and « — ».
6. Thresholds (`thresholds: [{ from, to, label, color }]`): a thin ring just outside the arc, one segment per
   threshold. The label of the threshold the value falls in is written under the value (« Élevé »), so it is not told
   by colour alone. Their colours are colour names the app defines (`--dzgraph-color-<name>`), as for series.
7. Hover or tap on the arc: a tooltip with the name, the value, the scale, and the threshold.
8. Keyboard: one tab stop; it reads as the value, there is nothing to move between.
9. Screen readers: the gauge is a meter (WAI-ARIA `meter`) with its minimum, maximum and value, its text the
   formatted value and the threshold (« Charge : 72 %, entre 0 et 100. Élevé. »).
10. Data table: one row: name, value, minimum, maximum, threshold.
11. Appearing: the arc fills from `min` to the value (400 ms). Updating: from the old value to the new one, the text
    following.
12. No legend by default (the gauge's title names it). One gauge per chart in Phase 4; a second is reported
    (`invalid-option`) and left out.

## A richer gauge (owner 2026-11-24, before the site's batch 4)

Options, all optional; a gauge without them is drawn as above. The owner's example: a scale from −2000 to 2000, a tick
every 100, a number every 500, a blue zone from −2000 to −1500 and a green one from −500 to 500, each named.

13. `origin` (default `min`): where the fill starts. The fill runs from the origin to the value: a value under the
    origin fills towards `min`'s end, one above it towards `max`'s end (rule 3's direction kept). An origin outside the
    scale is reported (`invalid-option`, `series[i].origin`) and `min` is used. Appearing and updating grow the fill from
    the origin.
14. `ticks: { step, labels }`: a short tick across the arc's inner edge at every multiple of `step` within the scale
    (so 0 is a tick whenever the scale holds it), drawn inwards in the tick colour; a longer one at every multiple of
    `labels`, with its number, in the chart's locale and muted, just inside it. `labels` absent: no numbers but the
    scale's ends (rule 4). A `step` that is not a positive number, or that would draw more than 200 ticks, is reported
    (`series[i].ticks.step`) and no tick is drawn; a `labels` that is not a positive multiple of `step`
    (`series[i].ticks.labels`) gives no numbers. A number that would cover the value in the middle, or a number
    already placed, is left out. The scale's ends are always written (rule 4): under the arc's ends, unless a number on
    the ticks already writes that value (review 2026-11-26: `min: 5, max: 95` with a number every 10 wrote neither).
15. `thresholdsOn: 'ring' | 'track'` (default `'ring'`, rule 6). `'track'`: each threshold paints its part of the arc
    itself, the whole thickness, instead of the neutral track; the value is then a narrower arc, half the thickness,
    centred on the track and edged with the background, so the zones stay visible on both of its sides. Each zone's
    label is written outside the arc at its middle; a label that would overlap one already placed is left out (the
    value's own zone is still named under the value, rule 6). A threshold wholly outside the scale is not drawn, as a
    ring, a zone or a label (it still names a value past the scale, rule 6).
16. Thresholds that overlap are drawn in their order, the later over the earlier; the value's threshold is the first
    one holding it, as it always was (rule 6).
17. Screen readers, the data table and the tooltip say what they said (rules 7, 9, 10): ticks and zone labels are
    pictures of the scale and of the thresholds already told. An exported picture and print carry them (one scene).
18. Right to left: ticks, numbers and zone labels follow the arc's direction (rule 3); each text keeps its own
    direction.

## A gauge as a bar (owner 2026-11-24)

The owner wants the same gauge as a straight bar, across or upright: `shape` on the gauge, not a type of its own, so
every option above holds for both shapes.

19. `shape: 'arc' | 'bar'` (default `'arc'`). `'bar'`: the scale is a straight bar instead of a half ring. Scale,
    origin, ticks, thresholds and `thresholdsOn`, the value and its threshold named: as for the arc (rules 1, 4–6,
    13–16). Another word is reported (`invalid-option`, `series[i].shape`) and the arc is drawn.
20. `orientation: 'horizontal' | 'vertical'` (default `'horizontal'`), read for the bar only. Horizontal: `min` at the
    inline start (on the left in left to right, on the right in right to left, rule 3). Vertical: `min` at the bottom,
    as a thermometer, in both directions. Another word is reported (`series[i].orientation`) and the bar lies across.
21. The bar is 24 px thick, less when the box is too small, and as long as the box allows. Its track is neutral
    (`--dzgraph-track`), the value filled in the series' colour from the origin. With `thresholdsOn: 'ring'` the
    thresholds are a thin strip along the bar on the side away from the ticks; with `'track'` they paint the bar
    itself and the value is half its thickness, centred, edged with the background (rule 15).
22. Horizontal: the value large on top, its threshold's label under it; then the zone labels (with `'track'`), each
    over its zone's middle and kept inside the box; the bar; the ticks under it, pointing down, and their numbers
    under them. `min` and `max` are always written under the bar's ends, placed first, the numbers between them.
    Vertical: the value and its
    threshold's label on top, the bar under them down to the box's base; the ticks and their numbers on its inline-end
    side, the zone labels on its inline-start side; without numbers, `max` above the bar and `min` under it.
23. Numbers, or zone labels, that would overlap one already placed are left out (the later one). The scale's ends
    are placed before the numbers, so they always stay: across, under the bar's ends; upright with numbers, beside
    the bar's ends as the numbers are (review 2026-11-26).
24. Appearing and updating: the value grows from the origin (rule 13); the track, the zones and the ticks are there at
    once. Hover, keyboard, screen readers, tooltip and data table: as for the arc (rules 7–10, 17).

## Its thickness (owner 2026-11-25)

25. `thickness` (pixels): the arc's or the bar's thickness, instead of a quarter of the radius (rule 2) or 24 px
    (rule 21). When the box is too small for it, the arc keeps it up to its radius and the bar takes what room is
    left. Not a positive number: reported (`invalid-option`, `series[i].thickness`), the default drawn. Ticks, numbers,
    zones and the value on the track (half the thickness, rule 15) follow it. An arc so thick that its inner edge
    leaves no room for a long tick draws no ticks; a number that would not fit between the centre and its tick is
    left out, never drawn across the centre (review 2026-11-26); the scale's ends are then written (rule 14).

## Where DzGraph differs on purpose
- No needle (owner): a needle is read against the arc's edge, a filled arc is read at a glance.
- Rule 3: the fill follows the reading direction, as columns-bars.md 4 does for bars.
