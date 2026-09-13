# Maps

Bundled geometry. Each map is its own package entry point, so its path data
only reaches bundles that import it.

## United States — `us.ts`

Import from `react-region-heatmap/maps/us`.

- **Coordinate space:** `0 0 959 593`.
- **Projection:** Albers equal-area conic, standard parallels 29.5°N and
  45.5°N, central meridian 96°W. Alaska and Hawaii are repositioned insets,
  not true scale or position.
- **Region ids:** USPS postal codes (`TX`, `CA`, `DC`), so data keyed the usual
  way joins with no mapping step.
- **Order:** the 50 states alphabetical by name. DC, when included, comes last.

### State outlines

Derived from [`react-usa-map`](https://github.com/gabidavila/react-usa-map)
under the MIT Licence. The path data was extracted as text and never executed,
and no code from that project is included. Attribution is in
[NOTICE](../../NOTICE).

### District of Columbia

`react-usa-map` has no DC and doesn't document its projection. The DC outline
here is generated independently by
[`scripts/generate-dc-outline.mjs`](../../scripts/generate-dc-outline.mjs):

1. Assume a US Albers conic with the standard parallels, and leave the central
   meridian, scale and offset unknown.
2. Pair ten surveyed state corners (Colorado and Wyoming's four corners each,
   and the two ends of Maryland's Mason–Dixon border) with the matching
   vertices in the state paths.
3. Find the central meridian, scale and offset that fit those points best
   (least squares). The fit lands on **96.00°W**, the USGS standard, with
   **1.05 units** of RMS error. The tripoint nearest DC is off by 0.06 units.
   That match is good evidence the projection assumption is right.
4. Project DC's boundary through the fitted projection. The straight edges run
   between the 1791 boundary stones. The western edge follows the Virginia
   shore of the Potomac, reduced to the few points that still show at this
   size.

At 959 units wide, DC is about 3.7 × 4.4 units: correct, and far too small to
click. That's why there are two ways to draw it:

| `dcStyle`           | Path                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `"callout"` default | A 16-unit square at `(845, 255)`, in open water off the Delmarva coast. |
| `"outline"`         | The projected boundary above, in its real position between MD and VA.   |

The callout's position was chosen by sampling for at least six units of
clearance from every state outline. `us.test.tsx` checks that clearance again,
so a geometry change can't quietly hide the square inside a state.

To regenerate after changing the geometry or the boundary points:

```bash
node scripts/generate-dc-outline.mjs
```

It prints the fit and the path. Paste the path into `DC_OUTLINE` in `us.ts`.
If the calibration vertices moved, update them in the script first.
