# Release verified DEV-1677 capture consent only to production

branch: `task/dialer/release-verified-dev-1677-capture-consent-only-to-production`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2775
started: 2026-11-06

## acceptance criteria

- [x] Carry exactly 11 verified production/test files from source commit 6d2a8b3 to current main.
- [x] Prove byte-for-byte identical content for all 11 files.
- [x] No other product changes, no stream backlog, no user browser interaction or live calls.
- [x] Release branch test suites, both typechecks and builds pass.
- [ ] Strict exact-source review, formal verify, CI, production deploy and GHL verification.

## plan

1. Record source commit, source verify status and exact 11 files.
2. Verify clean patch applicability, mechanically transfer only package source/tests.
3. Prove identical file digests and rerun tests/typechecks/builds.
4. Run strict review/formal verify against origin/main; publish a main-targeting isolated PR.
5. Require exact-source CI and explicit approved production deploy, then confirm backend and Worker/Marketplace plus browser output without live calls.

## files changed

- Exactly 11 source files under dialer-server and lead-connector, copied from DEV-1677 source task.

## key decisions

- Release-only mechanical transplant (no code modifications beyond verified source).
- No stream merge. No new permission to record/transcribe inferred from plan entitlement.

## notes for ko

- Own isolated agent-browser Chrome profile only, avoid taking control of user Arc.
- Existing approved S01 call is unspent; never dial as part of release.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first and exact-source release contract

behavior under test: Release only DEV-1677's previously reviewed recording/transcription-consent implementation and regression coverage onto current main; do not introduce any additional functional changes or unrelated dialer stream commits. Capture remains OFF by default, individually opt-in when entitled, reset after each call, and not settable by untrusted launcher input.
existing local pattern: Source task PR #2774 commit 6d2a8b3dd95b644266a180f4048caaf0baf3102d, formally reviewed against origin/main (zero issues), formal verify publish-valid, affected 11 code/test files, source package suites and builds green. No new feature code is planned.
new or changed tests: No new tests for release transplant. Include the exact 11 source code/test files from PR #2774, then rerun the source tests, typechecks, builds, strict review and formal verify on the release branch.
focused red command: Already executed in source task: bun test packages/dialer-server/src/commercial-application.acceptance.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/calling-workspace.test.ts packages/lead-connector/src/embed/workspace-launch.test.ts (7 expected failures before fix).
expected red failure: Previously observed as expected in DEV-1677 implementation task, no new production behavior during release copy.
no-test waiver: Release-only mechanical transplant of previously red/green tested and publish-valid source. Fresh red test would require undoing verified fixes in release branch, adding risk without unique evidence. Must instead rerun tests and confirm byte-identical sources and exact main comparison.
release fences: Do not merge stream/dialer, change Railway billing, purchase numbers, touch live sessions, change Keychain or secrets, operate the user's Arc, or initiate S01. Main-based PR must have only the intended changed files; exact-source checks, CI and deployment readiness before release. Worker Marketplace assets only if changed; Railway backend required.

- 2026-11-06 03:31:34 append: `.task/dialer/release-verified-dev-1677-capture-consent-only-to-production/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-06 03:31:34 fs.write: `.task/dialer/release-verified-dev-1677-capture-consent-only-to-production/workpad.md`

## Exact-source evidence

- Verified source branch commit: 6d2a8b3dd95b644266a180f4048caaf0baf3102d, PR #2774.
- Release base main commit: 5e80d5c2c1be72829cb61ec9e3012e12b3b45a63.
- Source patch applies cleanly without overlaps with upstream; exactly 11 changed product/test files.
- SHA256 digests from the 11 release worktree files match source commit blobs byte-for-byte.
- Release package tests: dialer-server 251 pass / 93 skipped Postgres integrations / zero fail; LeadConnector 249 pass / zero fail.
- Both typechecks passed; both builds succeeded. No deployment, live call, billing, secrets or Keychain mutations.

## workspace-owned: validation evidence

- 2026-11-06 03:32:25 `review.run`: passed — OK
- 2026-11-06 03:33:29 `verify`: passed — OK

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
