import { warn } from "../internal/warn"
import type { HeatScale, ScaleConfig, ZoneBasis } from "../types"

/**
 * Turning values into bucket boundaries.
 *
 * Every strategy here is ultimately the same operation: take a list of
 * cumulative percentage breakpoints and resolve each one to a value. "linear"
 * and "quantile" are just evenly-spaced breakpoints measured against different
 * bases, so they are implemented as exactly that rather than as separate
 * algorithms. Two consequences worth knowing:
 *
 *   linear   === zones with even breakpoints and basis "range"
 *   quantile === zones with even breakpoints and basis "population"
 *
 * Both invariants are asserted in the tests, so the shorthand strategies can
 * never quietly drift away from the general one.
 */

export const DEFAULT_STEPS = 5

/**
 * Values at or below zero never enter the scale.
 *
 * A region with no value is painted with `zeroColor`, not with the palest
 * shade, so including zeros here would drag every boundary down and waste the
 * bottom of the ramp on regions that are not even using it.
 *
 * Negative values are treated the same as zero. Diverging scales are a
 * different feature with a different colour model, and pretending to support
 * them here would produce a map that looks plausible and is wrong.
 */
const positivesAscending = (values: number[]): number[] =>
	values
		.filter(value => Number.isFinite(value) && value > 0)
		.sort((a, b) => a - b)

/** Value at a given fraction (0..1) of an already-ascending array. */
const quantileOf = (ascending: number[], fraction: number): number => {
	if (ascending.length === 0) return 0

	const index = Math.ceil(fraction * ascending.length) - 1
	const clamped = Math.min(Math.max(index, 0), ascending.length - 1)

	return ascending[clamped] ?? 0
}

/** `[20, 40, 60, 80, 100]` for `steps = 5`. */
export const evenBreakpoints = (steps: number): number[] =>
	Array.from({ length: steps }, (_, index) => ((index + 1) / steps) * 100)

/**
 * Repair caller-supplied breakpoints into something usable: finite, within
 * 0..100, ascending, de-duplicated, and ending at 100.
 *
 * This repairs rather than throws. A malformed scale should not take down the
 * page that embeds the map, but it should be loud in development.
 */
export const normaliseBreakpoints = (breakpoints: number[]): number[] => {
	const usable = breakpoints.filter(
		point => Number.isFinite(point) && point > 0 && point <= 100
	)

	if (usable.length !== breakpoints.length) {
		warn(
			"scale.breakpoints contained values outside (0, 100] or non-finite " +
				"values; they were dropped."
		)
	}

	const ascending = [...usable].sort((a, b) => a - b)

	if (ascending.some((point, index) => point !== usable[index])) {
		warn("scale.breakpoints were not ascending; they were sorted.")
	}

	const deduped = ascending.filter(
		(point, index) => index === 0 || point !== ascending[index - 1]
	)

	if (deduped.length === 0) return [100]

	// The top bucket has to reach the maximum or the densest regions fall off
	// the end of the ramp entirely.
	if (deduped[deduped.length - 1] !== 100) deduped.push(100)

	return deduped
}

/**
 * How many shades a config implies.
 *
 * `thresholds` and `zones` carry their own count, so an explicit `steps` prop
 * cannot apply to them — the arrays would disagree with it.
 */
export const stepCountFor = (
	config: ScaleConfig = { type: "linear" },
	steps: number = DEFAULT_STEPS
): number => {
	if (config.type === "thresholds") {
		return Math.max(config.thresholds.length, 1)
	}

	if (config.type === "zones") {
		return normaliseBreakpoints(config.breakpoints).length
	}

	return Math.max(Math.floor(steps), 1)
}

const resolveByBasis = (
	breakpoints: number[],
	positives: number[],
	basis: ZoneBasis
): number[] => {
	if (basis === "population") {
		// Percentage of the regions: the value below which that share of
		// regions falls. Every shade gets used regardless of distribution.
		return breakpoints.map(point => quantileOf(positives, point / 100))
	}

	// Percentage of the value span, measured from zero rather than from the
	// minimum. Anchoring at zero is what keeps shade proportional to magnitude
	// and makes evenly-spaced breakpoints identical to the "linear" strategy.
	// It also means tightly-clustered values far from zero all land in the top
	// bucket — that is what basis "population" is for.
	const max = positives[positives.length - 1] ?? 0

	return breakpoints.map(point => (max * point) / 100)
}

/** Force ascending order so no bucket can be unreachable by a tie. */
const monotonic = (bounds: number[]): number[] =>
	bounds.map((bound, index) =>
		index === 0 ? bound : Math.max(bound, bounds[index - 1] ?? bound)
	)

export const buildScale = (
	values: number[],
	config: ScaleConfig = { type: "linear" },
	steps: number = DEFAULT_STEPS
): HeatScale => {
	// Absolute boundaries are the caller's to choose; they deliberately do not
	// move with the data, which is the entire reason to pick this strategy.
	if (config.type === "thresholds") {
		return { upperBounds: monotonic([...config.thresholds]) }
	}

	const positives = positivesAscending(values)
	const stepCount = stepCountFor(config, steps)

	if (positives.length === 0) {
		return { upperBounds: Array<number>(stepCount).fill(0) }
	}

	const breakpoints =
		config.type === "zones"
			? normaliseBreakpoints(config.breakpoints)
			: evenBreakpoints(stepCount)

	const basis: ZoneBasis =
		config.type === "zones"
			? (config.basis ?? "range")
			: config.type === "quantile"
				? "population"
				: "range"

	return {
		upperBounds: monotonic(resolveByBasis(breakpoints, positives, basis))
	}
}

/**
 * Ramp index for a value, or -1 when the region should take `zeroColor`
 * instead of a shade.
 */
export const bucketIndexFor = (value: number, scale: HeatScale): number => {
	if (!Number.isFinite(value) || value <= 0) return -1

	const index = scale.upperBounds.findIndex(bound => value <= bound)

	return index === -1 ? scale.upperBounds.length - 1 : index
}

/**
 * Exclusive lower bound of a bucket. Buckets are `(lower, upper]`.
 *
 * The original implementation returned `previous + 1`, which silently assumed
 * integer data. This library has to serve percentages and temperatures too, so
 * presentation rounding is left to `formatValue` and the maths stays exact.
 */
export const bucketLowerBound = (index: number, scale: HeatScale): number =>
	index <= 0 ? 0 : (scale.upperBounds[index - 1] ?? 0)
