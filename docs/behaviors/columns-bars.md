# Columns and bars

## What the user does
Looks at values per category as columns (upright) or bars (across); several series side by side; negative values;
very small values; many categories.

## What they observe
1. Each category has a band along the axis; the series' columns stand side by side in it, in series order along the
   reading direction. A fifth of the band is left empty around each group, a tenth of a column's width between columns.
2. Columns start at zero (axes.md 1): positive ones rise, negative ones go down, from a stronger zero line.
3. A value that is not zero is at least 1 px high, so it never vanishes; zero draws no column. A column is cut where
   the plot ends (an axis whose bounds leave part of it out), never drawn over the axes.
4. Bars are columns turned across (one orientation per chart): categories run down from the top, values grow along
   the reading direction from the start side.
5. Hidden series give their room back: the remaining columns share the band (Phase 2 animates it).
6. So many categories that a column would be thinner than 1 px: columns stay 1 px wide and may touch; past 2 000 drawn
   columns they are painted on a Canvas (ADR 0002), with the same look.
7. The free end of a column is rounded by 4 px (less when the column is thinner or shorter), its base stays straight
   on the zero line (owner 2026-11-21). A column the plot cuts is not rounded where it is cut.

## Where DzGraph differs on purpose
- Rule 4: in right to left, bars grow from the right (the start side), as text does.
