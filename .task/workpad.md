# address pr 226 review fixes

branch: `task/workspace-agents/address-pr-226-review-fixes`
stream: `stream/workspace-agents`
task pr: https://github.com/consuelohq/opensaas/pull/227
review pr: https://github.com/consuelohq/opensaas/pull/226
started: 2026-04-29

## acceptance criteria

- [x] address actionable PR 226 review comments in the typed workspace facade.
- [x] move runtime facade dependencies into `dependencies`.
- [x] harden CLI flag validation and failure handling in composed scripts.
- [x] update the manifest, generated docs, generated types, decision docs, and steering.
- [x] keep PR 226 title aligned with the feature scope.

## plan

1. review `/tmp/codex-pr226-fixes.md` and `/tmp/pr226-reviews.md`.
2. patch the manifest, facade executor, batch runner, CLI scripts, and tests.
3. regenerate docs/types and run package tests plus task verification.
4. push the task branch and promote it into the stream review PR.

## files changed

- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/scripts/check-files.js`
- `packages/workspace/scripts/edit-flow.js`
- `packages/workspace/scripts/mac.js`
- `packages/workspace/scripts/tool-batch.ts`
- `packages/workspace/scripts/lib/facade/*`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/decision.md`
- `packages/workspace/STEERING.md`

## key decisions

- native dry-run flags pass through when a script supports them; otherwise the facade returns a synthetic `DRY_RUN` envelope.
- `tool-batch` accepts `input` and keeps `args` as a compatibility alias.
- `task.merge` PR input stays optional because the underlying script can resolve PR context.

## notes

- PR 226 is the durable review PR for the original typed facade work.
- PR 227 carries these review-fix changes before promotion into the stream.
