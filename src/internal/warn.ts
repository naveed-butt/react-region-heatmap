/**
 * Development-only warnings.
 *
 * `process` is not declared without @types/node, and this package must not
 * depend on Node types to build. The guard below is the standard React pattern:
 * bundlers substitute a literal for `process.env.NODE_ENV`, so in a production
 * build the whole call collapses into dead code and drops out.
 *
 * Everything in this library repairs bad input rather than throwing. A
 * malformed scale or an unparseable colour should not take down the page that
 * embeds the map — but it should be loud in development, and this is where
 * that loudness lives.
 */

declare const process: { env?: { NODE_ENV?: string } } | undefined

export const isDev = (): boolean =>
	typeof process !== "undefined" && process?.env?.NODE_ENV !== "production"

export const warn = (message: string): void => {
	if (isDev()) console.warn(`[react-region-heatmap] ${message}`)
}
