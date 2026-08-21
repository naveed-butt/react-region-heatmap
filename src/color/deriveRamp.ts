import type { ColorMode, RampEasing } from "../types"
import { clampChromaToGamut, hexToOklch, oklchToHex, type Oklch } from "./oklch"

/**
 * Deriving an N-shade ramp from a single brand colour.
 *
 * The ramp is always ordered *least first*: index 0 is the faintest end and
 * index N-1 is the densest. What "faint" means depends on the surface, and this
 * is the part people get wrong. On a light page the faint end is a near-white
 * tint and density reads as darkness. On a dark page that inverts: a near-black
 * blue reads as *empty*, not as dense, so the ramp climbs towards light instead.
 * Contrast against the page is the signal, not darkness.
 */

declare const process: { env?: { NODE_ENV?: string } } | undefined

const warn = (message: string): void => {
	if (
		typeof process !== "undefined" &&
		process?.env?.NODE_ENV !== "production"
	) {
		console.warn(`[react-region-heatmap] ${message}`)
	}
}

/** Linear interpolation. */
const mix = (from: number, to: number, t: number): number =>
	from + (to - from) * t

/**
 * Lightness the ramp travels between, per surface.
 *
 * `from` is the faint end (index 0), `to` is the dense end (index N-1). In
 * light mode the dense end is left at the caller's own lightness so their brand
 * colour appears on the map exactly as they specified it.
 */
export const RAMP_LIGHTNESS: Record<ColorMode, { from: number; to: number }> = {
	light: { from: 0.96, to: Number.NaN },
	dark: { from: 0.28, to: 0.88 }
}

/**
 * ── DESIGN DECISION — this function sets how the whole component looks ──
 *
 * Given a position along the ramp, return the OKLCH colour for that stop.
 *
 * `position` is 0 at the faint end and 1 at the dense end. `base` is the
 * caller's `primaryColor` already converted to OKLCH. `mode` says which surface
 * the map sits on.
 *
 * Three things are open, and they interact:
 *
 *  1. **How pale the faint end goes.** `RAMP_LIGHTNESS.light.from` is 0.96 —
 *     nearly white. Push it up and low-value regions start disappearing into
 *     the page; pull it down and the ramp loses its top end of contrast.
 *
 *  2. **Whether chroma tapers.** Holding `base.c` flat across the ramp makes
 *     pale stops look washed-out and slightly pink for blue palettes, because
 *     high chroma at high lightness is outside where the eye expects it.
 *     Scaling chroma down towards the faint end fixes that but costs saturation.
 *
 *  3. **The curve.** Linear in OKLCH lightness is already perceptually even.
 *     Easing towards the dense end buys more separation among the high-value
 *     regions — usually the ones people are actually looking at — at the cost
 *     of squashing the low end together.
 *
 * The implementation below is the honest naive version: linear lightness, flat
 * chroma, no taper. It is correct and a bit flat. Replace it.
 */
const rampStop = (position: number, base: Oklch, mode: ColorMode): Oklch => {
	const range = RAMP_LIGHTNESS[mode]
	const to = Number.isNaN(range.to) ? base.l : range.to

	return {
		l: mix(range.from, to, position),
		c: base.c,
		h: base.h
	}
}

export interface DeriveRampOptions {
	/** Brand colour as hex. Anything unparseable falls back to a flat ramp. */
	primaryColor: string
	steps: number
	mode?: ColorMode
	easing?: RampEasing
}

/**
 * Build the ramp, faintest first.
 *
 * `easing: "linear"` is accepted for callers who explicitly want naive sRGB
 * behaviour; it interpolates the same endpoints without the perceptual space.
 */
export const deriveRamp = ({
	primaryColor,
	steps,
	mode = "light"
}: DeriveRampOptions): string[] => {
	const count = Math.max(Math.floor(steps), 1)
	const base = hexToOklch(primaryColor)

	if (!base) {
		warn(
			`primaryColor "${primaryColor}" is not a hex colour, so no ramp could ` +
				"be derived. Pass an explicit `ramp` instead."
		)

		return Array<string>(count).fill(primaryColor)
	}

	// A one-shade ramp is just the brand colour; there is nothing to travel
	// between, and dividing by zero below would produce NaN.
	if (count === 1) return [oklchToHex(base)]

	// Every stop is gamut-clamped: a ramp walks up the lightness axis, which is
	// exactly where a saturated hue stops being representable in sRGB.
	return Array.from({ length: count }, (_, index) =>
		oklchToHex(clampChromaToGamut(rampStop(index / (count - 1), base, mode)))
	)
}
