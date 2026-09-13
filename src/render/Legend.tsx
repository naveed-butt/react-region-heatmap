import type { CSSProperties } from "react"
import { bucketLowerBound } from "../scale/buildScale"
import type { ColorMode } from "../types"
import { SURFACE } from "./defaults"
import type { MapView } from "./resolveView"

/**
 * The key beneath the map.
 *
 * Buckets are `(lower, upper]`, so the label for bucket *n* runs from the
 * previous bucket's upper bound. The zero and missing swatches are appended
 * only when the data actually contains those cases — a legend entry for
 * "no data" on a map with no gaps in it is just noise, and worse, it implies
 * gaps exist.
 */

export interface LegendProps {
	view: MapView
	mode: ColorMode
	formatValue: (value: number) => string
	legendLabel?: (from: number, to: number, bucket: number) => string
}

const row: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: 6
}

const swatch = (fill: string, border: string): CSSProperties => ({
	width: 14,
	height: 14,
	borderRadius: 3,
	background: fill,
	// Without an outline the palest shade vanishes against a white page, and
	// the legend quietly loses its first entry.
	boxShadow: `inset 0 0 0 1px ${border}`,
	flex: "0 0 auto"
})

export const Legend = ({
	view,
	mode,
	formatValue,
	legendLabel
}: LegendProps) => {
	const surface = SURFACE[mode]
	const outline =
		mode === "light" ? "rgba(15,23,42,0.14)" : "rgba(248,250,252,0.2)"

	const label = (from: number, to: number, bucket: number): string =>
		legendLabel
			? legendLabel(from, to, bucket)
			: `${formatValue(from)}\u2013${formatValue(to)}`

	return (
		<div
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: "10px 16px",
				marginTop: 10,
				fontSize: 12,
				color: surface.legendForeground
			}}
		>
			{view.scale.upperBounds.map((upper, bucket) => (
				<span key={bucket} style={row}>
					<span
						style={swatch(
							view.ramp[Math.min(bucket, view.ramp.length - 1)] ??
								view.zeroFill,
							outline
						)}
					/>
					<span>
						{label(bucketLowerBound(bucket, view.scale), upper, bucket)}
					</span>
				</span>
			))}

			{view.hasZero && (
				<span style={row}>
					<span style={swatch(view.zeroFill, outline)} />
					<span>{formatValue(0)}</span>
				</span>
			)}

			{view.hasMissing && view.missingFill !== view.zeroFill && (
				<span style={row}>
					<span style={swatch(view.missingFill, outline)} />
					<span>No data</span>
				</span>
			)}
		</div>
	)
}
