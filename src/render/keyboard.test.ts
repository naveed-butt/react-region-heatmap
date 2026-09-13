import { describe, expect, it } from "vitest"
import { handlesKey, nextRegionIndex } from "./keyboard"

describe("handlesKey", () => {
	it("claims the arrows and the extremes", () => {
		for (const key of [
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End"
		]) {
			expect(handlesKey(key)).toBe(true)
		}
	})

	it("leaves everything else alone", () => {
		// Tab especially: swallowing it would trap a keyboard user in the map.
		for (const key of ["Tab", "Escape", "a", "Enter", " ", "PageDown"]) {
			expect(handlesKey(key)).toBe(false)
		}
	})
})

describe("nextRegionIndex", () => {
	it("steps one region at a time", () => {
		expect(nextRegionIndex(0, "ArrowRight", 5)).toBe(1)
		expect(nextRegionIndex(3, "ArrowLeft", 5)).toBe(2)
	})

	it("treats the two axes the same, for now", () => {
		expect(nextRegionIndex(1, "ArrowDown", 5)).toBe(
			nextRegionIndex(1, "ArrowRight", 5)
		)
		expect(nextRegionIndex(1, "ArrowUp", 5)).toBe(
			nextRegionIndex(1, "ArrowLeft", 5)
		)
	})

	it("wraps at both ends", () => {
		expect(nextRegionIndex(4, "ArrowRight", 5)).toBe(0)
		expect(nextRegionIndex(0, "ArrowLeft", 5)).toBe(4)
	})

	it("jumps to the extremes", () => {
		expect(nextRegionIndex(2, "Home", 5)).toBe(0)
		expect(nextRegionIndex(2, "End", 5)).toBe(4)
	})

	it("stays put on a key it does not own", () => {
		expect(nextRegionIndex(2, "Tab", 5)).toBe(2)
	})

	it("does not divide by zero on an empty map", () => {
		expect(nextRegionIndex(0, "ArrowRight", 0)).toBe(0)
		expect(nextRegionIndex(0, "Home", 0)).toBe(0)
	})

	it("handles a single-region map without moving", () => {
		expect(nextRegionIndex(0, "ArrowRight", 1)).toBe(0)
		expect(nextRegionIndex(0, "ArrowLeft", 1)).toBe(0)
	})
})
