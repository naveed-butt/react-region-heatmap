import type { ColorMode } from "../types"

/**
 * Everything the renderer falls back to when a prop is not given.
 *
 * These are deliberately *not* props in `types.ts`. Stroke widths and tooltip
 * offsets are the kind of knob that looks harmless to expose and then has to be
 * supported forever; a caller who needs to override them can pass `className`
 * and reach the elements through CSS. What is here is only what genuinely
 * changes with the surface the map sits on.
 */

export const DEFAULT_PRIMARY_COLOR = "#2f558f"

/** SVG user units, held constant on screen by `vector-effect`. */
export const BORDER_WIDTH = 1
export const HIGHLIGHT_WIDTH = 2

/** Gap between the cursor and the bottom edge of the tooltip, in px. */
export const TOOLTIP_OFFSET = 12

interface SurfaceDefaults {
	/** Regions measured as exactly zero. */
	zero: string
	/** Hairline between adjacent regions. */
	border: string
	/** Outline drawn over the hovered or focused region. */
	highlight: string
	tooltipBackground: string
	tooltipForeground: string
	legendForeground: string
}

/**
 * Light and dark are not colour inversions of each other.
 *
 * The border between regions reads as a *gap* — it wants to be the page colour,
 * not a contrasting line — so it flips with the surface. The highlight outline
 * is the opposite: it has to fight the surface to be visible at all.
 */
export const SURFACE: Record<ColorMode, SurfaceDefaults> = {
	light: {
		zero: "#eef1f5",
		border: "#ffffff",
		highlight: "#0f172a",
		tooltipBackground: "#0f172a",
		tooltipForeground: "#f8fafc",
		legendForeground: "#475569"
	},
	dark: {
		zero: "#1f2733",
		border: "#0b1118",
		highlight: "#f8fafc",
		tooltipBackground: "#f8fafc",
		tooltipForeground: "#0f172a",
		legendForeground: "#94a3b8"
	}
}
