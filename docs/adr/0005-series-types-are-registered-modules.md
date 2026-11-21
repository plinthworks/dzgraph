# Series types and coordinate systems are registered modules

The core knows no series type or coordinate system by name: line, column, pie, treemap, polar, 3D… each is a module
the app passes to `chart()` (or imports through an all-in-one entry). The catalogue will grow wave by wave up to
Highcharts' breadth plus 3D and maps (D.17); a closed list in the core would make every wave a breaking change and
make every app pay for types it never draws.
