# Review and harden computer use PR 2813

branch: `task/os-computer-use/review-and-harden-computer-use-pr-2813`
stream: `stream/os-computer-use`
task PR: https://github.com/consuelohq/opensaas/pull/2824
review PR: https://github.com/consuelohq/opensaas/pull/2813
started: 2026-11-19

## acceptance criteria

- [x] Establish exact PR head, base, checks, and previous automated review status.
- [x] Independently review computer.use contracts, provider dispatch, browser approval/session lifecycle, privacy/traces, test depth, and Effect boundaries.
- [x] Fix consequential defects without widening scope or touching unrelated agents.
- [x] Demonstrate test-first failure then success, run focused regression suite, strict review, and verify.
- [ ] Publish vetted fixes into stream/os-computer-use and retain the stream->main PR unmerged pending Ko approval.

## plan

1. Read the implementation and integration, reproduce consequential risks; focus on privilege and privacy boundaries, not cosmetic issues.
2. Add focused regression for discovered risk, prove red, then implement minimal repair.
3. Review diff for regressions, run focused and broad checks; record results.
4. Push task, promote to existing stream review PR, no main merge or installed OS update.

## test-first contract

behavior under test: computer.use provider subprocesses must not inherit unrelated OS credentials, tokens, API keys, or runtime configuration from the parent node. Required native process/environment keys and explicitly approved AGENT_BROWSER policy variables must remain available.
existing local pattern: computerEnvironment in packages/os/scripts/lib/computer-use.ts with focused Vitest in packages/os/tests/computer-use.test.ts.
new or changed tests: add test "does not export runtime secrets to computer-use provider" with secret-env fixtures and display/runtime allowlist assertions.
focused red command: `cd packages/os && bunx vitest run tests/computer-use.test.ts -t "does not export runtime secrets to computer-use provider"`
expected red failure: existing computerEnvironment currently forwards GITHUB_TOKEN, OPENAI_API_KEY, and unrelated runtime env into the spawned provider.
no-test waiver: not applicable.

## files changed

- `packages/os/scripts/lib/computer-use.ts`: limit child environment to required host and browser policy variables; preserve pending approval state when deny or close fails.
- `packages/os/tests/computer-use.test.ts`: regressions for subprocess credential isolation and failed/successful deny and close.
- This workpad and workspace-generated task/evidence/verification metadata.

## key decisions

- Keep third-party pinned agent-browser/agent-desktop as provider boundary. Do not rewrite proven behavior solely to make more lines use Effect.
- Changes stay in the isolated review task, then merge only to the review stream, not main.

## notes for ko

- Initial PR #2813 head 93cb1a6a... had 19 green current GitHub checks and Codex reported no unresolved findings. Rerun checks against the new exact stream head after this task is promoted.
- New review changes have independently passed 49 focused tests, repeated strict review (zero blockers) and repeated full verify gates (passed, publishValid=true).
- Previous task workpads report actual macOS Dia/desktop smoke; this isolated worktree lacks optional agent-browser and agent-desktop runtime packages, so no *new* native end-to-end smoke was independently run in this review.
- Effect owns the typed subprocess execution boundary, but computer.use orchestration is still conventional async/imperative code, not an end-to-end Effect service. Refactoring everything to Effect is not justified by current defects.
- Prior original PR workpad notes Dia did not retain its cookie after restart; Chromium retained a test sign-in. User guidance recommends Chromium for sign-in persistence.

## improvements noticed

- Original subprocess environment forwarded arbitrary OS secrets and executable injection settings into third-party providers. Fixed with an explicit allowlist.
- Original pending browser approvals were erased before deny or close finished; a failed operation left a parked provider action without a matching OS approval. Fixed with one-time confirm and success-gated deny/close cleanup.
- The native providers share OS user permissions; environment isolation reduces accidental credential exposure but is not a filesystem sandbox.

## errors i ran into

- The typed GitHub pr.diff wrapper invokes unsupported `gh pr diff --stat`; used git.diff and github raw name-only as read-only alternatives.

---
## publish checklist

- [x] focused regressions green (49/49)
- [x] review.run strict complete (zero issues)
- [x] verify complete twice, including after final lifecycle change (passed, publishValid=true)
- [ ] task.push and task.pr to stream
- [ ] do not merge main or update installed OS before approval

- 2026-11-19 05:18:03 write: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-19 05:18:03 fs.write: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`
- 2026-11-19 05:18:17 apply-patch: `packages/os/tests/computer-use.test.ts`
- 2026-11-19 05:18:41 apply-patch: `packages/os/scripts/lib/computer-use.ts`
- 2026-11-19 05:20:15 fs.write: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`
- 2026-11-19 05:22:34 fs.write: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`

## workspace-owned: validation evidence

- 2026-11-19 05:19:46 `review.run`: passed — OK
- 2026-11-19 05:22:26 `verify`: passed — OK
- 2026-11-19 05:23:28 `review.run`: passed — OK
- 2026-11-19 05:24:30 `verify`: passed — OK

## validation evidence (2026-11-19)

- Red: the new subprocess credential-isolation test failed as expected, showing inherited synthetic GITHUB_TOKEN, OPENAI_API_KEY, AWS_SECRET_ACCESS_KEY, CONSUELO_OS_KEY and NODE_OPTIONS.
- Green: after allowlisting native host environment fields and explicit browser policy fields, the same targeted test passed.
- Focused regression suite: 48/48 tests passed across computer-use.test.ts, computer-use-log.test.ts, and computer-use-trace.test.ts; only existing Node experimental SQLite warning.
- Package syntax checks: `bun run typecheck` completed successfully.
- `review.run({ strict: true })`: 0 new issues, 0 pre-existing issues, 0 blockers, 0 documentation opportunities.
- Local task worktree does not yet contain pinned agent-browser or agent-desktop optional dependencies; live provider smoke not established from this worktree. Original PR includes native platform CI and prior operator-reported Dia confirmation smoke.

- 2026-11-19 05:20:15 append: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`

## Second test-first contract — browser decision lifecycle

Behavior under test: a browser session with a parked approval must be closable without resolving that approval, and a failed deny must preserve the pending decision until it is successfully dismissed. Confirm remains at-most-once to avoid replaying a side effect.
Existing local pattern: withBrowserDecision file-backed per-profile approvals, with the native provider serialized by withNodeResourceLock, and focused tests in computer-use.test.ts.
New tests: failed and successful close with pending approval, failed deny with retained approval, successful deny freeing the session. Tests do not launch real browsers.
Focused red command: `cd packages/os && bunx vitest run tests/computer-use.test.ts -t "preserves pending browser decisions"`
Expected red failure: close erases pending state before a failed dispatch; the next deny cannot find the matching confirmation and fails with INVALID_INPUT.
No-test waiver: not applicable.

First full verify (environment isolation only) completed passed=true, publishValid=true. Second full verify after lifecycle fix also completed passed=true, publishValid=true. Red regression observed INVALID_INPUT rather than the expected deny failure because unsuccessful close had already discarded the parked approval. Green: after changing the cleanup sequence, 49/49 focused tests, syntax checks, strict review and final full verification all passed.

- 2026-11-19 05:22:34 append: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`

- 2026-11-19 05:22:45 apply-patch: `packages/os/tests/computer-use.test.ts`
- 2026-11-19 05:23:00 apply-patch: `packages/os/scripts/lib/computer-use.ts`

- 2026-11-19 05:24:50 apply-patch: `.task/os-computer-use/review-and-harden-computer-use-pr-2813/workpad.md`