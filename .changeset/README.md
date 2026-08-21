# Changesets

This folder holds [changesets](https://github.com/changesets/changesets) —
one Markdown file per pending change, describing the version bump it warrants
and what to say about it in the changelog.

Add one with:

```bash
npx changeset
```

They are consumed and deleted when a release is cut.
