# Contributing

Thanks for taking the time. Issues and pull requests are both welcome.

## Getting set up

```bash
npm install
npm test
npm run build
```

Everything CI checks, you can run locally:

```bash
npm run format:check   # prettier
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run build          # tsup
```

## Ground rules for changes

- **No runtime dependencies.** This is the point of the package. A pull request
  that adds one to `dependencies` will not be merged. `peerDependencies` stays
  at `react` alone.
- **Nothing may assume a DOM at module scope.** The component has to survive
  static export and prerendering, so no `document`, `window` or DOM
  constructors outside of effects and event handlers.
- **Geometry stays generic.** Nothing in `src/` outside `src/maps/` may mention
  a specific country, state or region. Country-specific quirks belong in that
  country's preset.
- **Presets are separate entry points.** Map data must never be reachable from
  the root import, or it lands in the bundle of everyone who does not use it.

## Style

Prettier and ESLint are the arbiters — tabs, no semicolons, double quotes,
80 columns. Run `npm run format` before committing.

Comments should explain _why_, not _what_. If a piece of code looks odd but is
load-bearing, say so — several parts of the renderer look wrong until you know
what they are working around.

## Changesets

Any change that affects published behaviour needs a changeset:

```bash
npx changeset
```

Pick the bump, describe the change in one line, and commit the generated file
alongside your work.

## Reporting bugs

Include the geometry, the data and the props you passed. A reproduction beats a
description; a runnable one beats both.
