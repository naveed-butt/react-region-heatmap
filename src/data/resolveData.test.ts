import { describe, expect, it, vi } from "vitest"
import { resolveData } from "./resolveData"

const silenced = <T>(run: () => T): T => {
	const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
	try {
		return run()
	} finally {
		spy.mockRestore()
	}
}

describe("resolveData", () => {
	it("accepts both shapes identically", () => {
		const fromArray = resolveData([
			{ id: "TX", value: 268 },
			{ id: "CA", value: 214 }
		])
		const fromRecord = resolveData({ TX: 268, CA: 214 })

		expect([...fromArray]).toEqual([...fromRecord])
	})

	it("keeps zero distinct from absent", () => {
		const values = resolveData([{ id: "MT", value: 0 }])

		expect(values.get("MT")).toBe(0)
		expect(values.has("MT")).toBe(true)
		expect(values.has("WY")).toBe(false)
	})

	it("treats non-finite values as missing rather than as zero", () => {
		const values = silenced(() =>
			resolveData([
				{ id: "TX", value: Number.NaN },
				{ id: "CA", value: Number.POSITIVE_INFINITY }
			])
		)

		expect(values.has("TX")).toBe(false)
		expect(values.has("CA")).toBe(false)
	})

	it("takes the last value for a duplicated id, and says so", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

		const values = resolveData([
			{ id: "TX", value: 1 },
			{ id: "TX", value: 2 }
		])

		expect(values.get("TX")).toBe(2)
		expect(spy).toHaveBeenCalledOnce()
		spy.mockRestore()
	})

	it("survives ids that collide with Object.prototype", () => {
		const values = resolveData([
			{ id: "constructor", value: 5 },
			{ id: "__proto__", value: 7 }
		])

		expect(values.get("constructor")).toBe(5)
		expect(values.get("__proto__")).toBe(7)
	})
})
