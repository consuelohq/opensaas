# DEV-1660 improve typed Linear workflows and audit coverage

branch: `task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2739
started: 2026-10-31

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read existing dual wrappers, typed schema/handler, GraphQL capability, and fixture baseline.
2. Run targeted tests red and implement safe typed workflows, preserving parity.
3. Prove targeted and wider regression green, live API readbacks, manifest/discovery, full review and verify.
4. Publish into stream/os, leaving main and deployment untouched.

## files changed

- `packages/os/tests/linear-tooling-regression.test.ts`

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

## DEV-1660 — scoped acceptance and execution plan (2026-10-31)

Approval: Ko explicitly approved stream/os, new isolated task, typed Linear comments with author verification, native relations/dependencies, multi-label/default-label fix, Triage/project improvements, tests, review and stream publishing; **no main merge or deployment**.

Acceptance:
- [x] Comments create and read with verified author through typed OS.
- [x] Native issue relations create/read/remove and distinguish blocks vs blocked-by with idempotency.
- [x] Safe multi-label resolution and no nonexistent default label.
- [x] Triage intake/accept/decline workflow and project selection with validated provider IDs.
- [x] Focused regression red then green; manifest/discovery, mirror parity and applicable integration smoke.
- [ ] Full review and verification; publish task to stream/os, report stream review PR; do not merge main or deploy.

Execution:
1. Read current implementation, mirror tests, GraphQL schema and adjacent active work; keep existing contract.
2. Define test-first contract and run targeted tests red.
3. Implement minimal bounded changes and keep mirrored workspace/OS sources in parity as required.
4. Verify with unit/integration tests, tool registration/discovery, review and full verify.
5. Update Linear with evidence and PR, publish only through approved stream workflow.

## Test-first contract
behavior under test: typed Linear CLI and OS facade preserve all requested labels, default intake and attribution semantics, native relations, explicit project/triage operations.
existing local pattern: packages/workspace/scripts/linear.js and packages/os/tools/linear/(schema.ts,handler.ts), generated manifest and nearby tests; exact test files to confirm before edit.
new/changed tests: targeted Linear CLI and manifest handler regressions including provider-mocked GraphQL; verify identity from readback, relation direction, project/triage state.
focused red command: determine from repo test setup before implementation.
expected red failure: multiple label flag retention, missing typed commands, absent relation support, invalid default label.
no-test waiver: none; test-first required.

## Notes
- Related stream PR #2685 (Linear handoff sweeper) is open; inspect overlap before publication.
- Prior smoke test DEV-1659 confirmed chatgpt is authenticated actor; CLI raw comments/related GraphQL work.

- 2026-10-31 05:38:45 append: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/linear-tooling-regression.test.ts`

## workspace-owned: activity log

- 2026-10-31 05:38:45 fs.write: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`
- 2026-10-31 05:40:04 write: `packages/os/tests/linear-tooling-regression.test.ts`
- 2026-10-31 05:40:04 fs.write: `packages/os/tests/linear-tooling-regression.test.ts`
- 2026-10-31 05:40:44 apply-patch: `packages/os/scripts/linear.js`
- 2026-10-31 05:40:50 apply-patch: `packages/os/scripts/linear.js`
- 2026-10-31 05:41:08 apply-patch: `packages/os/scripts/linear.js`
- 2026-10-31 05:41:12 apply-patch: `packages/os/scripts/linear.js`
- 2026-10-31 05:41:25 apply-patch: `packages/os/tools/linear/schema.ts`
- 2026-10-31 05:41:30 apply-patch: `packages/os/tools/linear/handler.ts`
- 2026-10-31 05:41:44 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-10-31 05:41:44 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-10-31 05:41:54 apply-patch: `packages/os/tests/linear-tooling-regression.test.ts`
- 2026-10-31 05:42:04 apply-patch: `packages/os/tools/linear/handler.ts`
- 2026-10-31 05:42:04 apply-patch: `packages/os/tools/linear/schema.ts`
- 2026-10-31 05:44:32 apply-patch: `packages/os/tests/linear-tooling-regression.test.ts`
- 2026-10-31 05:44:45 apply-patch: `packages/os/scripts/linear.js`
- 2026-10-31 05:45:56 apply-patch: `packages/os/tests/linear-tooling-regression.test.ts`
- 2026-10-31 05:46:07 apply-patch: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`
- 2026-10-31 05:46:14 fs.write: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`
- 2026-10-31 05:54:21 fs.write: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`
- 2026-10-31 05:56:35 fs.write: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`

## Engineering evidence — 2026-10-31

**Test-first red / green:**
- Initial new regression suite: **6/6 red** as expected: multi-label update silently discarded earlier labels, missing/default label and forced-open behavior, project/state resolution, missing comment/relations/triage typed commands.
- After implementation: **7/7 green**.
- Live Linear smoke uncovered a destructive provider edge: issuing `blocks` between two already-`related` issues replaced the existing `related` link. The test `blocks` link was deleted and the original `DEV-1660 related DEV-1659` link restored (relation ID `2472e09e-8837-49d7-9562-5a657479ef14`), readback verified.
- Guard regression red: **1 red / 7 green** when requesting a different relation type for the same issue pair.
- Guard and extra fail-closed regressions green: **33/33 tests, 5 files**. Explicitly refuse replacement and incomplete relation pagination, reject invalid team states and non-triage accept/decline.

**Live API evidence (using isolated task script, no runtime changes):**
- `linear.createComment` CLI underlying command posted to DEV-1660 and returned `authorVerified:true`, authenticated `chatgpt` user ID equal to comment author ID. Readback through `comments` confirmed.
- `relations` identifies `blocks` as outgoing from blocker, incoming to blocked. Test link deleted after smoke. Original `related` link restored and confirmed.
- `update` with `--labels improvement --labels [test] --project OS --state 'in progress'` returned both labels + correct project/state, then restored original `improvement` label.
- Generated tool discovery recognizes `linear.comments`, `linear.relations`, `linear.createComment`.
- OS/workspace Linear JS wrappers remain byte identical; both typed facade schema copies updated; six new typed operations registered.
- `generate-tool-manifest` reports 172 entries vs previous 166; generated OS types, docs, and tool-package baseline synchronized. Linear SCRIPTS.md docs updated in both mirrors.

**Files changed:**
`packages/os/scripts/linear.js`, `packages/workspace/scripts/linear.js`, `packages/os/tools/linear/{schema.ts,handler.ts}`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/os/tests/linear-tooling-regression.test.ts`, `packages/os/tests/fixtures/tool-package-baseline.json`, `packages/os/manifests/generated/tool.manifest.json`, `packages/os/src/generated/workspace.d.ts`, `packages/os/TOOLS.md`, `packages/os/SCRIPTS.md`, `packages/workspace/SCRIPTS.md`, task-local workpad/metadata.

**Remaining:** full syntactic/type validation, strict review and publish verify, task.push, task.pr, stream PR state and Linear evidence. No main merge, release, deployment, or credential changes authorized or attempted.

- 2026-10-31 05:46:14 append: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 05:47:10 `review.run`: passed — OK
- 2026-10-31 05:48:09 `review.run`: passed — OK
- 2026-10-31 05:51:07 `review.run`: passed — OK
- 2026-10-31 05:52:16 `verify`: failed — COMMAND_FAILED
- 2026-10-31 05:53:31 `review.run`: passed — OK
- 2026-10-31 05:55:56 `review.run`: passed — OK
- 2026-10-31 05:56:00 `verify`: failed — COMMAND_FAILED
- 2026-10-31 05:58:35 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/workspace/scripts/lib/verify-run-state.js`
- `packages/workspace/scripts/verify.js`

## Verification closure follow-up — 2026-10-31

- Strict review showed 16 newly introduced mechanical async error-handling findings; added explicit try/catch boundaries to 8 new async functions in both mirrored scripts. Next strict review: 0 blockers.
- First full verify discovered central MCP proxy read-only allowlist drift. Added exactly `linear.comments` and `linear.relations` (no write grants); `bun test packages/os/tests/mcp-central-proxy-scope.test.ts` green **7/7**.
- Second full verify failed on 22 **related pre-existing** async handling findings in the same touched Linear script pair, plus OS package-wide timing failures in unrelated trace browser cleanup and code.call telemetry tests under load.
- Mechanically wrapped remaining 11 existing Linear async entrypoints in both mirrors; kept CLI semantics and test signatures. Focused Linear/manifest/parity green **33/33**, central MCP scope green **7/7**, script syntax and diff whitespace checks pass, strict review 0 own blockers.
- Re-ran the flaky broad-suite failures isolated: `bun test packages/os/tests/trace-request-budget.test.ts` green **12/12** (browser launched and closed), and `bunx vitest run packages/os/tests/code-call.test.ts` green **30/30**. Those failures appear load-sensitive timeouts in broad package test, not feature regressions; no skip/timeout weakening was applied.
- Next gate is fresh full verify against current changed files, then approved task push and stream promotion; main merge or deployment remains explicitly forbidden.

- 2026-10-31 05:54:21 append: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`

## Third full verify — independent lifecycle test failure (2026-10-31)

- Current strict review: 0 blocking issues and 0 related-preexisting findings; DB guard passes; manifest and code focused tests green.
- Third full verify ran all 13 selected groups and failed solely on the critical *OS lifecycle update handoff contracts* group: 1 failure / 235 passes in `packages/os/tests/health-readiness.test.ts`: worker-drain in-flight response failed with socket `UND_ERR_SOCKET` (other side closed). All other selected groups passed.
- Re-ran this unaffected suite in isolation: `bunx vitest run packages/os/tests/health-readiness.test.ts` **13/13 green**. No lifecycle code changed by DEV-1660.
- Prior broad package test timeouts also passed in isolated runs (`trace-request-budget` 12/12, `code-call` 30/30). Failures in full suite appear nondeterministic timing/socket behavior under parallel load; no skips, timeout increases, or code changes to unrelated components.
- Re-run full verify against unchanged source for a clean publish-valid stamp. If this remains red, report blocker rather than bypass gates. Main and deployment prohibited.

- 2026-10-31 05:56:35 append: `.task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage/workpad.md`
