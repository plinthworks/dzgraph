# Right to left

Designed in, not added (CLAUDE.md). Decisions D.10 (owner, 2026-11-21).

## What the user does
Opens a chart on a page written right to left (Arabic, Hebrew), or gives `dir: 'rtl'`.

## What they observe
1. The direction is the chart element's (`dir` attribute or CSS `direction`), unless `dir` is given.
2. Everything placed by reading direction swaps sides: the title's start, the legend's order and its `start` / `end`
   positions, the y axis (at the start: on the right), an `opposite` y axis (on the left).
3. The x axis is not mirrored by default: categories and time still run left to right, as in the most common usage
   for numbers and dates; `mirror: true` runs them right to left.
4. Bars grow from the start side (columns-bars.md 4).
5. Numbers and dates are written by the locale (Intl): digits, separators and their order are the locale's.
6. A label in the other direction (a Latin name in an Arabic chart) keeps its own direction inside its box.
