import { deriveRamp } from "../color/deriveRamp"
import { resolveData } from "../data/resolveData"
import { warn } from "../internal/warn"
import {
	bucketIndexFor,
	buildScale,
	DEFAULT_STEPS,
	stepCountFor
} from "../scale/buildScale"
import type {
	ColorMode,
	GeoMap,
	HeatData,
	HeatScale,
	RampEasing,
	RegionGeometry,
	ScaleConfig
} from "../types"
import { DEFAULT_PRIMARY_COLOR, SURFACE } from "./defaults"

/**
 * Props in, paint out — with no React involved.
 *
 * The whole of the component's decision-making lives in this function: join the
 * data to the geometry, build the scale from the joined values, derive the
 * ramp, and resolve one fill per region. The component around it only holds
 * state and renders what it is given.
 *
 * Keeping it here is not tidiness for its own sake. It means the rules that are
 * easy to get wrong — which regions count towards the scale, what a zero gets
 * painted, what `share` is a share *of* — are tested as plain functions in the
 * fast DOM-free environment, and the tests that need jsdom are left to cover
 * only genuinely interactive behaviour.
 */

export interface RegionView {
	region: RegionGeometry

	/** The region's value, or 0 when it is absent from the data. */
	value: number

	/** False when the region has no entry in the data at all. */
	present: boolean

	/** Zero-based ramp index, or -1 for zero and missing regions. */
	bucket: number

	/** Value as a fraction of the positive total, 0..1. */
	share: number

	fill: string
}

export interface MapView {
	regions: RegionView[]

	/** The resolved shades, palest first. */
	ramp: string[]

	scale: HeatScale

	/** Sum of positive values across regions that exist in the map. */
	total: number

	/** Fill used for regions measured as zero. */
	zeroFill: string

	/** Fill used for regions absent from the data. */
	missingFill: string

	/** True when at least one region in the map has no data entry. */
	hasMissing: boolean

	/** True when at least one region in the map is measured as zero. */
	hasZero: boolean
}

export interface ResolveViewOptions {
	map: GeoMap
	data: HeatData
	primaryColor?: string
	ramp?: string[]
	steps?: number
	zeroColor?: string
	missingColor?: string
	colorMode?: ColorMode
	rampEasing?: RampEasing
	scale?: ScaleConfig
}

export const resolveView = ({
	map,
	data,
	primaryColor = DEFAULT_PRIMARY_COLOR,
	ramp,
	steps = DEFAULT_STEPS,
	zeroColor,
	missingColor,
	colorMode = "light",
	rampEasing = "perceptual",
	scale = { type: "linear" }
}: ResolveViewOptions): MapView => {
	const surface = SURFACE[colorMode]
	const values = resolveData(data)

	// Only regions that exist in the geometry feed the scale. Data for an id
	// with no region is ignored by contract, and letting it move the bucket
	// boundaries would be ignoring it everywhere except where it matters.
	const joined = map.regions.map(region => values.get(region.id))
	const present = joined.filter((value): value is number => value !== undefined)

	/**
	 * An explicit `ramp` sets the shade count; `steps` is the fallback. Either
	 * way `stepCountFor` has the last word, because `thresholds` and `zones`
	 * carry their own count and any other number would contradict them.
	 */
	const requested = ramp?.length ?? steps
	const stepCount = stepCountFor(scale, requested)

	const shades =
		ramp && ramp.length > 0
			? ramp
			: deriveRamp({
					primaryColor,
					steps: stepCount,
					mode: colorMode,
					easing: rampEasing
				})

	if (shades.length < stepCount) {
		warn(
			`ramp has ${shades.length} shade(s) but the scale produces ` +
				`${stepCount} bucket(s); the densest regions will share the last ` +
				"shade. Pass one shade per bucket to tell them apart."
		)
	}

	const heatScale = buildScale(present, scale, requested)

	// `share` is a share of the positive total. Negatives are outside this
	// library's colour model — `buildScale` already excludes them — and letting
	// them shrink the denominator would push other regions' shares above 1.
	const total = present.reduce(
		(sum, value) => (value > 0 ? sum + value : sum),
		0
	)

	const zeroFill = zeroColor ?? surface.zero

	// "Not measured" defaults to looking like "measured as zero", because for
	// most callers the distinction is noise. It is still a separate resolution
	// step so that the caller who *does* care only has to pass one prop.
	const missingFill = missingColor ?? zeroFill

	let hasMissing = false
	let hasZero = false

	const regions = map.regions.map((region, index): RegionView => {
		const raw = joined[index]
		const isPresent = raw !== undefined
		const value = raw ?? 0
		const bucket = bucketIndexFor(value, heatScale)

		if (!isPresent) hasMissing = true
		else if (bucket === -1) hasZero = true

		const fill = !isPresent
			? missingFill
			: bucket === -1
				? zeroFill
				: // Clamp rather than fall through to undefined: a short ramp
					// should flatten the top of the map, not blank it out.
					(shades[Math.min(bucket, shades.length - 1)] ?? zeroFill)

		return {
			region,
			value,
			present: isPresent,
			bucket,
			share: total > 0 && value > 0 ? value / total : 0,
			fill
		}
	})

	return {
		regions,
		ramp: shades,
		scale: heatScale,
		total,
		zeroFill,
		missingFill,
		hasMissing,
		hasZero
	}
}
