# Drilldown

Phase 5b. ARCHITECTURE §14. GLOSSARY: Drill, Level, Breadcrumb. The `drilldown` module; option `drilldown` on a
series: each point's detail by key (`{ details: { [key]: SeriesOptions[] } }`) or an app function
(`load(point) → Promise<SeriesOptions[]>`); on a time axis with `drilldown: 'time'`, automatic: year → month → day.

## What the user does
Clicks a column, a bar or a slice (or presses Enter on it) to see what it is made of; goes back up.

## What they observe
1. A point that has a detail is marked as such: the pointer becomes a hand over it, and its label for screen readers
   ends with « détail disponible ».
2. A click or Enter on it shows its detail: the chart's series are replaced by the detail's, which animate from the
   point (they grow out of it); the title gains the point's name.
3. Loading (an app's function): the point pulses lightly and the chart says « Chargement… » (live region); a failure
   shows a short translated message with « Réessayer » and keeps the level as it was; a load slower than 10 s is a
   failure. Never a value of the app in the message.
4. A breadcrumb appears above the plot (a navigation list): the root's name, then each level's point; each but the
   last is a link that goes back to that level. Backspace (and Alt + the arrow toward the reading direction's start: ← in LTR, → in RTL) goes up one level.
5. Going up restores the level as it was (its range, hidden series, selection).
6. Automatic time drill: a year axis (aggregated by year) drills into the months of the year clicked, then the days
   of the month (aggregation.md), the range set to that period; up restores the coarser period.
7. The level is part of the view (view-state.md): `getView()` gives the path of keys from the root, `setView()` goes
   there (loading what it needs). Event `drill` with the path.
8. In a link group the level is shared like the range (linked-charts.md).
