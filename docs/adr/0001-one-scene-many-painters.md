# One scene, many painters

The pure core turns options and data into a **scene** (pixels and primitives, colours as variable names, text
measured through an injected function); SVG, Canvas and WebGL2 painters, the SVG and PNG exports and printing all draw
that same scene. We chose this over painting straight from the options in each renderer so that a rule (a tick, a
margin, a colour) is computed once and reaches every output, and so the core runs and is tested without a DOM.

## Consequences

- The scene's shape is a contract between the core and every painter: changing it touches all of them.
- Text measurement is a dependency of layout: tests use a fixed-width fake, the DOM layer uses Canvas `measureText`.
