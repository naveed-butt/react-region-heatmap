---
"react-region-heatmap": minor
---

Add the bundled United States map at `react-region-heatmap/maps/us`.

`getUsMap()` returns the 50 states keyed by postal code, in an Albers USA
projection with a `0 0 959 593` viewBox. `getUsMap({ includeDC: true })` adds
the District of Columbia as a clickable callout square offshore, or as its true
outline with `dcStyle: "outline"`. The same options always return the same
frozen object, so calling it inline in render doesn't rebuild the heat map's
scale on every render.

It ships as a separate entry point, so its ~30 KB of path data never reaches a
bundle that brings its own geometry.

Also fixes CommonJS type resolution: `require` consumers now get `.d.cts`
declarations instead of ESM ones.
