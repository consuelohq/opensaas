# harden verify publish gate

branch: `task/workspace-agents/harden-verify-publish-gate`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/563/harden-verify-publish-gate
github pr: https://github.com/consuelohq/opensaas/pull/563
started: 2026-05-24

## Ko-approved direction

- One formal publish gate: `verify`.
- Normal `verify` must always run review and DB guardrails.
- Remove/hide normal `noReview` and `noDb` use from the typed facade and docs.
- A valid publish stamp must prove review and DB were not skipped.
- `task.push` must reject missing, stale, partial, or non-publish-valid verify stamps.
- Add a dangerous push bypass that requires explicit Ko approval and a reason.
- Keep any partial/debug behavior out of the normal publish path.

## acceptance criteria

- [ ] `verify` normal path always runs review and DB guardrails.
- [ ] `verify` output includes `mode`, `publishValid`, skipped status, and stamp metadata.
- [ ] Partial verification cannot write a publish-valid stamp.
- [ ] `task.push` rejects missing/stale/partial/non-publish-valid stamps.
- [ ] `task.push` dangerous bypass requires reason and is auditable.
- [ ] Docs teach one command: `verify` before `task.push`; `review.run` is optional preflight.
- [ ] Regression tests cover normal verify, partial verify, task.push rejection, and dangerous bypass.
- [ ] Review/verify summaries remain compact; actual review/DB checks are not weakened.

## plan

1. Inspect current verify/stamp/task.push implementation and tests.
2. Patch verification schema and verify script/facade behavior.
3. Patch task.push stamp-quality enforcement and dangerous bypass.
4. Update docs/manifests.
5. Add tests around gate enforcement and bypass behavior.
6. Validate with focused tests, audit, real verify, and publish flow.

## files changed

- `packages/workspace/tests/verification.test.js`

## validation evidence

- pending

## notes

This is intentionally a workflow safety change. Avoid changing product review rules unless required to make stamp quality enforceable.

- 2026-05-24 04:53:08 write: `.task/workspace-agents/harden-verify-publish-gate/workpad.md`

## workspace-owned: files changed

- `packages/workspace/tests/verification.test.js`

## workspace-owned: activity log

- 2026-05-24 04:53:08 fs.write: `.task/workspace-agents/harden-verify-publish-gate/workpad.md`
- 2026-05-24 05:01:54 write: `packages/workspace/tests/verification.test.js`
- 2026-05-24 05:01:54 fs.write: `packages/workspace/tests/verification.test.js`
- 2026-05-24 05:08:07 fs.write: `.task/workspace-agents/harden-verify-publish-gate/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-05-24 05:06:30 `verify`: passed — OK
- 2026-05-24 05:07:45 `audit`: passed — OK

## implementation summary

Implemented the approved hardened gate model:

- `verify` is the one formal publish gate.
- Typed `verify` no longer exposes `noReview`, `noDb`, or `dbWarnOnly` inputs.
- Direct `verify` rejects old `--no-review` / `--no-db` flags as unknown.
- Direct debug-only `--debug-skip-review` / `--debug-skip-db` remain available for tooling diagnostics, but produce `mode: partial`, `publishValid: false`, and no stamp.
- Full `verify` writes a `commandVersion: 2` stamp with `publishValid: true`, `mode: full`, review status, DB status, `warnOnly`, `headSha`, `base`, and `changeHash`.
- `getVerifyStampMismatch` now rejects missing, stale, partial, non-publish-valid, review-skipped, DB-skipped, and DB-warn-only stamps.
- `task.push` no longer supports `--no-verify`; it requires a publish-valid verify stamp.
- Added `task.push --dangerous --reason "Ko approved: ..."` as the explicit escape hatch for invalid/missing stamps.
- Updated facade schemas, generated workspace types, tool docs, manifest args, and `SCRIPTS.md`.
- Added regression coverage for publish-valid, non-publish-valid, partial, skipped-review, and DB-warn-only stamps.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/verification.test.js`
- `packages/workspace/tooling/tool-manifest.json`

## validation evidence

- Syntax checks passed:
  - `node --check packages/workspace/scripts/verify.js`
  - `node --check packages/workspace/scripts/task-push.js`
  - `node --check packages/workspace/scripts/lib/verification.js`
  - manifest JSON parse
- `bun test packages/workspace/tests/verification.test.js`: passed, 3 tests / 5 assertions.
- Direct partial verify smoke: `bun packages/workspace/scripts/verify.js --base origin/main --debug-skip-review --debug-skip-db --json` returned `mode: partial`, `publishValid: false`, review/db skipped true, `stamp.written: false`.
- Direct old flag smoke: `bun packages/workspace/scripts/verify.js --no-review --json` failed with `unknown flag: --no-review`.
- Direct task push rejection smoke: `bun packages/workspace/scripts/task-push.js --message 'fix(workspace-agents): should fail missing verify' --changed` failed before mutation with `publish-valid verify required before task:push`.
- Direct dangerous-without-reason smoke: `bun packages/workspace/scripts/task-push.js --message 'fix(workspace-agents): should fail dangerous reason' --changed --dangerous` failed before mutation with `requires --reason`.
- Manifest/facade check: typed `verify` args are now only `base` and `noStamp`; typed `task.push` args use `dangerous` and `reason`, no `noVerify`.
- Removed normal references to `noReview`, `noVerify`, `--no-db`, `--no-review`, and `--no-verify` from workspace scripts/docs/manifests.
- `audit --scripts`: passed, 52 documented / 52 actual.
- Full formal `bun run verify -- --base origin/main --json`: passed and wrote a commandVersion 2 verify stamp with `mode: full`, `publishValid: true`, review skipped false, DB skipped false, DB warnOnly false.
- Typed `verify` also passed against `origin/main`; note the live server facade response shape may not expose the new fields until server reload, but the task worktree script and stamp do.
- `git.diff`: inspected summary and hunks; changes are scoped to workspace gate enforcement, docs/types, tests, and task metadata.

## caveats

- The running workspace server will need a restart after this lands for the updated typed schema/manifest to remove old inputs and expose dangerous/reason.
- Direct debug skip flags remain in `verify.js` for tooling diagnostics only; they are not exposed in the typed facade/docs and cannot produce a publish-valid stamp.

- 2026-05-24 05:08:07 append: `.task/workspace-agents/harden-verify-publish-gate/workpad.md`
