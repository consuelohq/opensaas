# Fix OS noninteractive update workspace reuse

branch: `task/security/fix-os-noninteractive-update-workspace-reuse`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1512/fix-os-noninteractive-update-workspace-reuse
github pr: https://github.com/consuelohq/opensaas/pull/1512
started: 2026-07-15

## acceptance criteria

- [x] Noninteractive updates reuse the existing active workspace, node, connector, and generated auth.
- [x] Fresh installs without workspace identity retain the local fallback behavior.
- [x] Conflicting active workspace metadata remains fail-closed.
- [ ] Promote and release the fix, then prove the supported update and OS-only call chain on the test Mac.

## plan

1. Reproduce the failed update with a focused regression test.
2. Resolve existing workspace and node identity before applying the local fallback.
3. Lock down matching reuse and conflicting-state rejection.
4. Run installer/security tests, syntax checks, review, and verification.
5. Promote, release, update the remote Mac through the public installer, and validate through OS only.

## current status

- Implementation and local validation complete.
- 74 selected production-path tests and OS syntax checks are green.
- Strict review has zero findings and verify wrote a publish-valid stamp.
- Promotion, release, supported remote update, and OS-only live proof remain.

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: focused repro failed with `existing generated auth belongs to a different workspace`.
- Green: `install-state.test.ts` 19/19.
- Green: `security-gateway.test.ts` 23/23.
- Green: bootstrap source and runtime-dependency suites; 74 tests passed across the selected production-path suites.
- Green: `bun run typecheck` OS syntax checks.
- Opt-in legacy bootstrap contract remains gated and currently fails on pre-existing `bun:sqlite` execution under Node plus a stale source-text assertion; no failures reference this patch.
- Strict review: 0 blocking issues.
- Verify: publish-valid stamp written.
- 2026-07-15 05:52:16 `review.run`: passed — OK
- 2026-07-15 05:52:23 `verify`: failed — COMMAND_FAILED
- 2026-07-15 05:54:28 `review.run`: passed — OK
- 2026-07-15 05:55:07 `verify`: passed — OK
- 2026-07-15 05:56:23 `verify`: passed — OK

## key decisions

- Explicit browser-provided bootstrap identity always wins.
- Existing active identity is reused only when global, workspace, node, and installed config agree.
- The `local-consuelo-os` fallback is reserved for genuinely fresh installs.
- Existing generated auth mismatch checks remain unchanged and fail closed.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial ad hoc TypeScript command targeted a nonexistent `packages/os/tsconfig.json`; replaced with the package's supported `bun run typecheck`.
- The opt-in legacy workspace-bootstrap contract is not a release gate and has independent harness/source drift. It is documented here and left out of this narrowly scoped fix.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

- Existing install: noninteractive local update reuses consuelo.yaml activeWorkspace and activeNode.
- Existing auth: matching generated auth is accepted and never replaced by local-consuelo-os.
- Fresh install: no active workspace still creates the local fallback workspace.
- Safety: genuine generated-auth/workspace mismatches remain fail-closed.
- Proof: focused red test before implementation, focused green, installer/security suites, review, verify, supported remote update, then os.get_steering -> os.call tools.search -> os.call mac.process.

## Red proof

- Focused test: `should reuse the active workspace and node when reprovisioning without a new bootstrap`.
- Expected failure reproduced: `existing generated auth belongs to a different workspace` at `security-gateway.ts:660` after the second provision selected `local-consuelo-os`.

## workspace-owned: test selection

- changed files: `.task/security/fix-os-noninteractive-update-workspace-reuse/current.json`, `.task/security/fix-os-noninteractive-update-workspace-reuse/session.json`, `.task/security/fix-os-noninteractive-update-workspace-reuse/verify.json`, `.task/security/fix-os-noninteractive-update-workspace-reuse/workpad.md`, `.task/tasks/security/fix-os-noninteractive-update-workspace-reuse.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/tests/install-state.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
