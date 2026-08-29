# keep GitHub connect resilient to invalid owner hints

branch: `task/workspace-agents/keep-github-connect-resilient-to-invalid-owner-hints`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2275
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: a malformed legacy workspace source-control default must not block starting GitHub authorization; repository-owner discovery is an optional routing hint and falls back to `[]` if snapshot parsing fails.
existing local pattern: the settings Hono route authenticates first, reads the workspace config only to derive owner hints, then asks Device Authority to start GitHub authorization.
new or changed tests: add a focused `settings-hono-routes.test.ts` case with a workspace whose `defaults.project` references a missing project; expect Connect GitHub to still return the handoff HTML and the signed authority body to contain `repositoryOwners: []`.
focused red command: `bun test packages/os/tests/settings-hono-routes.test.ts`
expected red failure: current route lets `buildWorkspaceSourceControlSnapshot` throw and returns 503 `GITHUB_CONNECT_FAILED`.
no-test waiver: not applicable.

## review context

CodeRabbit actionable comment on stream PR #2269: optional owner-hint derivation should fail open so invalid legacy workspace configuration does not block GitHub authorization.

- 2026-08-29 02:27:46 append: `.task/workspace-agents/keep-github-connect-resilient-to-invalid-owner-hints/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 02:27:46 fs.write: `.task/workspace-agents/keep-github-connect-resilient-to-invalid-owner-hints/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/source-control-config.ts`
- `packages/os/tests/settings-hono-routes.test.ts`

- 2026-08-29 02:28:10 apply-patch: `packages/os/tests/settings-hono-routes.test.ts`
- 2026-08-29 02:28:23 apply-patch: `packages/os/scripts/server/routes/settings.ts`

## workspace-owned: validation evidence

- 2026-08-29 02:29:07 `review.run`: passed — OK
- 2026-08-29 02:29:28 `verify`: passed — OK
