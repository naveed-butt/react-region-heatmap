/**
 * sRGB hex <-> OKLCH, with no dependencies.
 *
 * OKLab (Björn Ottosson, 2020) is a perceptual colour space: equal numeric
 * steps in it look like equal steps to a human eye. That is the whole reason it
 * is here — interpolating a colour ramp in sRGB or HSL produces shades that
 * bunch up at one end and stretch at the other, which is the classic tell of a
 * hand-rolled heat map.
 *
 * Only hex input is supported. Named colours and `rgb()` need a DOM to resolve
 * and this module has to work during prerender, so callers passing anything
 * else should supply an explicit `ramp` instead.
 */

export interface Oklch {
	/** Perceptual lightness, 0..1. */
	l: number
	/** Chroma, 0..~0.4 in practice. */
	c: number
	/** Hue in degrees, 0..360. */
	h: number
}

export interface Rgb {
	/** 0..255 */
	r: number
	/** 0..255 */
	g: number
	/** 0..255 */
	b: number
}

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max)

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Returns null rather than throwing: bad colour input must not blank a page. */
export const parseHex = (hex: string): Rgb | null => {
	const match = HEX_PATTERN.exec(hex.trim())

	if (!match) return null

	const digits = match[1] as string

	const full =
		digits.length === 3
			? digits
					.split("")
					.map(digit => digit + digit)
					.join("")
			: digits

	return {
		r: parseInt(full.slice(0, 2), 16),
		g: parseInt(full.slice(2, 4), 16),
		b: parseInt(full.slice(4, 6), 16)
	}
}

export const toHex = ({ r, g, b }: Rgb): string => {
	const channel = (value: number): string =>
		Math.round(clamp(value, 0, 255))
			.toString(16)
			.padStart(2, "0")

	return `#${channel(r)}${channel(g)}${channel(b)}`
}

/* -- Transfer function ----------------------------------------------------- */

const toLinear = (channel: number): number => {
	const value = channel / 255

	return value <= 0.04045
		? value / 12.92
		: Math.pow((value + 0.055) / 1.055, 2.4)
}

/** Unclamped on purpose: gamut checks need to see how far outside we are. */
const fromLinear = (value: number): number => {
	const channel =
		value <= 0.0031308
			? value * 12.92
			: 1.055 * Math.pow(value, 1 / 2.4) - 0.055

	return channel * 255
}

/* -- OKLab ----------------------------------------------------------------- */

export const rgbToOklch = ({ r, g, b }: Rgb): Oklch => {
	const lr = toLinear(r)
	const lg = toLinear(g)
	const lb = toLinear(b)

	const long = Math.cbrt(
		0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
	)
	const medium = Math.cbrt(
		0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
	)
	const short = Math.cbrt(
		0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
	)

	const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short
	const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
	const bAxis =
		0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short

	const hue = (Math.atan2(bAxis, a) * 180) / Math.PI

	return {
		l,
		c: Math.sqrt(a * a + bAxis * bAxis),
		h: hue < 0 ? hue + 360 : hue
	}
}

/**
 * Raw conversion, with channels left outside 0..255 when the colour is not
 * representable in sRGB. Use `oklchToRgb` for anything that will be displayed.
 */
export const oklchToRgbRaw = ({ l, c, h }: Oklch): Rgb => {
	const radians = (h * Math.PI) / 180
	const a = c * Math.cos(radians)
	const bAxis = c * Math.sin(radians)

	const long = (l + 0.3963377774 * a + 0.2158037573 * bAxis) ** 3
	const medium = (l - 0.1055613458 * a - 0.0638541728 * bAxis) ** 3
	const short = (l - 0.0894841775 * a - 1.291485548 * bAxis) ** 3

	return {
		r: fromLinear(
			4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short
		),
		g: fromLinear(
			-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short
		),
		b: fromLinear(
			-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short
		)
	}
}

export const oklchToRgb = (oklch: Oklch): Rgb => {
	const { r, g, b } = oklchToRgbRaw(oklch)

	return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) }
}

/** Tolerance in 0..255 channel units, to absorb floating-point noise. */
const GAMUT_EPSILON = 0.5

export const isInGamut = (oklch: Oklch): boolean => {
	const { r, g, b } = oklchToRgbRaw(oklch)

	return [r, g, b].every(
		channel => channel >= -GAMUT_EPSILON && channel <= 255 + GAMUT_EPSILON
	)
}

/**
 * Reduce chroma until the colour actually exists in sRGB, holding lightness and
 * hue fixed.
 *
 * Without this, a saturated hue at high lightness converts to channel values
 * beyond 255. Clamping those per channel does not merely lighten the colour, it
 * *rotates the hue*: #2f558f held at its own chroma and pushed to L=0.96 pins
 * its blue channel and comes back as cyan, 44 degrees off. A ramp is precisely
 * a walk up the lightness axis, so that failure is guaranteed rather than
 * incidental, and it is handled here rather than left to every caller.
 *
 * Binary search rather than an analytic boundary: the sRGB gamut has no closed
 * form in OKLCH, and 24 iterations resolve chroma far finer than 8-bit output.
 */
export const clampChromaToGamut = (oklch: Oklch): Oklch => {
	if (isInGamut(oklch)) return oklch

	let low = 0
	let high = oklch.c

	for (let step = 0; step < 24; step += 1) {
		const mid = (low + high) / 2

		if (isInGamut({ ...oklch, c: mid })) low = mid
		else high = mid
	}

	return { ...oklch, c: low }
}

export const hexToOklch = (hex: string): Oklch | null => {
	const rgb = parseHex(hex)

	return rgb ? rgbToOklch(rgb) : null
}

/**
 * Colours outside the sRGB gamut are clamped per channel on the way out. This
 * shifts hue slightly at extreme chroma, which is acceptable here because ramp
 * generation keeps chroma well inside the gamut by construction.
 */
export const oklchToHex = (oklch: Oklch): string => toHex(oklchToRgb(oklch))
