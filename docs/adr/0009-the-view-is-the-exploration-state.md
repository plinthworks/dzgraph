# The view is the one exploration state

Phase 5 adds comparison, selection, then drill levels and aggregation to what Phases 1–3 kept as the view (hidden
series, visible ranges). Each could have been its own state with its own getter and event; an app that saves an
exploration, puts it in a URL or links charts would then gather and replay several, in the right order.

- **One view.** Everything the user changed while exploring, and nothing else, is the chart's `View` in the core: the
  layout, the scene, the tooltip, the table and the aids read it, never DOM state. The mode and a measure in progress
  are not exploration results and stay out (view-state.md 6).
- **Two forms.** Inside, the view is made for speed: sets, and a selection as one bitmap per series (a million points
  selected by a lasso is a million bits, not a million keys). Outside, `getView()` gives plain JSON and `setView()`
  takes it back: series ids, x bounds, and points by key where the app gave keys, else by index (view-state.md 5).
  Converting is the core's (`view.ts`), so every output and every wrapper reads the same.
- **One event.** `viewChange` carries the whole view, what changed and who changed it; a gesture's frames give one
  event once it rests. Linked charts (Phase 5b) are built on it: a chart applies a peer's view through `setView`.
- **A view is input.** `setView` validates as options are validated: what it names that does not exist is left out and
  reported (`invalid-view`), never thrown, and no app value is ever put in a `Problem`.
- **Modules, as features.** Comparison, crosshair, measure and selection are features (ADR 0006): the core's part of
  comparison comes as a kit with the options; the view's fields exist in every chart, as the visible range does, so a
  saved view stays valid whatever modules an app later imports.

## Considered options

- Separate states per feature (`getSelection`, `getRange`…): simpler at first, but every saver and every link would
  replay them one by one and in order.
- Selection by keys only (GLOSSARY: Selection): keys are the stable identity, but many series have none; indices are
  used there, and the JSON form says which.
