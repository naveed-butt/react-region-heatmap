# react-region-heatmap

Zero-dependency React choropleth heat map for **any** set of SVG regions.

Bring your own geometry — US states, Canadian provinces, sales territories,
warehouse zones — or use the bundled US map. No D3, no MUI, no CSS file, no
runtime dependencies at all. React is the only peer.

[![CI](https://github.com/naveed-butt/react-region-heatmap/actions/workflows/ci.yml/badge.svg)](https://github.com/naveed-butt/react-region-heatmap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> **Status: pre-release (`0.0.0`), not yet published to npm.**
> Everything documented below is implemented and tested, including the bundled
> US map. The first release will be `0.1.0`. Follow
> [the milestones](https://github.com/naveed-butt/react-region-heatmap/milestones)
> for progress.

## Why

Most choropleth components either drag in a mapping stack (D3, topojson) or a
component library, and most hard-code one country. This one does neither. It
takes a list of `{ id, name, path }` regions and a list of `{ id, value }`
data points, and paints one against the other.

- **No runtime dependencies.** Inline styles and CSS custom properties only.
- **Server-render safe.** No DOM constructors at module scope; works with
  static export and prerendering.
- **Any geometry.** The US map is one opt-in preset, not a built-in assumption.
- **Colour from one input.** Give it a brand colour; it derives a perceptually
  even ramp in OKLCH.
- **Keyboard accessible.** Regions are focusable and navigable, not mouse-only.

## Install

```bash
npm install react-region-heatmap
```

## Quick start

```tsx
import { RegionHeatMap } from "react-region-heatmap"
import { getUsMap } from "react-region-heatmap/maps/us"

const map = getUsMap()

export const LeadsMap = () => (
	<RegionHeatMap
		map={map}
		data={[
			{ id: "TX", value: 268 },
			{ id: "CA", value: 214 },
			{ id: "NY", value: 163 },
			{ id: "MT", value: 0 }
		]}
		primaryColor="#2f558f"
		zeroColor="#f0913e"
	/>
)
```

## Colour

Pass a single `primaryColor` and the ramp is derived from it — lightness
interpolated in OKLCH so no two adjacent shades collapse together while another
pair jumps, which is the usual failure of naive HSL ramps.

```tsx
<RegionHeatMap primaryColor="#2f558f" steps={5} />   // derived ramp
<RegionHeatMap ramp={["#e3ecf9", "#bcd3ef", "#8fb2e0", "#5f88c6", "#2f558f"]} />
```

`colorMode="dark"` flips the direction of travel. Contrast against the page —
not darkness — is what encodes volume, so on a dark canvas the densest regions
are the _lightest_ ones.

**Zero and missing are different.** `zeroColor` paints regions whose value is
exactly `0`; `missingColor` paints regions absent from the data entirely. It
defaults to `zeroColor`, so if the distinction does not matter to you, ignore it.

## Zones

Four ways to turn values into shades:

| `scale`                                                           | Behaviour                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `{ type: "linear" }`                                              | Equal-width buckets across `0..max`. Shade stays proportional to magnitude. |
| `{ type: "quantile" }`                                            | Equal-population buckets. Every shade gets used.                            |
| `{ type: "thresholds", thresholds: [10, 25, 50, 100, Infinity] }` | Absolute boundaries that do not move when the data changes.                 |
| `{ type: "zones", breakpoints: [10, 35, 70, 90, 100] }`           | Cumulative percentage breakpoints.                                          |

Zones are the flexible one. `[10, 35, 70, 90, 100]` produces five shades
spanning 0-10%, 10-35%, 35-70%, 70-90% and 90-100%. The number of breakpoints
determines the number of shades — five is a default, not a limit:

```tsx
<RegionHeatMap scale={{ type: "zones", breakpoints: [25, 50, 75, 100] }} />
```

By default those percentages measure the **value range**. Set
`basis: "population"` to measure the **region count** instead, giving weighted
quantiles.

### Example: four equal zones

Zones at 25%, 50%, 75% and 100%. Every zone scale starts at zero, so zero is
not a breakpoint: pass `[25, 50, 75, 100]`, not `[0, 25, 50, 75, 100]`. A `0`
would describe a zone with no width, so it is dropped with a development
warning.

```tsx
import { RegionHeatMap } from "react-region-heatmap"
import { getUsMap } from "react-region-heatmap/maps/us"

const leads = {
	TX: 268,
	CA: 214,
	NY: 163,
	FL: 121,
	IL: 88,
	WA: 64,
	CO: 40,
	OR: 22,
	UT: 9,
	MT: 0
}

export const LeadsByQuarter = () => (
	<RegionHeatMap
		map={getUsMap()}
		data={leads}
		scale={{ type: "zones", breakpoints: [25, 50, 75, 100] }}
		showLegend
	/>
)
```

The same breakpoints divide this data differently depending on `basis`:

| Zone    | `"range"` (default) | States         | `"population"` | States     |
| ------- | ------------------- | -------------- | -------------- | ---------- |
| 0-25%   | 0-67                | WA, CO, OR, UT | 0-40           | CO, OR, UT |
| 25-50%  | 67-134              | FL, IL         | 40-88          | IL, WA     |
| 50-75%  | 134-201             | NY             | 88-163         | NY, FL     |
| 75-100% | 201-268             | TX, CA         | 163-268        | TX, CA     |

- **`"range"`** splits `0..268` into four equal slices, so shade tracks
  magnitude: New York is alone in its zone because nothing else is close to it.
- **`"population"`** puts the boundaries where a quarter, half and
  three-quarters of the non-zero states fall, so the shades are used more
  evenly, at the cost of shade no longer tracking magnitude.
- Each zone includes its upper boundary, which is why Colorado, at exactly
  `40`, is in the first population zone.
- Montana's `0` is outside every zone and takes `zeroColor`. States missing
  from `leads` take `missingColor`.

## Maps

The US preset lives behind its own entry point so its ~30 KB of path data never
lands in a bundle that does not use it:

```ts
import { getUsMap } from "react-region-heatmap/maps/us"

getUsMap() // 50 states
getUsMap({ includeDC: true }) // 51 — DC as a callout square
getUsMap({ includeDC: true, dcStyle: "outline" }) // 51 — DC's true outline
```

DC is off by default and, when on, defaults to a callout square: at this
projection its true outline renders about 3 px across, which is geographically
honest and practically unclickable.

Any other map is just an object:

```ts
const territories = {
	viewBox: "0 0 800 600",
	regions: [{ id: "north", name: "North", path: "M10,10 L200,10 …" }]
}
```

## API

See [`src/types.ts`](./src/types.ts) for the full annotated contract.

## Licence

MIT — see [LICENSE](./LICENSE).

The US state outlines are derived from
[`react-usa-map`](https://github.com/gabidavila/react-usa-map) by Gabriela
D'Avila Ferrara, used under the MIT Licence. See [NOTICE](./NOTICE).
