/**
 * Moving focus between regions.
 *
 * The map uses a roving tabindex: exactly one region is tabbable at a time, so
 * Tab moves past the map as a single stop and the arrow keys move *within* it.
 * A map of fifty states that put fifty stops in the tab order would be an
 * accessibility failure dressed up as accessibility.
 */

/** Keys this module claims. Anything else must be left to the browser. */
const HANDLED = new Set([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	"Home",
	"End"
])

export const handlesKey = (key: string): boolean => HANDLED.has(key)

/**
 * ── DESIGN DECISION — this function sets how the map feels to a keyboard user ──
 *
 * Given the currently focused region index and the key pressed, return the
 * index to move to. Return `current` to stay put.
 *
 * Three things are open, and they are more interesting than they look:
 *
 *  1. **Wrap or clamp at the ends.** Wrapping means a keyboard user can never
 *     get stuck, and cycling the whole map is fast. It also means pressing
 *     Right at the last region silently teleports focus to the first, which on
 *     a *map* — where position carries meaning — can read as a bug rather than
 *     as a convenience.
 *
 *  2. **Whether the two axes differ.** Left/Right and Up/Down both stepping by
 *     one is honest about what this actually is: a list, traversed in whatever
 *     order the caller happened to put their regions in. Making Up/Down jump by
 *     a larger stride gives coarse and fine movement, which suits an alphabetic
 *     list but means nothing geographically.
 *
 *  3. **Whether to navigate spatially instead.** The genuinely right answer for
 *     a map is that Up goes to the region physically above. That needs each
 *     region's bounding box, which needs `getBBox()`, which needs layout — so
 *     it cannot be a pure function, it costs a measurement pass on mount, and
 *     it degrades on server render. Whether that is worth it depends on whether
 *     callers' regions are geographic or just a list of territories.
 *
 * The implementation below is the honest naive version: document order, one
 * step per press, wrapping at both ends, Home and End to the extremes. It works
 * and it is predictable. Replace it if you want something better.
 */
export const nextRegionIndex = (
	current: number,
	key: string,
	count: number
): number => {
	if (count === 0) return current

	switch (key) {
		case "ArrowRight":
		case "ArrowDown":
			return (current + 1) % count

		case "ArrowLeft":
		case "ArrowUp":
			return (current - 1 + count) % count

		case "Home":
			return 0

		case "End":
			return count - 1

		default:
			return current
	}
}
