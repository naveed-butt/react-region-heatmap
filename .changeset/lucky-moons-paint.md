---
"react-region-heatmap": minor
---

Add the `RegionHeatMap` renderer, which makes the package usable end to end for
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
