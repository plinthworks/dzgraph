# Aggregation

Phase 5b. ARCHITECTURE §14, D.16. GLOSSARY: Aggregation, Period, Bucket. The `aggregation` module; option `aggregate`
on the x axis: a period on a time axis (`'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'`) or `{ step }` on a
numeric one; each series' `aggregate` function. The view holds the user's choice (menu.md), which wins over the
option. Owner 2026-11-22: by default, a sum for columns and bars (quantities), a mean for lines and areas (levels).

## What the user does
Sees many points as fewer: one per month, per week, or per range of values.

## What they observe
1. Each series is drawn as one point per period (or bucket): its x the period's start on the zone's calendar (a week
   starts on Monday, ISO), its value the series' function of the points in it — `sum`, `mean`, `min`, `max`, `count`.
   Default: `sum` for columns and bars, `mean` for lines, areas and scatters.
2. A period without points is a gap, not a zero (a line breaks there; a column is missing).
3. The axis keeps its own ticks; each point stands at its period's start; the tooltip's heading names the period
   (« mars 2026 », « semaine du 2 mars », « 10 – 20 »), and adds how many points it holds.
4. The table lists the aggregated rows, the visible range's when zoomed (D.23).
5. Selecting an aggregated point selects every point of the app it holds (GLOSSARY: Selection); a point of the app
   selected shows its period's point selected.
6. Stacked series aggregate before they stack; a comparison compares the aggregated values.
7. Without values to aggregate (polar charts, category axes), the option is reported (`invalid-option`) and ignored.
8. Changing the aggregation animates as an update (animation.md 2). Screen readers: the summary says « par mois,
   moyenne » and each point's label names its period.
