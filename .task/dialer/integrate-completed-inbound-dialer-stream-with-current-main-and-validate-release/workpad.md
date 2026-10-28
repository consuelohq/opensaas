# Dialer release integration

## acceptance criteria
- Preserve completed DEV-1614/1615/1616/1617 fixes and parallel agents' work.
- Reconcile stream/dialer with current main without restoring deleted legacy CRM applications.
- Validate the actual merged Dialer library, server, LeadConnector and focused carrier scenarios.
- Publish via task.push -> task.pr, merge the release review, deploy the exact accepted commit and test Wet Stone.
- Coordinate OS reliability PR #2597 release/activation and remote completion/recovery acceptance separately.
- Do not disclose credentials or place uncontrolled calls. Use authorized test resources.

## plan
1. Refresh PR/deploy/runtime evidence and inspect exact merge conflicts.
2. Resolve in this managed worktree, preserving main's package/runtime boundaries.
3. Run focused regression tests, strict review and full verification; publish to stream.
4. Merge and deploy with exact SHA evidence; test GHL Wet Stone and carrier behavior.
5. Publish/activate OS reliability update and confirm remote response behavior.

## Test-first contract
behavior under test: completed inbound callback/readiness behavior survives merging current main and can be deployed and exercised.
existing local pattern: Postgres-backed inbound integration tests, Dialer/LeadConnector package tests, lab simulated-provider scenarios.
new or changed tests: add only for a nontrivial behavior repair discovered during integration.
focused red command: identify after conflict/runtime inspection.
expected red failure: current stream is not mergeable with main.
no-test waiver: mechanical merge conflict resolution adds no new behavior; existing meaningful regression suites and builds validate it. Any new behavior fix requires a targeted red regression first.

## initial evidence
- Managed session tsk_8d0fd2437c6c, task PR #2633.
- Source stream/dialer at 073ad93dfa636e19f8a2de7b7ddc7e2011a01b12, 193 commits behind main at task creation.
- DEV-1616 #2631 is merged and Linear done; do not restart it.
- OS fix 3531aedeae0c0227e2965b6e863738b28bbbc669 is in tooling stream #2597 at 8e54cf8b843d106af3502c3ec25d757bef11dbcb.
- User approved proceeding with integration, deployment and testing.

## Integration red/green evidence
- Merge-tree and actual merge found only the generated registry conflicted; it was regenerated.
- First root-scoped selector regression: 69 pass / 1 fail (trc_f00ced08ea37). Automatic JSON merge silently dropped canonical OS paths and workspace-task-merge-agent-boundary. Restored the three main-side rule contributions while preserving Dialer rules, then regenerated. This is the focused red proof for the additional semantic merge resolution.
- SDK: 266 pass; LeadConnector: 164 pass; server with all available Postgres flags: 297 pass / only isolated lab skipped. Separate actual PG/Redis lab: 1 pass / 39 assertions. All three builds and typechecks pass.
- OS release PR #2597 merged as 11b3385352397228234cd44ed8c00330fadf7a59; publication run 40722106783 hit a 5s install-state test timeout. One failed-job retry started; durable release operation release-573a0ff5fc79050551a27751 resumed. No canary activation yet.

## workspace-owned: validation evidence

- 2026-10-28 16:17:03 `review.run`: passed — OK
- 2026-10-28 16:18:36 `verify`: passed — OK

## Final source validation before publication
- Main integrated in merge commits 1203cc7b8c and 425cc58f8c; all original Dialer task commits preserved.
- A second automatic merge duplicated workspace-task-merge-agent-boundary; existing uniqueness regression failed (68 unique vs 69 entries). Consolidated duplicate arrays without discarding coverage and regenerated.
- Final test-selection regression: 91 pass (root-scoped Node Vitest). Early wrong-runner/wrong-cwd attempts were harness errors, not product failures.
- Strict review against origin/main: zero blocking issues; one nonblocking documentation opportunity for existing stream managed-component installation changes.
- Full verify durable record completed 2026-10-28T16:20:28.194Z, exit 0, passed=true, publishValid=true; all 28 selected suites passed and database guard had 0 findings.
- Dedicated evidence: SDK 266 pass; LeadConnector 164 pass; server 297 pass with Postgres flags; separate local PG/Redis lab 1 pass / 39 assertions; all three typechecks and builds pass.
- Railway project/service confirmed: dedicated dialer-server and its Postgres/Redis only. Existing active deployment remains a0d61f6b-d111-4626-b0ff-087cd16b1f67 (Oct 8).
- GitHub Dialer deployment secret names are absent. Use authenticated local provider tools for this release; do not copy broad account credentials into GitHub.
- GHL Wet Stone browser is authenticated, location confirmed; current legacy Custom Menu id 69b057c71ee2dd2117c75e6e. Menu click currently has no visible effect, so repair/read back the menu after deploying the accepted embed.
- No real carrier call or recording/transcription initiated.
