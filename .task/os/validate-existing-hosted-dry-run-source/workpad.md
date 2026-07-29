# validate existing hosted dry run source

branch: `task/os/validate-existing-hosted-dry-run-source`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1740
started: 2026-07-29

## acceptance criteria

- [x] A hosted dry-run with no staged source remains non-mutating and reports planned download/daemon work.
- [x] A hosted dry-run using an existing source validates the source instead of treating it as absent.
- [x] An existing hosted source missing `install-system-daemons.sh` fails closed.
- [x] Focused tests, shell syntax, OS typecheck, strict review, and full verify pass.
- [ ] The fix reaches `stream/os`, exact-head PR #1738 is clean, and the stream reaches `main`.

## plan

1. Reproduce the exact-head Codex finding with an external-cwd existing-source fixture.
2. Correct dry-run source-state classification without downloading or mutating source.
3. Validate hosted-absent, hosted-existing, and local-incomplete paths.
4. Promote through task and stream gates, then rerun the live hosted clean-machine dry-run.

## current status

- Implementation is complete and publish-valid. Promotion through PR #1740 and refreshed stream PR #1738 remains.

## files changed

- `packages/os/scripts/bootstrap.sh` — classify and validate existing source before deciding whether dry-run would refresh, reuse, or download.
- `packages/os/tests/installer-runtime-dependencies.test.ts` — regression for external-cwd `--use-existing-source` with an incomplete staged source.

## key decisions

- Source state must describe whether source bytes are actually available, not merely whether a network download would normally occur.

## notes for ko

- No installed runtime or machine service will be changed by this task.

## improvements noticed

- The workspace registry's generated package-test command uses an argument order that prints Bun help and exits successfully; manual focused Vitest runs are the behavioral test evidence for this task.

## issues and recovery

- No implementation blocker. The semantic search index did not retrieve this shell path, so direct targeted source inspection supplied the authoritative evidence.

## validation

- RED focused regression: failed because the incomplete existing source exited `0`.
- GREEN focused regression: 1 passed, 20 skipped.
- GREEN full installer runtime dependency suite: 21 passed.
- GREEN bootstrap source suite: 15 passed.
- GREEN shell syntax: `bash -n packages/os/scripts/bootstrap.sh`.
- GREEN OS typecheck: `bun run --cwd packages/os typecheck`.
- GREEN strict review against `origin/stream/os`: 0 owned issues and 0 blockers.
- GREEN workspace verify: publish-valid stamp and database guard passed.

## discovery

- Exact-head Codex finding: external-cwd `--use-existing-source` with an existing incomplete source is classified as `would_download`, allowing the daemon dry-run bypass.

- 2026-07-29 16:07:53 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-07-29 16:08:04 apply-patch: `.task/os/validate-existing-hosted-dry-run-source/workpad.md`
- 2026-07-29 16:08:14 apply-patch: `packages/os/scripts/bootstrap.sh`

- 2026-07-29 16:08:52 apply-patch: `.task/os/validate-existing-hosted-dry-run-source/workpad.md`

## workspace-owned: validation evidence

- 2026-07-29 16:09:15 `review.run`: passed — OK
- 2026-07-29 16:09:40 `verify`: passed — OK
- 2026-07-29 16:10:02 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/validate-existing-hosted-dry-run-source/current.json`, `.task/os/validate-existing-hosted-dry-run-source/session.json`, `.task/os/validate-existing-hosted-dry-run-source/verify.json`, `.task/os/validate-existing-hosted-dry-run-source/workpad.md`, `.task/tasks/os/validate-existing-hosted-dry-run-source.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
