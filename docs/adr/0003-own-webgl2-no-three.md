# Our own WebGL2, no Three.js

WebGL2 is used only where Canvas measurably fails (dense scatters, S7) and for 3D (`@dzgraph/3d`), through our own
small painter with no dependency. Three.js was considered (owner, 2026-11-20/21): it is a 3D scene engine with no
charting, weak text, 1-px lines, a heavy dependency, and one WebGL context per chart, which a grid of sparklines
cannot afford. Axis text and hover stay in SVG over the WebGL layer.
