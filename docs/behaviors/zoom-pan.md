# Zoom and pan

Phase 3. Owner 2026-11-21: drag = zoom on x, Shift + drag = pan, the wheel scrolls the page (Ctrl/⌘ + wheel zooms),
pinch on touch.

## What the user does
Selects a part of a chart to see it closer, moves along it, goes back to the whole.

## What they observe
1. Dragging across the plot with a mouse or a pen draws a shaded band over the x range it covers; releasing zooms to
   it. A drag shorter than 5 px is a click.
2. Shift + drag, once zoomed, moves the visible range (the cursor says so).
3. The wheel scrolls the page as on any page; Ctrl (⌘ on a Mac) + wheel zooms in or out around the pointer.
4. On touch: pinching zooms around the fingers' middle; once zoomed, a one-finger slide across moves the range (not
   zoomed, it moves the tooltip, hover-tooltip.md 9).
5. Limits: never past the data's ends; never closer than two points across the plot (one millisecond for time).
6. Value axes fit the points in view (rounded, axes.md 2); a fixed bound stays fixed.
7. Zoomed, a « Réinitialiser le zoom » button appears at the end of the plot's top edge; it goes back to the whole
   (animated, animation.md 2), and disappears.
8. With the keyboard, on a focused point: + and − zoom around it, Shift + ← and → move the range, 0 goes back to the
   whole; the focus stays on a point in view.
9. Event `rangeChange` (the x axis's visible bounds; `null` back to the whole). The range is part of the view
   (GLOSSARY: Visible range, View).
10. On a category axis the range covers whole categories.
