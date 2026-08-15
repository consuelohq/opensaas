# fix visible dialer steering install state regression

branch: `task/os/fix-visible-dialer-steering-install-state-regression`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1789/fix-visible-dialer-steering-install-state-regression
github pr: https://github.com/consuelohq/opensaas/pull/1789
started: 2026-08-05

## acceptance criteria

- [x] The install-state integration test recognizes the intentional visible dialer steering action.
- [x] The focused install-state regression test passes without changing runtime behavior.
- [ ] Task PR #1789 is merged into `stream/os` and stream PR #1788 becomes merge-ready.
- [ ] Stream PR #1788 is merged to `main` and the release workflow is verified.
- [ ] The installed local updater is exercised against the published release, or an exact bootstrap path is documented if the old CLI cannot expose `update`.

## plan

1. Confirm the CI failure and compare the stale assertion with the dedicated visible-steering contract.
2. Run the exact focused test red.
3. Update only the stale test assertion to require the visible `dialer-AGENTS.md` steering action while preserving the hidden-home negative assertion.
4. Run focused and distribution-regression validation, then review/verify/publish through the task workflow.
5. Refresh stream PR #1788, merge it to main after green checks, verify release publication, and test the local update path.

## current status

- PR #1788 is blocked by `Consuelo OS / existing distribution regressions`.
- The job failed twice at `tests/install-state.test.ts:486`: it expected no `seed_steering` action.
- Runtime behavior is intentional: `provisionManagedComponentIndexes` synchronizes `Consuelo/Steering/dialer-AGENTS.md`, and `managed-components.test.ts` already requires a `seed_steering` action with that path.
- The narrow fix is test-only; no runtime code change is planned.
- Both fresh-install and reprovision assertions now match the intentional visible steering contract: `created` on first install and `preserved` on the second.
- The focused integration test is green.

## files changed

- `packages/os/tests/install-state.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-05 21:17:13 fs.write: `.task/os/fix-visible-dialer-steering-install-state-regression/ci-regression.ts`
- 2026-08-05 21:18:36 fs.trash: `.task/os/fix-visible-dialer-steering-install-state-regression/ci-regression.ts`

## workspace-owned: validation evidence

- 2026-08-05 21:18:39 `checkFiles`: passed — OK
- 2026-08-05 21:19:37 `review.run`: passed — OK
- 2026-08-05 21:19:37 `review.run`: passed — OK
- 2026-08-05 21:19:38 `review.run`: passed — OK
- 2026-08-05 21:19:54 `verify`: passed — OK

## key decisions

- Keep `expect(existsSync(join(tempHome, 'steering'))).toBe(false)` to protect the hidden runtime-home contract.
- Replace the broad `seed_steering === false` assertion with a positive path-specific assertion for visible `Consuelo/Steering/dialer-AGENTS.md`.
- Do not force-merge #1788 while the same deterministic test would block release CI.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The installed OS runtime predates the batch-context fix. A task-scoped discovery batch dropped its task session and reproduced `AMBIGUOUS_TASK_SELECTION`; direct task-scoped calls are used until the release is locally installed.
- The exact seven-file CI command exceeded the current OS `code.call` gateway window twice, including a file-backed retry. `task.call` is absent from the installed generated manifest, and nested `code.call` is intentionally blocked in code mode. The focused failing integration test is green; repository verify and GitHub CI will provide the broader gate.

## Test-first contract

- behavior under test: fresh local OS provisioning reports the intentional visible dialer steering synchronization action and still does not create hidden runtime-home steering.
- existing local pattern to follow: `managed-components.test.ts` asserts `seed_steering`, the exact visible target path, and `created` status.
- new or changed tests: update the existing `creates the approved local home shape and preserves existing config` integration assertion.
- focused red command: `bun x vitest run tests/install-state.test.ts -t "creates the approved local home shape and preserves existing config"` from `packages/os`.
- expected red failure: line 486 receives `true` for the existing `seed_steering` action while the test expects `false`.
- red evidence: `trc_5c29281f033e` reproduced the CI failure at line 486. The first correction exposed the same stale reprovision assumption at line 586 (`trc_d67cdbb734ec`).
- green evidence: the focused integration test passed with 1 test passed / 24 skipped (`trc_00858278db50`).

## validation evidence

- Changed-file static check passed for `packages/os/tests/install-state.test.ts` (`trc_e9ce1207fd3b`).
- Diff review confirms one test file changed; runtime code is untouched (`trc_7cb7d764b788`).
- Diff-scoped review passed with zero findings (`trc_385127ffa666`).
- Full publish verification passed and wrote the task stamp (`trc_c91e76a9a39d`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/visible-dialer-steering.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/managed-components.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-08-05 21:13:50 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-08-05 21:17:13 write: `.task/os/fix-visible-dialer-steering-install-state-regression/ci-regression.ts`

- 2026-08-05 21:18:54 apply-patch: `.task/os/fix-visible-dialer-steering-install-state-regression/workpad.md`

- 2026-08-05 21:20:00 apply-patch: `.task/os/fix-visible-dialer-steering-install-state-regression/workpad.md`