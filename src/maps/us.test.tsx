import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { RegionHeatMap } from "../render/RegionHeatMap"
import { getUsMap, US_VIEWBOX } from "./us"

/** Absolute vertices of a path; enough of SVG to cover what this map uses. */
const vertices = (d: string): [number, number][] => {
	const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
	const points: [number, number][] = []
	let i = 0
	let command = ""
	let x = 0
	let y = 0
	let startX = 0
	let startY = 0
	const next = () => Number(tokens[i++])

	while (i < tokens.length) {
		if (/[a-zA-Z]/.test(tokens[i] ?? "")) command = tokens[i++] ?? ""
		const relative = command === command.toLowerCase()

		switch (command.toLowerCase()) {
			case "m":
			case "l": {
				const dx = next()
				const dy = next()
				x = relative ? x + dx : dx
				y = relative ? y + dy : dy
				if (command.toLowerCase() === "m") {
					startX = x
					startY = y
					command = relative ? "l" : "L"
				}
				break
			}
			case "h": {
				const dx = next()
				x = relative ? x + dx : dx
				break
			}
			case "v": {
				const dy = next()
				y = relative ? y + dy : dy
				break
			}
			case "c": {
				next()
				next()
				next()
				next()
				const dx = next()
				const dy = next()
				x = relative ? x + dx : dx
				y = relative ? y + dy : dy
				break
			}
			case "z":
				x = startX
				y = startY
				break
			default:
				throw new Error(`unexpected path command "${command}"`)
		}

		points.push([x, y])
	}

	return points
}

const inside = ([x, y]: [number, number], polygon: [number, number][]) => {
	let result = false
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, yi] = polygon[i] ?? [0, 0]
		const [xj, yj] = polygon[j] ?? [0, 0]
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			result = !result
		}
	}
	return result
}

const bounds = (points: [number, number][]) => ({
	minX: Math.min(...points.map(p => p[0])),
	minY: Math.min(...points.map(p => p[1])),
	maxX: Math.max(...points.map(p => p[0])),
	maxY: Math.max(...points.map(p => p[1]))
})

describe("getUsMap", () => {
	it("has the fifty states and nothing else by default", () => {
		const { regions } = getUsMap()

		expect(regions).toHaveLength(50)
		expect(new Set(regions.map(r => r.id)).size).toBe(50)
		expect(regions.every(r => /^[A-Z]{2}$/.test(r.id))).toBe(true)
		expect(regions.some(r => r.id === "DC")).toBe(false)
	})

	it("orders regions by name, which is also keyboard order", () => {
		const names = getUsMap().regions.map(r => r.name)

		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")))
		expect(names[0]).toBe("Alabama")
		expect(names[49]).toBe("Wyoming")
	})

	it("uses the documented coordinate space", () => {
		expect(getUsMap().viewBox).toBe(US_VIEWBOX)
		expect(US_VIEWBOX).toBe("0 0 959 593")
	})

	it("keeps every vertex of every region inside the viewBox", () => {
		for (const region of getUsMap({ includeDC: true }).regions) {
			const box = bounds(vertices(region.path))

			expect(box.minX, region.id).toBeGreaterThanOrEqual(0)
			expect(box.minY, region.id).toBeGreaterThanOrEqual(0)
			expect(box.maxX, region.id).toBeLessThanOrEqual(959)
			expect(box.maxY, region.id).toBeLessThanOrEqual(593)
		}
	})

	it("appends DC without moving any state's index", () => {
		const states = getUsMap().regions
		const withDc = getUsMap({ includeDC: true }).regions

		expect(withDc).toHaveLength(51)
		expect(withDc[50]?.id).toBe("DC")
		expect(withDc[50]?.name).toBe("District of Columbia")
		withDc.slice(0, 50).forEach((region, index) => {
			expect(region).toBe(states[index])
		})
	})

	it("draws the DC callout as a clear square in open water", () => {
		const dc = getUsMap({ includeDC: true }).regions[50]
		const square = vertices(dc?.path ?? "")
		const box = bounds(square)

		expect(box.maxX - box.minX).toBe(16)
		expect(box.maxY - box.minY).toBe(16)

		// Sample a six-unit margin around the square against every state, so a
		// future geometry change cannot quietly bury the callout inside one.
		const polygons = getUsMap().regions.map(r => vertices(r.path))
		for (let x = box.minX - 6; x <= box.maxX + 6; x += 1) {
			for (let y = box.minY - 6; y <= box.maxY + 6; y += 1) {
				expect(polygons.some(polygon => inside([x, y], polygon))).toBe(false)
			}
		}
	})

	it("draws the DC outline at true scale, between Maryland and Virginia", () => {
		const regions = getUsMap({ includeDC: true, dcStyle: "outline" }).regions
		const dc = bounds(vertices(regions[50]?.path ?? ""))
		const maryland = bounds(
			vertices(regions.find(r => r.id === "MD")?.path ?? "")
		)
		const virginia = bounds(
			vertices(regions.find(r => r.id === "VA")?.path ?? "")
		)

		expect(dc.maxX - dc.minX).toBeLessThan(6)
		expect(dc.maxY - dc.minY).toBeLessThan(6)
		expect(dc.minX).toBeGreaterThan(Math.max(maryland.minX, virginia.minX))
		expect(dc.maxX).toBeLessThan(Math.min(maryland.maxX, virginia.maxX))
		expect(dc.minY).toBeGreaterThan(maryland.minY)
		expect(dc.maxY).toBeLessThan(virginia.maxY)
	})

	it("returns the same frozen object for the same options", () => {
		expect(getUsMap()).toBe(getUsMap())
		expect(getUsMap({ includeDC: true })).toBe(
			getUsMap({ includeDC: true, dcStyle: "callout" })
		)
		expect(getUsMap({ includeDC: true })).not.toBe(
			getUsMap({ includeDC: true, dcStyle: "outline" })
		)

		// The style of a region that is not there cannot matter.
		expect(getUsMap({ dcStyle: "outline" })).toBe(getUsMap())

		const map = getUsMap()
		expect(Object.isFrozen(map)).toBe(true)
		expect(Object.isFrozen(map.regions)).toBe(true)
		expect(Object.isFrozen(map.regions[0])).toBe(true)
		expect(() =>
			map.regions.push({ id: "XX", name: "X", path: "M0,0Z" })
		).toThrow()
	})

	it("renders through RegionHeatMap, keyed by postal code", () => {
		const html = renderToString(
			createElement(RegionHeatMap, {
				map: getUsMap({ includeDC: true }),
				data: { TX: 268, CA: 214, DC: 12 }
			})
		)

		expect(html).toContain('viewBox="0 0 959 593"')
		expect(html).toContain("Texas: 268")
		expect(html).toContain("District of Columbia: 12")
		expect(html).toContain("Wyoming: no data")
		expect(html.match(/data-region-id=/g)).toHaveLength(51)
	})
})
