import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		// The scale and colour engines are pure functions, so a DOM is dead
		// weight here — and not free weight: jsdom pulls an undici that calls
		// `webidl.util.markAsUncloneable`, which is missing on Node 20, so
		// merely *loading* it broke CI on that version.
		//
		// Component tests added later need a DOM. Opt those files in
		// individually with a docblock rather than paying for it globally:
		//
		//     /** @vitest-environment jsdom */
		//
		// If that reintroduces the Node 20 failure, the choice is happy-dom or
		// dropping Node 20, which reached end of life in April 2026.
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"]
	}
})
