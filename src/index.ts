export { RegionHeatMap } from "./render/RegionHeatMap"

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

export { resolveData } from "./data/resolveData"
export { resolveView } from "./render/resolveView"
export type { MapView, RegionView } from "./render/resolveView"

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
