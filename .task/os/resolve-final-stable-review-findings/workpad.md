# resolve final stable review findings

branch: `task/os/resolve-final-stable-review-findings`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2579
started: 2026-09-24

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: final Stable review hardening must (1) reject unsafe PATH ancestry including physical symlink parents and untrusted sticky owners, (2) normalize absolute CLI symlink targets physically, (3) durably fsync atomic install/release state replacements, (4) recover stale release-operation locks by recorded PID, (5) verify release signature payloads before immutable identity resolution, and (6) make the sidecar PID-write failure test deterministic without chmod assumptions.
existing local pattern: focused bootstrap source/behavior tests, install-state tests, release-operation tests, release tests, and macOS sidecar tests already cover adjacent contracts; extend those rather than introducing new harnesses.
new or changed tests: add focused regression assertions in the existing suites for each still-valid review finding; keep the sidecar change test-only.
focused red command: run only the existing suites that own these contracts after adding assertions.
expected red failure: current code lacks physical-parent PATH checks/trusted sticky-owner enforcement, skips fsync around atomic renames, does not evict stale PID locks, accepts unverified signature payloads before immutable identity resolution, and uses chmod for the PID-write failure setup.
no-test waiver: none.

- 2026-09-24 16:57:09 append: `.task/os/resolve-final-stable-review-findings/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-24 16:57:09 fs.write: `.task/os/resolve-final-stable-review-findings/workpad.md`
- 2026-09-24 17:09:19 fs.write: `.task/os/resolve-final-stable-review-findings/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/release-immutable.ts`
- `packages/os/scripts/lib/release-operation.ts`
- `packages/os/scripts/lib/work-session.ts`
- `packages/os/scripts/prepare-release-publication.ts`
- `packages/os/scripts/release-channels.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/os/tests/macos-supervised-sidecars.test.ts`
- `packages/os/tests/release-operation.test.ts`
- `packages/os/tests/release-script-security.test.ts`

## Green evidence

Resolved all eight findings from CodeRabbit review 5298467771:
- physical + lexical PATH ancestor validation, trusted sticky owners, and physical absolute symlink normalization;
- fsync-backed atomic macOS sidecar config replacement;
- fsync-backed release-operation state replacement and stale PID lock recovery;
- Ed25519 verification of downloaded immutable `.sig` evidence against configured trusted release public keys before identity resolution, plus verified source/version/fingerprint/platform-bundle validation;
- deterministic ENOENT setup for the supervised-sidecar PID publication failure test.

Focused command: `cd packages/os && bun test tests/bootstrap-source.test.ts tests/macos-platform.test.ts tests/release-operation.test.ts tests/release-script-security.test.ts tests/macos-supervised-sidecars.test.ts` => 45 passed, 0 failed, 301 assertions.

- 2026-09-24 17:09:19 append: `.task/os/resolve-final-stable-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-09-24 17:09:29 `review.run`: passed — OK
- 2026-09-24 17:11:38 `verify`: passed — OK
