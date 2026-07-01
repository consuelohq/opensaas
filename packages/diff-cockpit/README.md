# Diff cockpit

`diff-cockpit` is the first live PR review surface for Consuelo operator work.

Phase 1 serves a single PR route:

```text
https://diffs.consuelohq.com/consuelohq/opensaas/pull/708
```

The Cloudflare Worker calls GitHub live data at request time through `/api/:owner/:repo/pull/:number`; it does not generate static review pages. The UI prioritizes the file review surface: file tree on the left, diff/code in the center, and a right review drawer that stays closed by default.

## Commands

```bash
bun run diff_cockpit -- 708
bun run diff_cockpit -- https://github.com/consuelohq/opensaas/pull/708
bun --cwd packages/diff-cockpit run dev
bun --cwd packages/diff-cockpit run deploy
bun --cwd packages/diff-cockpit run test
```

## Notes

- `@pierre/trees` is loaded by the browser as the intended file-tree integration point.
- `@pierre/diffs` is loaded by the browser for diff rendering with a local fallback renderer.
- `GITHUB_TOKEN` or `GH_TOKEN` may be provided to the Worker for higher GitHub API limits or private repository access.
