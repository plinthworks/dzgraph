# Scatter plots

## What the user does
Looks at points placed by two values; a few, thousands, a million.

## What they observe
1. Both axes are value axes fitted to the data, rounded to ticks (axes.md 2–3); zero is not forced in.
2. Each point is a marker, 8 px by default, the series' symbol (line-area.md 4), slightly translucent so that piles of
   points read as darker.
3. A point with a gap in either value is left out (a value that is not a number is reported once per series, as
   for every type; `null` is the app's own gap and is not).
4. Past 2 000 markers the series is painted on a Canvas; past about a million, with WebGL2 (D.20) — same look.
