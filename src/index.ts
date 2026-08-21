export {
	bucketIndexFor,
	bucketLowerBound,
	buildScale,
	DEFAULT_STEPS,
	evenBreakpoints,
	normaliseBreakpoints,
	stepCountFor
} from "./scale/buildScale"

export { deriveRamp, RAMP_LIGHTNESS } from "./color/deriveRamp"
export type { DeriveRampOptions } from "./color/deriveRamp"

export type {
	ColorMode,
	GeoMap,
	HeatData,
	HeatDatum,
	HeatScale,
	RampEasing,
	RegionGeometry,
	RegionHeatMapProps,
	ScaleConfig,
	TooltipContext,
	ZoneBasis
} from "./types"
