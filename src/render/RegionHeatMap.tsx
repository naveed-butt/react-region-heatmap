import {
	useCallback,
	useMemo,
	useRef,
	useState,
	type FocusEvent as ReactFocusEvent,
	type KeyboardEvent,
	type MouseEvent as ReactMouseEvent
} from "react"
import type { RegionHeatMapProps, TooltipContext } from "../types"
import { BORDER_WIDTH, HIGHLIGHT_WIDTH, SURFACE } from "./defaults"
import { handlesKey, nextRegionIndex } from "./keyboard"
import { Legend } from "./Legend"
import { resolveView } from "./resolveView"
import { Tooltip } from "./Tooltip"

/**
 * The renderer.
 *
 * All of the arithmetic happens in `resolveView`; what is left here is state,
 * events and markup. Three things are less obvious than they look, and each has
 * a comment where it happens: how the highlight outline is painted over its
 * neighbours, why focus and hover share one piece of state, and how the tooltip
 * is positioned without ever measuring the tooltip.
 */

/** Anchor for the tooltip, in wrapper-relative pixels. */
interface Anchor {
	x: number
	y: number
}

const parseViewBox = (viewBox: string): [number, number, number, number] => {
	const parts = viewBox
		.split(/[\s,]+/)
		.map(Number)
		.filter(Number.isFinite)

	return parts.length === 4
		? [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 1, parts[3] ?? 1]
		: [0, 0, 1, 1]
}

export const RegionHeatMap = ({
	map,
	data,
	primaryColor,
	ramp,
	steps,
	zeroColor,
	missingColor,
	borderColor,
	hoverBorderColor,
	colorMode = "light",
	rampEasing,
	scale,
	onRegionClick,
	onRegionHover,
	selectedIds,
	interactive = true,
	showLegend = false,
	showTooltip = true,
	renderTooltip,
	formatValue,
	legendLabel,
	ariaLabel = "Heat map",
	className,
	style
}: RegionHeatMapProps) => {
	const view = useMemo(
		() =>
			resolveView({
				map,
				data,
				primaryColor,
				ramp,
				steps,
				zeroColor,
				missingColor,
				colorMode,
				rampEasing,
				scale
			}),
		[
			map,
			data,
			primaryColor,
			ramp,
			steps,
			zeroColor,
			missingColor,
			colorMode,
			rampEasing,
			scale
		]
	)

	const surface = SURFACE[colorMode]
	const border = borderColor ?? surface.border
	const highlight = hoverBorderColor ?? surface.highlight

	const wrapper = useRef<HTMLDivElement>(null)
	const svg = useRef<SVGSVGElement>(null)

	/**
	 * Hover and keyboard focus are one piece of state, not two.
	 *
	 * They are the same idea - "the region the user is currently interrogating"
	 * - and tracking them separately means deciding which one wins when a user
	 * tabs to one region while the pointer rests over another. A single slot
	 * makes last-interaction-wins the only answer available.
	 */
	const [activeIndex, setActiveIndex] = useState(-1)
	const [anchor, setAnchor] = useState<Anchor | null>(null)

	/** Which region Tab lands on. Separate from `activeIndex`, which clears. */
	const [tabIndex, setTabIndex] = useState(0)

	const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds])

	const format = useMemo(() => {
		if (formatValue) return formatValue

		// Built lazily and memoised: constructing an Intl formatter is not free,
		// and doing it per region per render on a fifty-region map is visible.
		const formatter = new Intl.NumberFormat()

		return (value: number) => formatter.format(value)
	}, [formatValue])

	/**
	 * Wrapper-relative centre, used whenever a region cannot be measured.
	 *
	 * Every anchor here degrades to a position rather than to nothing. A
	 * tooltip in a slightly odd place still tells the user the value; a
	 * suppressed tooltip tells them the map is broken.
	 */
	const fallbackAnchor = useCallback((): Anchor => {
		const host = wrapper.current
		if (!host) return { x: 0, y: 0 }

		const rect = host.getBoundingClientRect()

		return { x: rect.width / 2, y: rect.height / 2 }
	}, [])

	/** Wrapper-relative point for a pointer event. */
	const pointFor = useCallback(
		(event: ReactMouseEvent): Anchor => {
			const host = wrapper.current
			if (!host) return fallbackAnchor()

			const rect = host.getBoundingClientRect()

			return { x: event.clientX - rect.left, y: event.clientY - rect.top }
		},
		[fallbackAnchor]
	)

	/**
	 * Wrapper-relative centre of a region, for keyboard focus.
	 *
	 * There is no cursor to follow when focus arrives by keyboard, so the
	 * tooltip anchors to the region itself. `getBBox` forces layout, but it only
	 * ever runs inside an event handler - never during render, never at module
	 * scope - so a server render never reaches it. jsdom does not implement it
	 * at all, which is why this guards rather than calling it outright.
	 */
	const centreFor = useCallback(
		(element: SVGPathElement): Anchor => {
			const host = wrapper.current
			const root = svg.current

			if (!host || !root || typeof element.getBBox !== "function") {
				return fallbackAnchor()
			}

			try {
				const box = element.getBBox()
				const hostRect = host.getBoundingClientRect()
				const svgRect = root.getBoundingClientRect()
				const [vbX, vbY, vbW, vbH] = parseViewBox(map.viewBox)

				if (svgRect.width === 0 || vbW === 0 || vbH === 0) {
					return fallbackAnchor()
				}

				return {
					x:
						svgRect.left -
						hostRect.left +
						((box.x + box.width / 2 - vbX) / vbW) * svgRect.width,
					y:
						svgRect.top -
						hostRect.top +
						((box.y + box.height / 2 - vbY) / vbH) * svgRect.height
				}
			} catch {
				// A path the browser cannot measure costs the tooltip its exact
				// position, and nothing else.
				return fallbackAnchor()
			}
		},
		[map.viewBox, fallbackAnchor]
	)

	const activate = useCallback(
		(index: number, at: Anchor) => {
			setActiveIndex(index)
			setAnchor(at)

			const entry = view.regions[index]
			if (entry) onRegionHover?.(entry.region, entry.value)
		},
		[view.regions, onRegionHover]
	)

	const deactivate = useCallback(() => {
		setActiveIndex(-1)
		setAnchor(null)
		onRegionHover?.(null, 0)
	}, [onRegionHover])

	const onKeyDown = useCallback(
		(event: KeyboardEvent<SVGPathElement>, index: number) => {
			const entry = view.regions[index]

			if (event.key === "Enter" || event.key === " ") {
				// A role="button" is expected to fire on both keys, and Space
				// scrolls the page if it is not claimed here.
				event.preventDefault()
				if (entry) onRegionClick?.(entry.region, entry.value)
				return
			}

			if (!handlesKey(event.key)) return

			event.preventDefault()

			const next = nextRegionIndex(index, event.key, view.regions.length)
			if (next === index) return

			setTabIndex(next)

			// Moving focus is what updates the highlight and the tooltip: the
			// focus handler on the destination does that work, so there is
			// nothing to set here beyond the roving tabindex.
			svg.current
				?.querySelector<SVGPathElement>(`[data-region-index="${next}"]`)
				?.focus()
		},
		[view.regions, onRegionClick]
	)

	const onFocus = useCallback(
		(event: ReactFocusEvent<SVGPathElement>, index: number) => {
			setTabIndex(index)
			activate(index, centreFor(event.currentTarget))
		},
		[activate, centreFor]
	)

	const active = activeIndex >= 0 ? view.regions[activeIndex] : undefined

	/**
	 * Clamped rather than stored clamped.
	 *
	 * A caller who filters their map down to fewer regions leaves this index
	 * pointing past the end, and then no region carries `tabindex="0"` and the
	 * map drops out of the tab order altogether. Deriving it on the way out
	 * fixes that without an effect that fires on every data change.
	 */
	const tabbable = Math.min(tabIndex, Math.max(view.regions.length - 1, 0))

	const tooltip = useMemo(() => {
		if (!active || !showTooltip || !interactive) return null

		if (renderTooltip) {
			const context: TooltipContext = {
				region: active.region,
				value: active.value,
				share: active.share,
				bucket: active.bucket
			}

			return renderTooltip(context)
		}

		return (
			<>
				<strong>{active.region.name}</strong>
				{": "}
				{active.present ? format(active.value) : "No data"}
			</>
		)
	}, [active, showTooltip, interactive, renderTooltip, format])

	return (
		<div
			ref={wrapper}
			className={className}
			style={{ position: "relative", ...style }}
		>
			<svg
				ref={svg}
				viewBox={map.viewBox}
				// role="group" when the regions are focusable children, because an
				// image cannot contain controls. A static map really is one image
				// and says so.
				role={interactive ? "group" : "img"}
				aria-label={ariaLabel}
				style={{ display: "block", width: "100%", height: "auto" }}
				onMouseLeave={interactive ? deactivate : undefined}
			>
				{view.regions.map((entry, index) => (
					<path
						key={entry.region.id}
						data-region-index={index}
						data-region-id={entry.region.id}
						d={entry.region.path}
						fill={entry.fill}
						stroke={border}
						strokeWidth={BORDER_WIDTH}
						// Holds the hairline at one screen pixel whatever units the
						// caller's viewBox happens to use.
						vectorEffect="non-scaling-stroke"
						role={interactive ? "button" : undefined}
						// The tooltip is aria-hidden, so the value has to reach a
						// screen reader from here instead.
						aria-label={
							interactive
								? `${entry.region.name}: ${
										entry.present ? format(entry.value) : "no data"
									}`
								: undefined
						}
						aria-pressed={
							interactive && selectedIds
								? selected.has(entry.region.id)
								: undefined
						}
						tabIndex={interactive ? (index === tabbable ? 0 : -1) : undefined}
						style={{
							cursor: interactive && onRegionClick ? "pointer" : undefined,
							outline: "none",
							transition: "fill 140ms ease"
						}}
						onMouseEnter={
							interactive
								? event => activate(index, pointFor(event))
								: undefined
						}
						onMouseMove={
							interactive ? event => setAnchor(pointFor(event)) : undefined
						}
						onClick={
							interactive
								? () => onRegionClick?.(entry.region, entry.value)
								: undefined
						}
						onKeyDown={
							interactive ? event => onKeyDown(event, index) : undefined
						}
						onFocus={interactive ? event => onFocus(event, index) : undefined}
						onBlur={interactive ? deactivate : undefined}
					/>
				))}

				{/*
					SVG has no z-index, so an outline drawn on the region itself is
					painted over by every sibling after it. Two tempting fixes both
					fail:

					Reordering so the highlighted path comes last makes React move a
					live DOM node out from under the cursor, which can re-fire
					pointer events and flicker between states.

					`<use href="#region">` with `fill="none"` looks like it clones
					just the outline, and does not. A presentation attribute on the
					referenced element beats the value inherited from the `<use>`,
					so the clone keeps the region's own fill and paints a filled
					copy over its neighbours - and it needs per-element ids, which
					collide across render roots because `useId` restarts in each
					one.

					Re-emitting the geometry as an outline-only path is duplication,
					but only of the one or two regions currently highlighted, and it
					has no precedence rules and no ids to collide.
				*/}
				{view.regions.map((entry, index) =>
					selected.has(entry.region.id) ||
					(interactive && index === activeIndex) ? (
						<path
							key={`highlight-${entry.region.id}`}
							data-highlight-for={entry.region.id}
							d={entry.region.path}
							fill="none"
							stroke={highlight}
							strokeWidth={HIGHLIGHT_WIDTH}
							vectorEffect="non-scaling-stroke"
							pointerEvents="none"
							aria-hidden="true"
						/>
					) : null
				)}
			</svg>

			{tooltip && anchor && (
				<Tooltip x={anchor.x} y={anchor.y} mode={colorMode}>
					{tooltip}
				</Tooltip>
			)}

			{showLegend && (
				<Legend
					view={view}
					mode={colorMode}
					formatValue={format}
					legendLabel={legendLabel}
				/>
			)}
		</div>
	)
}
