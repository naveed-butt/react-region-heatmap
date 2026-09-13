import type { CSSProperties, ReactNode } from "react"
import type { ColorMode } from "../types"
import { SURFACE, TOOLTIP_OFFSET } from "./defaults"

/**
 * The floating label.
 *
 * Positioned in the wrapper's coordinate space rather than the viewport, so it
 * travels with the map when the page scrolls and needs no scroll listener. It
 * is `pointer-events: none` throughout: a tooltip that can be hovered is a
 * tooltip that can steal the pointer from the region that summoned it and
 * flicker between the two states forever.
 */

export interface TooltipProps {
	/** Anchor in wrapper-relative pixels. */
	x: number
	y: number
	mode: ColorMode
	children: ReactNode
}

const base: CSSProperties = {
	position: "absolute",
	// Sit above the anchor and centred on it. A transform rather than margins
	// so the element does not need to be measured first.
	transform: "translate(-50%, -100%)",
	pointerEvents: "none",
	whiteSpace: "nowrap",
	padding: "6px 9px",
	borderRadius: 6,
	fontSize: 12,
	lineHeight: 1.35,
	fontFamily: "inherit",
	// Keeps the label legible over a saturated fill without a backdrop.
	boxShadow: "0 2px 8px rgba(15, 23, 42, 0.24)",
	zIndex: 1
}

export const Tooltip = ({ x, y, mode, children }: TooltipProps) => {
	const surface = SURFACE[mode]

	return (
		<div
			role="tooltip"
			aria-hidden="true"
			style={{
				...base,
				left: x,
				top: y - TOOLTIP_OFFSET,
				background: surface.tooltipBackground,
				color: surface.tooltipForeground
			}}
		>
			{children}
		</div>
	)
}
