# react-region-heatmap

## 0.1.0

### Minor Changes

- 926d422: Add the bundled United States map at `react-region-heatmap/maps/us`.
  
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
- fbb40e0: Add the `RegionHeatMap` renderer, which makes the package usable end to end for
  the first time.
  
  - Paints one SVG path per region, joining `data` to `map.regions` by id and
    resolving fills through the existing scale and colour engines.
  - Distinguishes regions measured as zero from regions absent from the data, via
    `zeroColor` and `missingColor`.
  - Keyboard accessible: a roving tabindex puts the map in the tab order once
    rather than once per region, with arrow keys, Home and End moving between
    regions and Enter or Space activating one.
  - Optional legend and tooltip, both overridable through `renderTooltip`,
    `formatValue` and `legendLabel`.
  - `interactive={false}` renders a listener-free static map for print and
    prerendering.
  - Server-render safe: no DOM access outside event handlers, and no element ids,
    so two maps on one page cannot collide.
  
  Also exports `resolveView` and `resolveData`, so callers who want a different
  renderer can reuse the whole join-scale-colour pipeline without React.
- 232cdb9: Add the scale and colour engines: `buildScale` with linear, quantile,
  thresholds and cumulative-percentage `zones` strategies, and `deriveRamp` for
  generating an N-shade ramp from a single brand colour in OKLCH.
