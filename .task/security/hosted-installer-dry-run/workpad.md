# hosted installer dry run

branch: `task/security/hosted-installer-dry-run`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1394/hosted-installer-dry-run
github pr: https://github.com/consuelohq/opensaas/pull/1394
started: 2026-07-11

## acceptance criteria

- [x] Hosted clean-machine `--dry-run` succeeds with Bun present and no checkout/source directory.
- [x] Dry-run reports planned source download, dependency installation, and onboarding without invoking Bun or creating source.
- [x] Repo-local dry-run still executes `install.ts --dry-run`.
- [x] Non-dry-run source, install, daemon, and credential behavior remains unchanged.
- [x] Focused tests, adjacent bootstrap tests, shell syntax, typecheck, review, and verify pass.
- [ ] Change reaches `main`; combined production release and hosted production dry-run pass.

## plan

1. Add the deterministic hosted clean-machine regression test and confirm it fails because Bun is invoked.
2. Add the minimal source-existence guard to dry-run onboarding.
3. Run focused/adjacent tests and both dry-run modes.
4. Review, verify, push, promote through `stream/security`, merge to main, and validate production.

## test-first contract

- Behavior under test: hosted clean-machine dry-run remains non-mutating when Bun is available but source is only planned.
- Existing pattern: `installer-runtime-dependencies.test.ts` runs bootstrap with isolated homes and executable fixtures.
- Changed test: fake Bun exits 42 if invoked; assert bootstrap exits 0, reports `would_download`/`would_install`/`would_run`, and creates neither source nor invocation marker.
- Focused red command: `bun run --cwd packages/os vitest run tests/installer-runtime-dependencies.test.ts`.
- Expected red failure: bootstrap invokes fake Bun and exits 42.

## current status

- Pages and OS deployment credentials are proven working.
- Earlier task proved the exact fix, but normal promotion surfaced unsafe 70-file `stream/os` PR #1343.
- This recovery task starts from current main and uses the clean `stream/security` path.
- Added the single source-existence guard in dry-run onboarding.
- Red evidence: fake Bun was invoked and exited 42 before implementation.
- Green evidence: 13/13 runtime dependency tests and 12/12 bootstrap source tests pass; hosted and repo-local smoke modes pass.
- Shell syntax, OS typecheck, repository review, and full verify pass with a publish-valid stamp.

## files changed

- `.task/security/hosted-installer-dry-run/workpad.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

## workspace-owned: files changed

- `.task/security/hosted-installer-dry-run/workpad.md`

## workspace-owned: activity log

- 2026-07-11 00:38:24 fs.write: `.task/security/hosted-installer-dry-run/workpad.md`

## workspace-owned: validation evidence

- 2026-07-11 00:40:10 `review.run`: passed — OK
- 2026-07-11 00:40:52 `verify`: passed — OK
- 2026-07-11 00:41:13 `verify`: passed — OK

## key decisions

- Do not merge `stream/os` PR #1343.
- Preserve actual repo-local dry-run execution; skip only impossible child execution when planned source is absent.
- Do not perform downloads during dry-run.

## notes for ko

- No credential values are read or recorded.

## improvements noticed

- The task workflow should warn before merging a task into a stream with a large pre-existing main diff.

## issues and recovery

- Original task PR #1393 merged into stale `stream/os`; its remote task branch was then deleted. Recreated the verified change from main on `stream/security` instead of widening scope.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): keep hosted installer dry run non-mutating" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-11 00:38:24 write: `.task/security/hosted-installer-dry-run/workpad.md`

- 2026-07-11 00:38:38 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-07-11 00:39:03 apply-patch: `packages/os/scripts/bootstrap.sh`

- 2026-07-11 00:40:25 apply-patch: `.task/security/hosted-installer-dry-run/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/hosted-installer-dry-run/current.json`, `.task/security/hosted-installer-dry-run/session.json`, `.task/security/hosted-installer-dry-run/verify.json`, `.task/security/hosted-installer-dry-run/workpad.md`, `.task/tasks/security/hosted-installer-dry-run.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
