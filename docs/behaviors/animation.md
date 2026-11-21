# Animation

Phase 2. Owner 2026-11-21: on by default and sober; none under `prefers-reduced-motion`; `animation: false` turns it
off.

## What the user does
Opens a chart; changes its data or options; clicks a legend item; resizes the window.

## What they observe
1. Appearing (400 ms, easing out): lines and areas are revealed from the start of the x axis (a clip that widens);
   columns and bars grow from their baseline (a scale from it); markers and scatter points fade in. Axes, labels and
   the legend are there at once.
2. Updating (250 ms): what stays moves from where it was to where it goes (positions, sizes and paths of the same
   shape are interpolated; paths of a different shape fade from one to the other); what comes appears from the
   baseline; what goes fades out.
3. A legend click animates like an update.
4. A resize does not animate: the chart is redrawn at once.
5. `prefers-reduced-motion: reduce`, or `animation: false`: no animation at all, the end state at once.
6. An app may drive the animation itself (`animate` hook, e.g. GSAP): it receives both states and a function to draw
   any state between them.

## Where DzGraph differs on purpose
- Updates change shapes themselves (an SVG path's points, a column's height), not only transform and opacity: values
  that move cannot be shown otherwise. The appearing animation uses transform, opacity and a clip only.
