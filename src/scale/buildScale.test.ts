import { describe, expect, it, vi } from "vitest"
import {
	bucketIndexFor,
	bucketLowerBound,
	buildScale,
	evenBreakpoints,
	normaliseBreakpoints,
	stepCountFor
} from "./buildScale"

/** Deliberately skewed: one dominant value, so strategies visibly diverge. */
const SKEWED = [1, 2, 3, 4, 100]

const silenced = <T>(run: () => T): T => {
	const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
	try {
		return run()
	} finally {
		spy.mockRestore()
	}
}

describe("evenBreakpoints", () => {
	it("spans to 100", () => {
		expect(evenBreakpoints(5)).toEqual([20, 40, 60, 80, 100])
		expect(evenBreakpoints(4)).toEqual([25, 50, 75, 100])
		expect(evenBreakpoints(1)).toEqual([100])
	})
})

describe("normaliseBreakpoints", () => {
	it("sorts, dedupes and terminates at 100", () => {
		expect(silenced(() => normaliseBreakpoints([35, 10, 70]))).toEqual([
			10, 35, 70, 100
		])
		expect(silenced(() => normaliseBreakpoints([10, 10, 50]))).toEqual([
			10, 50, 100
		])
	})

	it("keeps an already-valid list untouched", () => {
		expect(normaliseBreakpoints([10, 35, 70, 90, 100])).toEqual([
			10, 35, 70, 90, 100
		])
	})

	it("drops values outside (0, 100] and non-finite values", () => {
		expect(silenced(() => normaliseBreakpoints([10, 150, -5, NaN]))).toEqual([
			10, 100
		])
	})

	it("never returns an empty list", () => {
		expect(silenced(() => normaliseBreakpoints([]))).toEqual([100])
	})

	it("warns in development rather than throwing", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
		normaliseBreakpoints([70, 10])
		expect(spy).toHaveBeenCalled()
		spy.mockRestore()
	})
})

describe("stepCountFor", () => {
	it("uses the steps argument for the data-driven strategies", () => {
		expect(stepCountFor({ type: "linear" }, 7)).toBe(7)
		expect(stepCountFor({ type: "quantile" }, 3)).toBe(3)
		expect(stepCountFor()).toBe(5)
	})

	it("takes the count from the config when the config carries one", () => {
		expect(stepCountFor({ type: "thresholds", thresholds: [1, 2, 3] }, 9)).toBe(
			3
		)
		expect(
			stepCountFor({ type: "zones", breakpoints: [25, 50, 75, 100] }, 9)
		).toBe(4)
	})

	it("never returns less than one", () => {
		expect(stepCountFor({ type: "linear" }, 0)).toBe(1)
		expect(stepCountFor({ type: "linear" }, -4)).toBe(1)
	})
})

describe("buildScale", () => {
	it("linear spreads equal-width buckets across 0..max", () => {
		expect(buildScale([10, 20, 30, 40, 50], { type: "linear" }, 5)).toEqual({
			upperBounds: [10, 20, 30, 40, 50]
		})
		expect(buildScale(SKEWED, { type: "linear" }, 5)).toEqual({
			upperBounds: [20, 40, 60, 80, 100]
		})
	})

	it("quantile gives every bucket an equal share of the regions", () => {
		expect(buildScale(SKEWED, { type: "quantile" }, 5)).toEqual({
			upperBounds: [1, 2, 3, 4, 100]
		})
	})

	it("thresholds pass through untouched and ignore the data", () => {
		const thresholds = [10, 25, 50, 100, Number.POSITIVE_INFINITY]

		expect(
			buildScale(SKEWED, { type: "thresholds", thresholds }, 5).upperBounds
		).toEqual(thresholds)
		expect(
			buildScale([7], { type: "thresholds", thresholds }, 5).upperBounds
		).toEqual(thresholds)
	})

	it("zones resolve cumulative percentages of the value span", () => {
		expect(
			buildScale([200], { type: "zones", breakpoints: [10, 35, 70, 90, 100] })
		).toEqual({ upperBounds: [20, 70, 140, 180, 200] })
	})

	it("zones honour a population basis", () => {
		expect(
			buildScale(SKEWED, {
				type: "zones",
				breakpoints: [10, 35, 70, 90, 100],
				basis: "population"
			})
		).toEqual({ upperBounds: [1, 2, 4, 100, 100] })
	})

	it("supports any number of zones, not just five", () => {
		const scale = buildScale([100], {
			type: "zones",
			breakpoints: [50, 100]
		})

		expect(scale.upperBounds).toEqual([50, 100])
	})

	/* -- The data the scale must survive ---------------------------------- */

	it("ignores zero and negative values when placing boundaries", () => {
		expect(
			buildScale([-100, 0, 10, 20], { type: "linear" }, 2).upperBounds
		).toEqual([10, 20])
	})

	it("collapses to zeros when nothing is positive", () => {
		expect(buildScale([], { type: "linear" }, 3).upperBounds).toEqual([0, 0, 0])
		expect(buildScale([0, 0], { type: "linear" }, 3).upperBounds).toEqual([
			0, 0, 0
		])
		expect(buildScale([-5], { type: "quantile" }, 2).upperBounds).toEqual([
			0, 0
		])
	})

	it("handles a single region", () => {
		expect(buildScale([42], { type: "linear" }, 2).upperBounds).toEqual([
			21, 42
		])
	})

	it("never emits descending bounds", () => {
		const { upperBounds } = buildScale(SKEWED, { type: "quantile" }, 8)

		for (let index = 1; index < upperBounds.length; index += 1) {
			expect(upperBounds[index]).toBeGreaterThanOrEqual(
				upperBounds[index - 1] as number
			)
		}
	})
})

/**
 * The shorthand strategies are implemented as evenly-spaced zones. If that ever
 * stops being true these two tests fail, which is the point of them.
 */
describe("strategy invariants", () => {
	it("linear === zones with even breakpoints on a range basis", () => {
		for (const steps of [1, 3, 5, 8]) {
			expect(buildScale(SKEWED, { type: "linear" }, steps)).toEqual(
				buildScale(SKEWED, {
					type: "zones",
					breakpoints: evenBreakpoints(steps),
					basis: "range"
				})
			)
		}
	})

	it("quantile === zones with even breakpoints on a population basis", () => {
		for (const steps of [1, 3, 5, 8]) {
			expect(buildScale(SKEWED, { type: "quantile" }, steps)).toEqual(
				buildScale(SKEWED, {
					type: "zones",
					breakpoints: evenBreakpoints(steps),
					basis: "population"
				})
			)
		}
	})
})

describe("bucketIndexFor", () => {
	const scale = buildScale(SKEWED, { type: "linear" }, 5) // [20,40,60,80,100]

	it("returns -1 for values that should take zeroColor", () => {
		expect(bucketIndexFor(0, scale)).toBe(-1)
		expect(bucketIndexFor(-3, scale)).toBe(-1)
		expect(bucketIndexFor(NaN, scale)).toBe(-1)
	})

	it("places values in the first bucket whose bound they reach", () => {
		expect(bucketIndexFor(1, scale)).toBe(0)
		expect(bucketIndexFor(20, scale)).toBe(0)
		expect(bucketIndexFor(21, scale)).toBe(1)
		expect(bucketIndexFor(100, scale)).toBe(4)
	})

	it("clamps values above the top bound into the last bucket", () => {
		expect(bucketIndexFor(10_000, scale)).toBe(4)
	})
})

describe("bucketLowerBound", () => {
	const scale = { upperBounds: [10, 20, 30] }

	it("starts the first bucket at zero", () => {
		expect(bucketLowerBound(0, scale)).toBe(0)
	})

	it("hands back the previous upper bound, exclusive", () => {
		expect(bucketLowerBound(1, scale)).toBe(10)
		expect(bucketLowerBound(2, scale)).toBe(20)
	})
})
