# Diff cockpit

`diff-cockpit` contains the shared PR review rendering and GitHub-loading implementation used by Consuelo OS Diffs.

The canonical authenticated product route is:

```text
https://internal.consuelohq.com/diffs/consuelohq/opensaas/pull/708
```

Consuelo OS serves `/diffs` and `/gateway/diffs/*`, resolves the workspace's GitHub connection, and uses this package for the review UI and GitHub data loaders. The old standalone `diffs.consuelohq.com` Worker and its durable KV snapshot cache are retired; this package is not an independently deployed Cloudflare service.

## Commands

```bash
bun run diff_cockpit -- 708
bun run diff_cockpit -- https://github.com/consuelohq/opensaas/pull/708
bun --cwd packages/diff-cockpit run test
bun --cwd packages/diff-cockpit run typecheck
```

## Notes

- `@pierre/trees` is loaded by the browser as the intended file-tree integration point.
- `@pierre/diffs` is loaded by the browser for diff rendering with a local fallback renderer.
- GitHub credentials are resolved by the authenticated OS Diffs gateway rather than exposed to a standalone Worker.
