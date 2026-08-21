import { defineConfig } from "tsup"

export default defineConfig({
	entry: {
		index: "src/index.ts"
	},
	format: ["esm", "cjs"],
	dts: true,
	sourcemap: true,
	clean: true,
	treeshake: true,
	target: "es2020",

	// React is a peer dependency and must never be bundled — two copies of React
	// in one app breaks hooks.
	external: ["react", "react/jsx-runtime"]
})
