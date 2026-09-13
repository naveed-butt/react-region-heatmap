import { warn } from "../internal/warn"
import type { HeatData } from "../types"

/**
 * Collapsing the two accepted data shapes into one lookup.
 *
 * `HeatData` is either an array of `{ id, value }` or a plain record. Callers
 * holding a lookup already should not have to map it into objects just to hand
 * it over, and callers holding rows should not have to build a lookup. Both
 * arrive here and leave as a Map.
 *
 * A Map rather than a record because region ids are caller-supplied strings,
 * and a caller with a region legitimately named "constructor" or "__proto__"
 * should get a working map rather than a mystery.
 */

/**
 * Absence is preserved, not flattened.
 *
 * An id that is missing from this Map is a region nobody measured; an id
 * present with a value of `0` is a region measured as empty. The renderer
 * paints those differently — `missingColor` against `zeroColor` — so the
 * distinction has to survive normalisation. This is why non-finite values are
 * dropped entirely rather than coerced to zero: `NaN` is a failed measurement,
 * not a measurement of nothing.
 */
export const resolveData = (data: HeatData): Map<string, number> => {
	const entries: [string, number][] = Array.isArray(data)
		? data.map(datum => [datum.id, datum.value])
		: Object.entries(data)

	const values = new Map<string, number>()
	const duplicates: string[] = []
	let dropped = 0

	for (const [id, value] of entries) {
		if (!Number.isFinite(value)) {
			dropped += 1
			continue
		}

		if (values.has(id)) duplicates.push(id)

		// Last write wins. Neither summing nor first-wins is obviously right,
		// but last-wins matches how the record form already behaves, and two
		// shapes of the same input disagreeing would be worse than either rule.
		values.set(id, value)
	}

	if (dropped > 0) {
		warn(
			`data contained ${dropped} non-finite value(s); those regions are ` +
				"treated as missing rather than as zero."
		)
	}

	if (duplicates.length > 0) {
		warn(
			`data contained duplicate ids (${[...new Set(duplicates)].join(", ")}); ` +
				"the last value for each was used."
		)
	}

	return values
}
