# The painter is chosen by marks drawn, not by points in the data

Lines and areas are always decimated (M4 over a min/max pyramid) and always drawn in SVG, whatever the size of the
data; a series switches to Canvas above 2 000 drawn marks (markers, columns, bubbles), and dense scatters (about 1 M
points) to WebGL2. A reader expects « big data means Canvas »; spikes S1, S3 and S7 (2026-11-21) showed a decimated line
never draws more than about four points per pixel column, stays fluid in SVG at 10 M points of data, and keeps SVG's
crisp text, CSS theming and accessibility.

## Granularity and order (2026-11-21, Phase 1 architecture check)

- The choice is made per set of marks of a series (`compose.ts` `painterFor`): a line's path stays in SVG while its
  markers may move to Canvas; columns past 2 000 move whole.
- Constraint for the Canvas painter (Phase 3): a Canvas sits under the SVG layers, so within a layer the groups a
  scene gives to Canvas must come before its SVG groups, and a series' marks never straddle painters within one
  layer. The Phase 3 design keeps these two rules or replaces them with one Canvas per layer.

## Considered options

- Canvas for every series over N points: loses SVG's qualities for no measured gain on lines.
- LTTB as the default decimation: smoother, but may drop a column's extreme; kept as an option.
