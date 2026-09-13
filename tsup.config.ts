import { defineConfig } from "tsup"

export default defineConfig({
	entry: {
		index: "src/index.ts",
		// A separate entry rather than a re-export from index, so ~30 KB of path
		// data never reaches a bundle that brings its own geometry. Tree shaking
		// would drop it for ESM consumers, but CommonJS consumers get no such help.
		"maps/us": "src/maps/us.ts"
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
