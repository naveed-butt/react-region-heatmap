import { describe, expect, it, vi } from "vitest"
import { deriveRamp } from "./deriveRamp"
import { hexToOklch } from "./oklch"

/**
 * These are the contract for the ramp, not a snapshot of one implementation.
 * The maths inside `rampStop` is a design decision and is expected to be tuned;
 * every property asserted here must survive that tuning.
 */

const PRIMARY = "#2f558f"

const lightnessOf = (ramp: string[]): number[] =>
	ramp.map(hex => hexToOklch(hex)!.l)

describe("deriveRamp", () => {
	it("returns exactly the requested number of stops", () => {
		for (const steps of [1, 2, 3, 5, 9]) {
			expect(deriveRamp({ primaryColor: PRIMARY, steps })).toHaveLength(steps)
		}
	})

	it("returns parseable hex colours", () => {
		for (const stop of deriveRamp({ primaryColor: PRIMARY, steps: 5 })) {
			expect(stop).toMatch(/^#[0-9a-f]{6}$/)
		}
	})

	it("orders faintest first: lightness falls across a light-mode ramp", () => {
		const lightness = lightnessOf(
			deriveRamp({ primaryColor: PRIMARY, steps: 5, mode: "light" })
		)

		for (let index = 1; index < lightness.length; index += 1) {
			expect(lightness[index]).toBeLessThan(lightness[index - 1] as number)
		}
	})

	it("climbs towards light on a dark surface", () => {
		const lightness = lightnessOf(
			deriveRamp({ primaryColor: PRIMARY, steps: 5, mode: "dark" })
		)

		for (let index = 1; index < lightness.length; index += 1) {
			expect(lightness[index]).toBeGreaterThan(lightness[index - 1] as number)
		}
	})

	it("ends a light-mode ramp on the caller's exact colour", () => {
		const ramp = deriveRamp({ primaryColor: PRIMARY, steps: 5, mode: "light" })

		expect(ramp[ramp.length - 1]).toBe(PRIMARY)
	})

	it("keeps every stop visually distinct", () => {
		const ramp = deriveRamp({ primaryColor: PRIMARY, steps: 5 })

		expect(new Set(ramp).size).toBe(ramp.length)
	})

	it("holds the hue family across the ramp", () => {
		const hues = deriveRamp({ primaryColor: PRIMARY, steps: 5 }).map(
			hex => hexToOklch(hex)!.h
		)
		const base = hexToOklch(PRIMARY)!.h

		// The faintest stop is nearly achromatic, where hue is numerically
		// unstable, so the tolerance is generous by design.
		for (const hue of hues) {
			expect(Math.abs(hue - base)).toBeLessThan(20)
		}
	})

	it("collapses a one-stop ramp to the colour itself", () => {
		expect(deriveRamp({ primaryColor: PRIMARY, steps: 1 })).toEqual([PRIMARY])
	})

	it("degrades to a flat ramp and warns when the colour is not hex", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

		expect(deriveRamp({ primaryColor: "rebeccapurple", steps: 3 })).toEqual([
			"rebeccapurple",
			"rebeccapurple",
			"rebeccapurple"
		])
		expect(spy).toHaveBeenCalled()

		spy.mockRestore()
	})

	it("works for warm hues, not just the blue it was designed against", () => {
		const ramp = deriveRamp({ primaryColor: "#f0913e", steps: 5 })

		expect(ramp).toHaveLength(5)
		expect(ramp[4]).toBe("#f0913e")
		expect(new Set(ramp).size).toBe(5)
	})
})
