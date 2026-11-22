# The view as state

Phase 5a. ADR 0009. GLOSSARY: View, Exploration.

## What the user does
Explores (hides series, zooms, compares, selects); the app saves that exploration, puts it in a URL, brings it back.

## What they observe
1. Everything the user changed while exploring, and only that, is the chart's view: hidden series and slices, the
   visible range, the comparison, the selection (Phase 5b adds the drill level and the aggregation). The options are
   never changed by exploring.
2. `chart.getView()` gives it as plain JSON (the comparison only when the user chose one: the options' stays theirs) (no Set, no typed array, no function): `JSON.stringify` and back gives the
   same view. It holds none of the app's values — only series ids, point keys or indices, and x bounds.
3. `chart.setView(view)` brings it back. What it names that no longer exists (a series gone, a key not in the data)
   is left out and reported (`invalid-view`, path and no value); a view that is not an object is reported whole. It
   never throws.
4. Event `viewChange` after each change, with the whole view and what changed (`hidden`, `range`, `compare`,
   `selection`) and who changed it (`user` or `app`). A gesture's frames give one event once it rests (as the aids).
5. Points are named by their key when the app gave keys to that series, else by their index; a view with keys
   survives new data that moves points around, a view with indices does not.
6. The mode (zoom, selection, measure) and a measure in progress are not part of the view: they are how the user is
   working, not what they found.
