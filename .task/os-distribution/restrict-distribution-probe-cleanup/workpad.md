# Restrict distribution probe cleanup

branch: `task/os-distribution/restrict-distribution-probe-cleanup`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1550/restrict-distribution-probe-cleanup
github pr: https://github.com/consuelohq/opensaas/pull/1550
started: 2026-07-22

## acceptance criteria

- [x] Cleanup removes only a directory created by the probe with `mkdtemp`.
- [x] Caller-supplied parent directories and unrelated sentinel files survive default cleanup.
- [x] Parent paths containing `..`, home-like paths, and repo-like paths are covered by table-driven tests.
- [x] Exact real `~/.consuelo` remains rejected.
- [ ] Local distribution tests, strict review, full verify, and hosted cross-platform checks pass.

## plan

1. Add table-driven regression coverage for caller-owned parent directories.
2. Run the focused test and record the unsafe red behavior.
3. Allocate a unique probe-owned directory under the supplied parent and clean up only that directory.
4. Run focused distribution tests, strict review, and full verification.
5. Publish through `stream/os-distribution`, merge the stream PR to `main`, and sync local `main`.

## Test-first contract

- Behavior under test: default cleanup preserves every caller-owned parent and unrelated file while removing only the probe-owned temporary directory.
- Existing pattern: Vitest filesystem tests using `mkdtemp` and after-test cleanup.
- Changed tests: extend `environment-probe.test.ts` with table-driven home-like, normalized-parent, and repo-like parent paths; adjust the existing cleanup expectation to the new ownership contract.
- Focused red command: `bun test packages/os/tests/distribution/environment-probe.test.ts`.
- Expected red failure: the current implementation recursively deletes the supplied parent, so the sentinel and parent-preservation assertions fail.

## current status

- Implementation and all local validation are complete. Hosted cross-platform checks remain.

## files changed

- `.task/os-distribution/restrict-distribution-probe-cleanup/workpad.md`
- `packages/os/scripts/testing/distribution/environment-probe.ts`
- `packages/os/tests/distribution/environment-probe.test.ts`

## workspace-owned: files changed

- Task started from `stream/os-distribution` in a durable worktree.
- Read the OS senior-engineer and task workflow skills plus the probe and focused tests.

## workspace-owned: activity log

- Added table-driven caller-owned parent regression coverage before production edits.
- Replaced cleanup of `options.home` with cleanup of the exact child path returned by `mkdtemp`.
- Kept caller-provided paths as containment only; CLI defaults now use the system temp directory as that containment parent.

## workspace-owned: validation evidence

- Red: `bun test packages/os/tests/distribution/environment-probe.test.ts` failed 5 cases because the supplied parent was deleted and no probe-owned `mkdtemp` directory existed.
- Green: `bun test packages/os/tests/distribution/environment-probe.test.ts` passed 6 tests and 19 assertions.
- Green: `bun test packages/os/tests/distribution` passed 16 tests and 37 assertions with 10 existing TODOs.
- Green: `bun packages/os/scripts/testing/distribution/local-container-runner.ts` passed on Apple Container with Linux arm64 and Bun 1.3.14.
- Green: `bun run review -- --strict --base origin/stream/os-distribution --json` reported zero issues.
- Green: `bun run verify -- --base origin/stream/os-distribution --json` passed and wrote a publish-valid stamp.

## key decisions

- Treat `options.home` as caller-owned containment, never cleanup ownership.
- Derive cleanup authority exclusively from the exact path returned by `mkdtemp`.
- This is a release blocker because the existing API can recursively remove arbitrary absolute directories supplied as the probe home.

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
