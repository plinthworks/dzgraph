# Linked charts

Phase 5b. ARCHITECTURE §14. GLOSSARY: Link group. `linkCharts(charts, { crosshair, zoom, selection, drill })` from
`@dzgraph/dom` (no module: a link is a function of charts).

## What the user does
Explores one chart and sees the others follow: the same instant pointed at, the same range, the same points chosen.

## What they observe
1. `crosshair: true`: pointing at an x in one chart shows the crosshair (and the tooltip) at the same x in the others,
   when they have it; leaving clears them all. By x value, never by pixel.
2. `zoom: 'x'`: zooming or panning one sets the same visible range on the others (each kept inside its data).
3. `selection: 'key'` (or `'x'`): selecting in one selects in the others the points with the same keys (or the same
   x values).
4. `drill: true`: going down or up in one does the same in the others when they have that detail.
5. No loop: a chart told by the group does not tell the group again; the link returns a function that unlinks.
6. A chart destroyed leaves its groups by itself.
