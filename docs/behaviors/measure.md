# Measure

Phase 5a. ARCHITECTURE §14. GLOSSARY: Measure. The `measure` module; the « Mesure » mode (modes.md). Not on polar
charts.

## What the user does
Reads the difference between two points: how much, how many percent, how long.

## What they observe
1. In measure mode, pressing on the plot picks the point nearest the pointer (as hover does: a line's point at that x,
   a mark within 24 px); dragging, the end follows the pointer and snaps to the nearest point; releasing keeps the
   measure on screen.
2. A line joins the two points, a marker on each; a tag at its middle, kept inside the plot, gives the difference in
   value (signed, the axis's format), in percent of the start (signed; none when the start is 0) and along x (a
   duration on a time axis, « 3 j 4 h », else a signed number; nothing on a category axis but the count of
   categories).
3. Two points of different series may be measured; their values are each series' (the comparison's, if on).
4. The measure goes with Escape, a click on the plot outside it, a new measure, a change of mode, or new data; zooming
   or panning keeps it, placed on its points.
5. Keyboard: on a focused point, M starts a measure there; moving the focus (arrows, other series) moves its end; M
   again keeps it, Escape removes it. The live region reads it when kept: « Écart : +12,5 (+8 %), en 3 jours ».
6. Touch: in measure mode, a finger's slide measures as a drag does.
7. Event `measure` with the two points (series id, index, key); `null` when it goes. Not part of the view.
