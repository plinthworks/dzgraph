# Export as an image (PNG, SVG)

Phase 6. D.3 (home-made, no remote service), ADR 0001 (one scene, many outputs). The `exporting` module; owner's
decisions 2026-11-22 (`docs/phase-6-steps/plan.md`).

## What the user does
Takes the chart away as a picture: for a slide, a report, a message. The app does it through the API, the user
through the chart menu (« Télécharger »).

## What they observe
1. The picture is the view, as on screen: the visible range, hidden series left out, the selection, the comparison,
   the aggregation, the drill level — with the title, the subtitle, the axes and the legend.
2. Without the controls: no mode bar, menu button, zoom reset button, breadcrumb, navigator strip or range buttons;
   no hover, tooltip, crosshair, measure or focus ring. A picture shows the data, not the tools.
3. Colours as on screen (a dark page exports dark), unless the app asks for `theme: 'light'` or `'dark'`. Never a
   transparent background: the chart's background is painted.
4. At the chart's size on screen by default; `width` and `height` lay the chart out again at that size (labels,
   ticks and legend fit it), they do not stretch the picture.
5. PNG: sharp — drawn at `scale` device pixels per CSS pixel (default: the screen's, at least 2). Every mark is
   drawn, those the screen draws in Canvas or WebGL2 too; text in the page's fonts, once they are loaded.
6. SVG: a standalone document — colours and fonts written as values (it does not need the theme), `role="img"`, a
   `<title>` (the chart's title) and a `<desc>` (the summary screen readers hear), the language and the direction.
   Opened alone in a browser, it looks like the screen.
7. A dense scatter in SVG gives one element per point that can show in the plot (big-data.md 11): a big file; PNG is
   the format for it.
8. The file is named after the chart's title (letters with their marks, digits and hyphens kept; nothing else), else « chart »
   translated; the app may give `filename`. The extension follows the format.
9. Right to left: the picture is the screen's, mirrored the same way (direction.md).
10. A chart with nothing to draw exports what the screen shows (its title and « no data » message).
11. Without the `exporting` module, the export methods do nothing and report `missing-module`.
