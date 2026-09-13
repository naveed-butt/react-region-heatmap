import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { GeoMap } from "../types"
import { RegionHeatMap } from "./RegionHeatMap"

/**
 * Server rendering, verified by the absence of a docblock.
 *
 * This file deliberately has no `@vitest-environment`, so it runs in the plain
 * node environment where `document` and `window` do not exist. Any DOM access
 * that escaped an event handler and crept into render - or into module scope -
 * throws here rather than in a caller's Next.js build.
 */

const MAP: GeoMap = {
	viewBox: "0 0 100 100",
	regions: [
		{ id: "a", name: "Alpha", path: "M0,0 L10,0 L10,10 Z" },
		{ id: "b", name: "Bravo", path: "M0,0 L10,0 L10,10 Z" }
	]
}

describe("RegionHeatMap on the server", () => {
	it("renders without a DOM", () => {
		expect(typeof document).toBe("undefined")

		const html = renderToString(
			<RegionHeatMap
				map={MAP}
				data={[{ id: "a", value: 10 }]}
				showLegend
				primaryColor="#2f558f"
			/>
		)

		expect(html).toContain("<svg")
		expect(html).toContain("Alpha: 10")
	})

	it("renders a static map without a DOM", () => {
		const html = renderToString(
			<RegionHeatMap map={MAP} data={{ a: 10, b: 4 }} interactive={false} />
		)

		expect(html).toContain('role="img"')
	})

	it("emits no highlight overlay until something is interacted with", () => {
		const html = renderToString(<RegionHeatMap map={MAP} data={{ a: 10 }} />)

		expect(html).not.toContain("data-highlight-for")
	})

	it("emits no element ids, which would collide across render roots", () => {
		const html = renderToString(<RegionHeatMap map={MAP} data={{ a: 10 }} />)

		expect(html).not.toContain(" id=")
	})

	it("marks selected regions during the server pass", () => {
		const html = renderToString(
			<RegionHeatMap map={MAP} data={{ a: 10 }} selectedIds={["a"]} />
		)

		// Selection is a prop, not interaction state, so it must survive the
		// server pass - otherwise the first client paint would flicker.
		expect(html).toContain('data-highlight-for="a"')
		expect(html).toContain('aria-pressed="true"')
	})
})
