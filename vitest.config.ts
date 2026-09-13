import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		// The scale, colour and view engines are pure functions, so a DOM is
		// dead weight for most of this suite - and not free weight, so it is not
		// loaded globally. Component tests opt in per file with a docblock:
		//
		//     /** @vitest-environment happy-dom */
		//
		// happy-dom rather than jsdom because jsdom 30 declares
		// `^22.22.2 || ^24.15.0 || >=26.0.0` and simply does not support Node 20,
		// which this package still supports and still tests. That is the real
		// reason the earlier attempt broke CI; the undici `markAsUncloneable`
		// crash was the symptom. happy-dom declares `>=20.0.0` and keeps the
		// whole matrix green.
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"]
	}
})
