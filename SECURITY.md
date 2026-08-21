# Security Policy

## Supported versions

This project is pre-release. Until `1.0.0`, only the latest published version
receives fixes.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/naveed-butt/react-region-heatmap/security/advisories/new).
You should get an acknowledgement within a few days.

## Scope

This is a rendering component with no network access, no storage and no runtime
dependencies, so its attack surface is small. The realistic concerns are:

- **Untrusted geometry.** `RegionGeometry.path` is written straight into an SVG
  `d` attribute. Path data is not executable and `d` is not an event handler, but
  treat geometry from untrusted sources with the same care as any other
  user-supplied content.
- **Untrusted colour values.** Colour props are written into `style`. Passing
  unvalidated user input into them is not advisable.

Both are properties of how you use the component rather than defects in it, but
reports that show a way to turn either into script execution are very much in
scope.
