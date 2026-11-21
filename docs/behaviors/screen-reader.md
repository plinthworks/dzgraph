# Screen readers

Phase 2. Sources: WAI-ARIA 1.2 (graphics roles, list, figure), WCAG 2.2 (1.1.1, 1.3.1, 1.4.1, 4.1.2, 4.1.3).

## What the user does
Reaches the chart with a screen reader (VoiceOver, NVDA, JAWS), by Tab or in its browse mode.

## What they observe
1. The chart is a figure named by its title (or `description`), described by a summary written for it: its kind, its
   series and the range of each (« Graphique en lignes, 2 séries. Pommes : de 120 à 210 kg. Poires : de 80 à
   140 kg. Axe x : de janvier à décembre. »), then the app's `description` if given. Translated (en, fr).
2. Each visible series is a list named « Pommes, 12 points »; each point an item read as « Pommes, mars : 160 kg.
   Point 3 sur 12. » (keyboard.md moves the real focus between them).
3. A series of more than 500 points is not written out in full: one item per series stands for its focused point and
   is replaced on each move, so the new point is read; browse mode reads the series' summary.
4. Axes, gridlines, tick labels and the legend's signs are hidden from screen readers (their content is in the
   summary, the points and the data table); the legend's items are buttons (legend-interaction.md 2).
5. A polite live region says what changed by the user's hand: « Poires masquée », « Poires affichée ». Data updates
   are not announced.
