import type { CSSProperties, ReactNode } from "react"

/**
 * Public type contract for react-region-heatmap.
 *
 * Nothing in this file knows about any particular part of the world. A "region"
 * is an SVG path with an id and a label; whether that is a US state, a Canadian
 * province or a sales territory is entirely the caller's business.
 */

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

export interface RegionGeometry {
	/** Join key against the data, e.g. "TX". Must be unique within a map. */
	id: string

	/** Human-readable label shown in the tooltip and legend, e.g. "Texas". */
	name: string

	/** SVG path `d` attribute for the region outline. */
	path: string
}

export interface GeoMap {
	/**
	 * Shared coordinate space for every region, e.g. "0 0 959 593".
	 *
	 * All regions in one map must be pre-projected into this space so they can be
	 * rendered as plain siblings with no per-region transform.
	 */
	viewBox: string

	regions: RegionGeometry[]
}

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

export interface HeatDatum {
	/** Matches a `RegionGeometry.id`. Ids with no matching region are ignored. */
	id: string
	value: number
}

/**
 * Values keyed by region id. The record form is a convenience for callers that
 * already hold a lookup; both forms behave identically.
 */
export type HeatData = HeatDatum[] | Record<string, number>

/* -------------------------------------------------------------------------- */
/* Scale                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What percentages in a "zones" scale are measured against.
 *
 * - "range" — percentages of the value span, so shade stays proportional to
 *   magnitude. A single dominant region pushes everyone else into the palest
 *   shade, which is honest but can flatten the map.
 * - "population" — percentages of the region count, so every shade is used and
 *   regions separate visually. Shade no longer tracks magnitude, which can
 *   overstate small differences.
 */
export type ZoneBasis = "range" | "population"

export type ScaleConfig =
	/** Equal-width buckets across 0..max. */
	| { type: "linear" }
	/** Equal-population buckets. */
	| { type: "quantile" }
	/**
	 * Absolute value boundaries. Unlike the data-driven strategies these do not
	 * move when the data changes, so a region keeps the same shade across filter
	 * changes — at the cost of needing real domain knowledge to choose well.
	 */
	| { type: "thresholds"; thresholds: number[] }
	/**
	 * Cumulative percentage breakpoints, ascending and ending at 100.
	 *
	 * `[10, 35, 70, 90, 100]` yields five shades spanning 0-10%, 10-35%, 35-70%,
	 * 70-90% and 90-100%. The number of breakpoints determines the number of
	 * shades and overrides `steps`.
	 */
	| { type: "zones"; breakpoints: number[]; basis?: ZoneBasis }

/** Resolved bucket boundaries, produced from a ScaleConfig plus the data. */
export interface HeatScale {
	/** Inclusive upper bound of each bucket, ascending. */
	upperBounds: number[]
}

/* -------------------------------------------------------------------------- */
/* Colour                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Which end of the ramp carries the most weight.
 *
 * Contrast against the page, not darkness, is what encodes volume: on a dark
 * canvas a near-black shade reads as empty rather than as dense, so the ramp
 * runs the other way.
 */
export type ColorMode = "light" | "dark"

/**
 * - "perceptual" — even steps in OKLCH, so no two adjacent shades collapse
 *   together while another pair jumps.
 * - "linear" — naive sRGB interpolation. Cheaper, visibly less even.
 */
export type RampEasing = "perceptual" | "linear"

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

export interface TooltipContext {
	region: RegionGeometry
	value: number

	/** Value as a fraction of the total across all regions, 0..1. */
	share: number

	/** Zero-based ramp index, or -1 for zero/missing regions. */
	bucket: number
}

export interface RegionHeatMapProps {
	map: GeoMap
	data: HeatData

	/* -- Colour ------------------------------------------------------------- */

	/** Base colour the ramp is derived from. Ignored when `ramp` is given. */
	primaryColor?: string

	/** Explicit shades, palest first. Overrides `primaryColor` and `steps`. */
	ramp?: string[]

	/** Number of shades. Ignored when `ramp` or zone breakpoints are given. */
	steps?: number

	/** Regions whose value is exactly zero. */
	zeroColor?: string

	/**
	 * Regions absent from the data entirely.
	 *
	 * Defaults to `zeroColor`. Kept separate because "not measured" and
	 * "measured as zero" are different claims, and a map that cannot tell them
	 * apart will mislead somebody eventually.
	 */
	missingColor?: string

	borderColor?: string
	hoverBorderColor?: string
	colorMode?: ColorMode
	rampEasing?: RampEasing

	/* -- Scale -------------------------------------------------------------- */

	scale?: ScaleConfig

	/* -- Interaction -------------------------------------------------------- */

	onRegionClick?: (region: RegionGeometry, value: number) => void
	onRegionHover?: (region: RegionGeometry | null, value: number) => void

	/** Region ids to render in the selected state. */
	selectedIds?: string[]

	/**
	 * When false, no listeners are attached and no hover styling is applied.
	 * Intended for print, PDF export and static prerenders.
	 */
	interactive?: boolean

	/* -- Presentation ------------------------------------------------------- */

	showLegend?: boolean
	showTooltip?: boolean
	renderTooltip?: (context: TooltipContext) => ReactNode
	formatValue?: (value: number) => string
	legendLabel?: (from: number, to: number, bucket: number) => string

	/** Accessible name for the map as a whole. */
	ariaLabel?: string

	className?: string
	style?: CSSProperties
}
