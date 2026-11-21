# The legend, clicked

Phase 2. Extends legend.md (drawn in Phase 1).

## What the user does
Clicks a legend item, or reaches it with Tab and presses Enter or Space; points at an item.

## What they observe
1. A click hides the series, a second shows it again (GLOSSARY: Hidden series: a view state, not an option). Its item
   greys; the axes are worked out again without it; the change animates (animation.md).
2. Each item is a toggle button in the tab order, after the chart's points, named by the series' name; it says
   whether the series is shown (pressed = shown). Enter and Space toggle it.
3. Pointing at an item, or focusing it, fades the other series to 35 % (hover-tooltip.md 5).
4. Hiding every series is allowed: the plot says there is nothing to show (axes.md 6).
5. Event `legendToggle` (series id, shown).
6. In right to left, items run from the right, as drawn (direction.md 2).
