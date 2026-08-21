import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default tseslint.config(
	{ ignores: ["dist/**", "coverage/**", "node_modules/**"] },
	js.configs.recommended,
	tseslint.configs.recommended,
	reactHooks.configs.flat["recommended-latest"],
	{
		files: ["**/*.{ts,tsx}"],
		rules: {
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{ prefer: "type-imports", fixStyle: "inline-type-imports" }
			],
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
			]
		}
	}
)
