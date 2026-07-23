# resolve main promotion conflicts

branch: `task/os-distribution/resolve-main-promotion-conflicts`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1597/resolve-main-promotion-conflicts
github pr: https://github.com/consuelohq/opensaas/pull/1597
started: 2026-07-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 19:04:49 fs.write: `.task/os-distribution/resolve-main-promotion-conflicts/workpad.md`
- 2026-07-23 19:07:23 fs.write: `.task/os-distribution/resolve-main-promotion-conflicts/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 19:13:19 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/workspace/senior-engineer.md`

## Discovery and test-first contract

- Goal: resolve the exact `stream/os-distribution` versus `main` promotion conflicts without dropping either lane's intended behavior.
- Source of truth: GitHub PR #1594, current `main`, and current `stream/os-distribution`.
- Test decision: conflict resolution is an integration-only change. No new behavior is intended, so no new red unit test is appropriate. Validation will compare both parents, inspect every resolved hunk, run OS-focused tests/contracts, repository review, and full publish verification.
- Expected pre-resolution failure: PR #1594 is `DIRTY` and cannot merge.
- Guardrails: preserve all independent main and OS-distribution changes; do not modify a real Consuelo install/service; do not promote to main before checks and review are green.
- Discovery: stream context showed `stream/os-distribution` at `e2ff0e1e9f013e318ae8459953b5f57fd90a3e33`, 13 commits behind `main`; promotion PR #1594 is open and dirty. Exact conflict inventory pending.

- 2026-07-23 19:04:49 append: `.task/os-distribution/resolve-main-promotion-conflicts/workpad.md`

- 2026-07-23 19:06:21 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-23 19:06:55 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-23 19:06:55 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
## Conflict resolution decisions

- Exact inventory: 14 conflicts. Thirteen lifecycle/health implementation-or-test files were add/add or content conflicts where the stream side is the later transaction-hardening superset; those retained the stream versions after explicit side-by-side diff and test-name comparison.
- `packages/os/scripts/lib/distribution/runtime-bundle.ts` was combined: retained the stream lifecycle/bundle hardening and incorporated `main`'s customer-provider classifications for Cloudflare provider files, provider testing helpers, and complete provider TypeScript package files.
- `packages/os/scripts/server/routes/health.ts` and its test retained the stream runtime identity contract required for post-activation bundle/version acceptance.
- The first focused run produced the expected integration signal: lifecycle/health tests passed, but the real customer closure failed on unclassified `tools/deployment-provider/vercel.md`. Repository-wide inspection found the same gap for `tools/railway/README.md`.
- Added an explicit regression asserting provider-package Markdown is `source-only`, then updated the classifier. Focused rerun: 58/58 tests passed and package syntax/typecheck passed.
- Tooling gap: the current typed facade has no merge-main-into-task operation that preserves merge ancestry, so the merge is being performed inside the isolated task worktree through task-scoped `code.call`; publishing must preserve the two-parent merge commit.

- 2026-07-23 19:07:23 append: `.task/os-distribution/resolve-main-promotion-conflicts/workpad.md`

- 2026-07-23 19:07:47 apply-patch: `.task/os-distribution/resolve-main-promotion-conflicts/workpad.md`
