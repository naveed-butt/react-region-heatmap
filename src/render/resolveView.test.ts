import { describe, expect, it, vi } from "vitest"
import type { GeoMap } from "../types"
import { resolveView } from "./resolveView"

const path = "M0,0 L1,0 L1,1 Z"

const MAP: GeoMap = {
	viewBox: "0 0 100 100",
	regions: [
		{ id: "a", name: "Alpha", path },
		{ id: "b", name: "Bravo", path },
		{ id: "c", name: "Charlie", path },
		{ id: "d", name: "Delta", path }
	]
}

const silenced = <T>(run: () => T): T => {
	const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
	try {
		return run()
	} finally {
		spy.mockRestore()
	}
}

const byId = (view: ReturnType<typeof resolveView>, id: string) => {
	const entry = view.regions.find(region => region.region.id === id)
	if (!entry) throw new Error(`no region ${id}`)

	return entry
}

describe("resolveView", () => {
	it("paints zero and missing differently when asked to", () => {
		const view = resolveView({
			map: MAP,
			data: [
				{ id: "a", value: 10 },
				{ id: "b", value: 0 }
			],
			zeroColor: "#111111",
			missingColor: "#222222"
		})

		expect(byId(view, "b").fill).toBe("#111111")
		expect(byId(view, "c").fill).toBe("#222222")
		expect(byId(view, "b").present).toBe(true)
		expect(byId(view, "c").present).toBe(false)
		expect(view.hasZero).toBe(true)
		expect(view.hasMissing).toBe(true)
	})

	it("defaults missing to the zero colour", () => {
		const view = resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			zeroColor: "#111111"
		})

		expect(view.missingFill).toBe("#111111")
	})

	it("ignores data for ids that are not in the map, including in the scale", () => {
		const withGhost = resolveView({
			map: MAP,
			data: [
				{ id: "a", value: 10 },
				{ id: "ghost", value: 10_000 }
			],
			ramp: ["#1", "#2", "#3", "#4", "#5"]
		})

		const without = resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			ramp: ["#1", "#2", "#3", "#4", "#5"]
		})

		expect(withGhost.regions).toHaveLength(4)
		expect(withGhost.scale).toEqual(without.scale)
		expect(byId(withGhost, "a").bucket).toBe(byId(without, "a").bucket)
		expect(withGhost.total).toBe(10)
	})

	it("reports share against the positive total only", () => {
		const view = silenced(() =>
			resolveView({
				map: MAP,
				data: [
					{ id: "a", value: 30 },
					{ id: "b", value: 10 },
					{ id: "c", value: -100 }
				]
			})
		)

		expect(view.total).toBe(40)
		expect(byId(view, "a").share).toBeCloseTo(0.75)
		expect(byId(view, "b").share).toBeCloseTo(0.25)

		// Negative values are outside the colour model, so they take the zero
		// treatment rather than a shade, and contribute no share.
		expect(byId(view, "c").bucket).toBe(-1)
		expect(byId(view, "c").share).toBe(0)
		expect(
			view.regions.reduce((sum, region) => sum + region.share, 0)
		).toBeCloseTo(1)
	})

	it("lets an explicit ramp set the shade count", () => {
		const view = resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			ramp: ["#000000", "#ffffff"]
		})

		expect(view.ramp).toEqual(["#000000", "#ffffff"])
		expect(view.scale.upperBounds).toHaveLength(2)
	})

	it("lets zone breakpoints outrank both ramp length and steps", () => {
		const view = silenced(() =>
			resolveView({
				map: MAP,
				data: [{ id: "a", value: 100 }],
				steps: 9,
				ramp: ["#000000", "#ffffff"],
				scale: { type: "zones", breakpoints: [25, 50, 75, 100] }
			})
		)

		expect(view.scale.upperBounds).toHaveLength(4)
	})

	it("clamps a short ramp rather than blanking the densest regions", () => {
		const view = silenced(() =>
			resolveView({
				map: MAP,
				data: [
					{ id: "a", value: 1 },
					{ id: "b", value: 50 },
					{ id: "c", value: 100 }
				],
				steps: 5,
				ramp: ["#000000", "#ffffff"],
				scale: { type: "zones", breakpoints: [20, 40, 60, 80, 100] }
			})
		)

		expect(byId(view, "c").fill).toBe("#ffffff")
		expect(view.regions.every(region => region.fill.length > 0)).toBe(true)
	})

	it("warns when the ramp is shorter than the scale", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

		resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			ramp: ["#000000"],
			scale: { type: "zones", breakpoints: [50, 100] }
		})

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("1 shade(s) but the scale produces 2 bucket(s)")
		)
		spy.mockRestore()
	})

	it("derives a ramp from the primary colour when none is given", () => {
		const view = resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			primaryColor: "#2f558f",
			steps: 5
		})

		expect(view.ramp).toHaveLength(5)
		expect(view.ramp.every(shade => /^#[0-9a-f]{6}$/i.test(shade))).toBe(true)
	})

	it("runs the ramp the other way in dark mode", () => {
		const light = resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			primaryColor: "#2f558f",
			colorMode: "light"
		})

		const dark = resolveView({
			map: MAP,
			data: [{ id: "a", value: 10 }],
			primaryColor: "#2f558f",
			colorMode: "dark"
		})

		expect(dark.ramp).not.toEqual(light.ramp)
		expect(dark.zeroFill).not.toBe(light.zeroFill)
	})

	it("survives an empty data set without throwing", () => {
		const view = resolveView({ map: MAP, data: [] })

		expect(view.total).toBe(0)
		expect(view.hasMissing).toBe(true)
		expect(view.hasZero).toBe(false)
		expect(view.regions.every(region => region.fill === view.missingFill)).toBe(
			true
		)
	})
})
