/**
 * Regenerates the District of Columbia outline in src/maps/us.ts.
 *
 *     node scripts/generate-dc-outline.mjs
 *
 * The state outlines this library bundles come without DC, and without any
 * record of the projection that produced them. This script recovers that
 * projection from the outlines themselves, then projects DC's real boundary
 * through it, so the result is independently generated rather than copied.
 *
 *  1. Assume the standard US Albers equal-area conic: parallels 29.5°N and
 *     45.5°N. Leave the central meridian, scale and offset unknown.
 *  2. Pair surveyed state corners (latitude/longitude) with the matching
 *     vertices in the bundled paths.
 *  3. Least-squares fit scale and offset for every candidate meridian and keep
 *     the best. It lands on 96°W, the USGS standard, with about 1 unit of RMS
 *     error, which is good evidence the assumption in step 1 is right.
 *  4. Project DC's boundary and print it as an SVG path.
 *
 * No dependencies and no globals beyond the language, so it runs anywhere Node
 * does and lints under the repo's config unchanged.
 */

import { stdout } from "node:process"

const STANDARD_PARALLELS = [29.5, 45.5]

/** [label, latitude, longitude, x, y] — the x/y are vertices in src/maps/us.ts. */
const CALIBRATION = [
	["Colorado NW", 41.0023, -109.0503, 265.1, 223.4],
	["Colorado NE", 41.0024, -102.0515, 380.2, 235.5],
	["Colorado SE", 36.9931, -102.042, 374.5, 321.5],
	["Colorado SW", 36.999, -109.0452, 254.0, 309.6],
	["Wyoming NW", 45.0005, -111.0546, 247.2, 130.5],
	["Wyoming NE", 45.0023, -104.0577, 354.5, 144.0],
	["Wyoming SE", 41.0017, -104.0532, 347.1, 231.3],
	["Wyoming SW", 40.9946, -111.0468, 233.2, 218.9],
	["MD / PA / WV", 39.7212, -79.4769, 757.5, 241.9],
	["MD / PA / DE", 39.7215, -75.788, 817.3, 230.0]
]

/**
 * DC's boundary, clockwise from the north corner. The straight edges are the
 * lines between the 1791 boundary stones; the western edge follows the
 * Virginia shore of the Potomac, simplified to the handful of points that
 * survive at four units across.
 */
const DC_BOUNDARY = [
	[38.9955, -77.041], // north corner
	[38.8929, -76.9094], // east corner
	[38.7916, -77.039], // southern tip, at the river
	[38.852, -77.04],
	[38.888, -77.058],
	[38.902, -77.07],
	[38.93, -77.117],
	[38.9346, -77.1197] // where the Maryland line meets the river
]

const radians = degrees => (degrees * Math.PI) / 180

const albers = centralMeridian => {
	const [p1, p2] = STANDARD_PARALLELS.map(radians)
	const n = (Math.sin(p1) + Math.sin(p2)) / 2
	const c = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1)

	return (latitude, longitude) => {
		const rho = Math.sqrt(c - 2 * n * Math.sin(radians(latitude))) / n
		const theta = n * radians(longitude - centralMeridian)

		return [rho * Math.sin(theta), rho * Math.cos(theta)]
	}
}

const determinant = m =>
	m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
	m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
	m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])

/** Fit x = k·X + tx, y = k·Y + ty for one meridian; return the fit and its RMS. */
const fit = centralMeridian => {
	const project = albers(centralMeridian)
	const rows = CALIBRATION.map(([, lat, lon, x, y]) => [
		...project(lat, lon),
		x,
		y
	])

	let sqq = 0,
		sX = 0,
		sY = 0,
		sqx = 0,
		sx = 0,
		sy = 0
	for (const [X, Y, x, y] of rows) {
		sqq += X * X + Y * Y
		sX += X
		sY += Y
		sqx += X * x + Y * y
		sx += x
		sy += y
	}

	const a = [
		[sqq, sX, sY],
		[sX, rows.length, 0],
		[sY, 0, rows.length]
	]
	const b = [sqx, sx, sy]
	const d = determinant(a)
	const [k, tx, ty] = [0, 1, 2].map(
		column =>
			determinant(
				a.map((row, r) => row.map((v, c) => (c === column ? b[r] : v)))
			) / d
	)

	const squared = rows.map(
		([X, Y, x, y]) => (k * X + tx - x) ** 2 + (k * Y + ty - y) ** 2
	)
	const rms = Math.sqrt(squared.reduce((sum, e) => sum + e, 0) / rows.length)

	return {
		centralMeridian,
		rms,
		toScreen: (lat, lon) => {
			const [X, Y] = project(lat, lon)
			return [k * X + tx, k * Y + ty]
		}
	}
}

let best = fit(-110)
for (let meridian = -110; meridian <= -80; meridian += 0.05) {
	const candidate = fit(meridian)
	if (candidate.rms < best.rms) best = candidate
}

const round = value => +value.toFixed(2)
const points = DC_BOUNDARY.map(([lat, lon]) => best.toScreen(lat, lon))
const path =
	"M" + points.map(([x, y]) => `${round(x)},${round(y)}`).join(" L") + " Z"

stdout.write(
	`central meridian ${best.centralMeridian.toFixed(2)}°, RMS ${best.rms.toFixed(2)} units\n`
)
stdout.write(`${path}\n`)
