import { describe, expect, it } from "vitest"
import {
	clampChromaToGamut,
	hexToOklch,
	isInGamut,
	oklchToHex,
	parseHex,
	rgbToOklch,
	toHex
} from "./oklch"

describe("parseHex", () => {
	it("accepts long and short form, with or without a hash", () => {
		expect(parseHex("#2f558f")).toEqual({ r: 47, g: 85, b: 143 })
		expect(parseHex("2f558f")).toEqual({ r: 47, g: 85, b: 143 })
		expect(parseHex("#abc")).toEqual({ r: 170, g: 187, b: 204 })
		expect(parseHex("  #FFF  ")).toEqual({ r: 255, g: 255, b: 255 })
	})

	it("returns null for anything else rather than throwing", () => {
		expect(parseHex("rebeccapurple")).toBeNull()
		expect(parseHex("rgb(1,2,3)")).toBeNull()
		expect(parseHex("#12345")).toBeNull()
		expect(parseHex("")).toBeNull()
	})
})

describe("toHex", () => {
	it("pads and clamps", () => {
		expect(toHex({ r: 0, g: 0, b: 0 })).toBe("#000000")
		expect(toHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff")
		expect(toHex({ r: -20, g: 300, b: 5 })).toBe("#00ff05")
	})
})

describe("OKLCH conversion", () => {
	it("anchors white and black where the space says they are", () => {
		const white = rgbToOklch({ r: 255, g: 255, b: 255 })
		expect(white.l).toBeCloseTo(1, 3)
		expect(white.c).toBeCloseTo(0, 3)

		const black = rgbToOklch({ r: 0, g: 0, b: 0 })
		expect(black.l).toBeCloseTo(0, 3)
		expect(black.c).toBeCloseTo(0, 3)
	})

	it("round-trips hex through OKLCH without drift", () => {
		for (const hex of [
			"#2f558f",
			"#f0913e",
			"#ffffff",
			"#000000",
			"#bfdbf7",
			"#1c3557",
			"#e08033"
		]) {
			const oklch = hexToOklch(hex)
			expect(oklch).not.toBeNull()
			expect(oklchToHex(oklch!)).toBe(hex)
		}
	})

	it("orders lightness the way the eye does", () => {
		const pale = hexToOklch("#e3ecf9")!
		const mid = hexToOklch("#5f88c6")!
		const deep = hexToOklch("#2f558f")!

		expect(pale.l).toBeGreaterThan(mid.l)
		expect(mid.l).toBeGreaterThan(deep.l)
	})

	it("reads a grey as having no chroma", () => {
		expect(hexToOklch("#808080")!.c).toBeCloseTo(0, 3)
	})

	it("keeps hue stable across lightness for one hue family", () => {
		const light = hexToOklch("#8fb2e0")!
		const dark = hexToOklch("#2f558f")!

		expect(Math.abs(light.h - dark.h)).toBeLessThan(12)
	})
})

describe("gamut handling", () => {
	const BLUE = "#2f558f"

	it("recognises colours that sRGB cannot represent", () => {
		const base = hexToOklch(BLUE)!

		expect(isInGamut(base)).toBe(true)
		expect(isInGamut({ ...base, l: 0.7 })).toBe(true)

		// Same chroma, pushed pale: no longer a real sRGB colour.
		expect(isInGamut({ ...base, l: 0.96 })).toBe(false)
	})

	it("brings a colour back into gamut by giving up chroma only", () => {
		const base = hexToOklch(BLUE)!
		const pale = { ...base, l: 0.96 }
		const fixed = clampChromaToGamut(pale)

		expect(isInGamut(fixed)).toBe(true)
		expect(fixed.l).toBe(pale.l)
		expect(fixed.h).toBe(pale.h)
		expect(fixed.c).toBeLessThan(pale.c)
	})

	it("leaves an in-gamut colour completely alone", () => {
		const base = hexToOklch(BLUE)!

		expect(clampChromaToGamut(base)).toEqual(base)
	})

	/**
	 * Regression lock. Holding chroma flat while raising lightness used to pin
	 * the blue channel at 255 and rotate the hue 44 degrees towards cyan, which
	 * is how a blue ramp quietly produced a cyan palest shade.
	 */
	it("holds hue when lightening, instead of rotating towards cyan", () => {
		const base = hexToOklch(BLUE)!
		const pale = clampChromaToGamut({ ...base, l: 0.96 })
		const roundTripped = hexToOklch(oklchToHex(pale))!

		expect(Math.abs(roundTripped.h - base.h)).toBeLessThan(5)
	})
})
