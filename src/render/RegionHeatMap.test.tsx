/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { GeoMap } from "../types"
import { RegionHeatMap } from "./RegionHeatMap"

afterEach(cleanup)

const path = "M0,0 L10,0 L10,10 Z"

const MAP: GeoMap = {
	viewBox: "0 0 100 100",
	regions: [
		{ id: "a", name: "Alpha", path },
		{ id: "b", name: "Bravo", path },
		{ id: "c", name: "Charlie", path }
	]
}

const DATA = [
	{ id: "a", value: 100 },
	{ id: "b", value: 50 },
	{ id: "c", value: 0 }
]

/** The regions, in map order. */
const paths = (container: HTMLElement): SVGPathElement[] =>
	Array.from(container.querySelectorAll<SVGPathElement>("path[data-region-id]"))

describe("RegionHeatMap", () => {
	it("renders one path per region, in map order", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)

		expect(paths(container).map(node => node.dataset.regionId)).toEqual([
			"a",
			"b",
			"c"
		])
	})

	it("gives denser regions a different shade than sparser ones", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)
		const [alpha, bravo] = paths(container)

		expect(alpha?.getAttribute("fill")).not.toBe(bravo?.getAttribute("fill"))
	})

	it("names every region and its value for a screen reader", () => {
		render(<RegionHeatMap map={MAP} data={DATA} />)

		expect(screen.getByLabelText("Alpha: 100")).toBeTruthy()
		expect(screen.getByLabelText("Charlie: 0")).toBeTruthy()
	})

	it("says so when a region has no data at all", () => {
		render(<RegionHeatMap map={MAP} data={[{ id: "a", value: 1 }]} />)

		expect(screen.getByLabelText("Bravo: no data")).toBeTruthy()
	})

	it("reports clicks with the region and its value", () => {
		const onRegionClick = vi.fn()
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} onRegionClick={onRegionClick} />
		)

		const bravo = paths(container)[1]
		if (bravo) fireEvent.click(bravo)

		expect(onRegionClick).toHaveBeenCalledWith(
			expect.objectContaining({ id: "b" }),
			50
		)
	})

	it("reports hover in and out", () => {
		const onRegionHover = vi.fn()
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} onRegionHover={onRegionHover} />
		)

		const alpha = paths(container)[0]
		if (alpha) fireEvent.mouseEnter(alpha)
		expect(onRegionHover).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: "a" }),
			100
		)

		if (alpha) fireEvent.mouseLeave(alpha)
		expect(onRegionHover).toHaveBeenLastCalledWith(null, 0)
	})

	it("shows a tooltip on hover and clears it on leave", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)

		expect(container.querySelector("[role='tooltip']")).toBeNull()

		const alpha = paths(container)[0]
		if (alpha) fireEvent.mouseEnter(alpha)

		const tooltip = container.querySelector("[role='tooltip']")
		expect(tooltip?.textContent).toContain("Alpha")
		expect(tooltip?.textContent).toContain("100")

		if (alpha) fireEvent.mouseLeave(alpha)
		expect(container.querySelector("[role='tooltip']")).toBeNull()
	})

	it("hands renderTooltip the bucket and the share", () => {
		const renderTooltip = vi.fn(() => <span>custom</span>)
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} renderTooltip={renderTooltip} />
		)

		const alpha = paths(container)[0]
		if (alpha) fireEvent.mouseEnter(alpha)

		expect(renderTooltip).toHaveBeenCalledWith(
			expect.objectContaining({
				value: 100,
				bucket: expect.any(Number),
				share: expect.closeTo(100 / 150, 5)
			})
		)
		expect(container.textContent).toContain("custom")
	})
})

describe("RegionHeatMap keyboard access", () => {
	it("puts the map in the tab order once, not once per region", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)

		const tabbable = paths(container).filter(
			node => node.getAttribute("tabindex") === "0"
		)

		expect(tabbable).toHaveLength(1)
		expect(tabbable[0]?.dataset.regionId).toBe("a")
	})

	it("moves focus with the arrow keys and rolls the tabindex along", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)
		const [alpha, bravo] = paths(container)

		if (alpha) {
			alpha.focus()
			fireEvent.keyDown(alpha, { key: "ArrowRight" })
		}

		expect(document.activeElement).toBe(bravo)
		expect(bravo?.getAttribute("tabindex")).toBe("0")
		expect(alpha?.getAttribute("tabindex")).toBe("-1")
	})

	it("wraps at both ends", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)
		const all = paths(container)
		const first = all[0]
		const last = all[all.length - 1]

		if (first) {
			first.focus()
			fireEvent.keyDown(first, { key: "ArrowLeft" })
		}
		expect(document.activeElement).toBe(last)

		if (last) fireEvent.keyDown(last, { key: "ArrowRight" })
		expect(document.activeElement).toBe(first)
	})

	it("jumps to the ends with Home and End", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)
		const all = paths(container)
		const bravo = all[1]

		if (bravo) {
			bravo.focus()
			fireEvent.keyDown(bravo, { key: "End" })
		}
		expect(document.activeElement).toBe(all[all.length - 1])

		const last = all[all.length - 1]
		if (last) fireEvent.keyDown(last, { key: "Home" })
		expect(document.activeElement).toBe(all[0])
	})

	it("activates on Enter and on Space", () => {
		const onRegionClick = vi.fn()
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} onRegionClick={onRegionClick} />
		)

		const alpha = paths(container)[0]
		if (alpha) {
			fireEvent.keyDown(alpha, { key: "Enter" })
			fireEvent.keyDown(alpha, { key: " " })
		}

		expect(onRegionClick).toHaveBeenCalledTimes(2)
	})

	it("leaves keys it does not own to the browser", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)
		const alpha = paths(container)[0]

		// `fireEvent` reports whether preventDefault was called: a Tab that this
		// component swallowed would trap keyboard users inside the map.
		const notCancelled = alpha
			? fireEvent.keyDown(alpha, { key: "Tab", cancelable: true })
			: false

		expect(notCancelled).toBe(true)
	})

	it("shows the tooltip on focus, not only on hover", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)

		const alpha = paths(container)[0]
		if (alpha) fireEvent.focus(alpha)

		expect(container.querySelector("[role='tooltip']")?.textContent).toContain(
			"Alpha"
		)
	})
})

describe("RegionHeatMap highlighting", () => {
	const overlays = (container: HTMLElement) =>
		Array.from(
			container.querySelectorAll<SVGPathElement>("path[data-highlight-for]")
		)

	it("raises the hovered region with a non-interactive overlay", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)

		expect(overlays(container)).toHaveLength(0)

		const alpha = paths(container)[0]
		if (alpha) fireEvent.mouseEnter(alpha)

		const raised = overlays(container)
		expect(raised).toHaveLength(1)
		expect(raised[0]?.dataset.highlightFor).toBe("a")
		expect(raised[0]?.getAttribute("d")).toBe(alpha?.getAttribute("d"))
		expect(raised[0]?.getAttribute("pointer-events")).toBe("none")
	})

	it("draws only an outline, never a second fill", () => {
		// The `<use href>` version of this overlay passed an identical assertion
		// on `fill="none"` while still painting a filled copy, because a
		// presentation attribute on the referenced element outranks the value
		// inherited from the `<use>`. Assert against the region's own fill so a
		// regression has to actually stop covering the neighbours.
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} selectedIds={["a"]} />
		)

		const alpha = paths(container)[0]
		const overlay = overlays(container)[0]

		expect(overlay?.getAttribute("fill")).toBe("none")
		expect(overlay?.getAttribute("fill")).not.toBe(alpha?.getAttribute("fill"))
		expect(overlay?.getAttribute("stroke")).toBeTruthy()
	})

	it("needs no element ids, so two maps on one page cannot collide", () => {
		const { container } = render(
			<>
				<RegionHeatMap map={MAP} data={DATA} selectedIds={["a"]} />
				<RegionHeatMap
					map={MAP}
					data={DATA}
					selectedIds={["a"]}
					primaryColor="#0f766e"
				/>
			</>
		)

		expect(overlays(container)).toHaveLength(2)
		expect(container.querySelectorAll("use")).toHaveLength(0)
		expect(container.querySelectorAll("[id]")).toHaveLength(0)
	})

	it("keeps selected regions raised without any interaction", () => {
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} selectedIds={["b", "c"]} />
		)

		expect(overlays(container)).toHaveLength(2)
	})

	it("reports selection state only when selection is in use", () => {
		const { container: withSelection } = render(
			<RegionHeatMap map={MAP} data={DATA} selectedIds={["b"]} />
		)

		expect(
			paths(withSelection).map(node => node.getAttribute("aria-pressed"))
		).toEqual(["false", "true", "false"])

		cleanup()

		const { container: without } = render(
			<RegionHeatMap map={MAP} data={DATA} />
		)

		expect(
			paths(without).every(node => node.getAttribute("aria-pressed") === null)
		).toBe(true)
	})
})

describe("RegionHeatMap static mode", () => {
	const staticMap = () =>
		render(
			<RegionHeatMap
				map={MAP}
				data={DATA}
				interactive={false}
				onRegionClick={vi.fn()}
			/>
		)

	it("is a single image rather than a group of controls", () => {
		const { container } = staticMap()

		const svg = container.querySelector("svg")
		expect(svg?.getAttribute("role")).toBe("img")
		expect(
			paths(container).every(node => node.getAttribute("role") === null)
		).toBe(true)
	})

	it("takes nothing out of the tab order", () => {
		const { container } = staticMap()

		expect(
			paths(container).every(node => node.getAttribute("tabindex") === null)
		).toBe(true)
	})

	it("ignores hover and click entirely", () => {
		const onRegionClick = vi.fn()
		const { container } = render(
			<RegionHeatMap
				map={MAP}
				data={DATA}
				interactive={false}
				onRegionClick={onRegionClick}
			/>
		)

		const alpha = paths(container)[0]
		if (alpha) {
			fireEvent.mouseEnter(alpha)
			fireEvent.click(alpha)
		}

		expect(onRegionClick).not.toHaveBeenCalled()
		expect(container.querySelector("[role='tooltip']")).toBeNull()
	})

	it("still paints the fills, because that is the whole point", () => {
		const { container } = staticMap()

		expect(
			paths(container).every(node => (node.getAttribute("fill") ?? "") !== "")
		).toBe(true)
	})
})

describe("RegionHeatMap legend", () => {
	it("stays out of the way unless asked for", () => {
		const { container } = render(<RegionHeatMap map={MAP} data={DATA} />)

		expect(container.textContent).toBe("")
	})

	it("shows one swatch per bucket plus the zero case", () => {
		const { container } = render(
			<RegionHeatMap map={MAP} data={DATA} showLegend steps={4} />
		)

		// Four buckets and a zero entry; the map has no missing regions and the
		// missing colour defaults to the zero colour, so no "No data" entry.
		expect(container.textContent).not.toContain("No data")
		expect(container.querySelectorAll("span > span:first-child")).toHaveLength(
			5
		)
	})

	it("calls out missing regions only when they are distinguishable", () => {
		const { container } = render(
			<RegionHeatMap
				map={MAP}
				data={[{ id: "a", value: 5 }]}
				showLegend
				zeroColor="#111111"
				missingColor="#222222"
			/>
		)

		expect(container.textContent).toContain("No data")
	})

	it("lets the caller relabel the buckets", () => {
		const { container } = render(
			<RegionHeatMap
				map={MAP}
				data={DATA}
				showLegend
				steps={2}
				legendLabel={(from, to) => `${from} to ${to}`}
			/>
		)

		expect(container.textContent).toContain("0 to 50")
	})

	it("formats values through formatValue everywhere", () => {
		const { container } = render(
			<RegionHeatMap
				map={MAP}
				data={DATA}
				showLegend
				formatValue={value => `${value} leads`}
			/>
		)

		expect(screen.getByLabelText("Alpha: 100 leads")).toBeTruthy()
		expect(container.textContent).toContain("leads")
	})
})

describe("RegionHeatMap when the map changes", () => {
	it("keeps a tab stop after the region list shrinks under the cursor", () => {
		const { container, rerender } = render(
			<RegionHeatMap map={MAP} data={DATA} />
		)

		const last = paths(container)[2]
		if (last) {
			last.focus()
			fireEvent.keyDown(last, { key: "End" })
		}

		// A filter drops the map to a single region while focus sat on the third.
		rerender(
			<RegionHeatMap
				map={{ ...MAP, regions: MAP.regions.slice(0, 1) }}
				data={DATA}
			/>
		)

		const remaining = paths(container)
		expect(remaining).toHaveLength(1)
		expect(remaining[0]?.getAttribute("tabindex")).toBe("0")
	})

	it("survives a map with no regions at all", () => {
		const { container } = render(
			<RegionHeatMap map={{ ...MAP, regions: [] }} data={DATA} showLegend />
		)

		expect(paths(container)).toHaveLength(0)
		expect(container.querySelector("svg")).toBeTruthy()
	})
})
