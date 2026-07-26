# Implement web security E2E

branch: `task/os-web/implement-web-security-e2e`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1662/implement-web-security-e2e
github pr: https://github.com/consuelohq/opensaas/pull/1662
started: 2026-07-26
task session: `tsk_546a718c96a9`
start point: fresh `main`; `stream/os-web` is aligned with main (`ahead: 0`, `behind: 0`)
assigned lane: Stream C / `stream/os-web`; deterministic local fixtures and GitHub CI, plus only the dedicated Cloudflare `consuelo-os-dev` environment when explicitly approved
real-machine boundary: no install, update, reset, restart, or uninstall on Ko's Mac Mini or MacBook Air

## acceptance criteria

- [x] Lock one executable method/path/auth/status/header/storage/destination matrix covering health and OAuth metadata, device-code, Google login/callback, MCP auth/token/introspection, central `/mcp`, workspace chooser, handoff consume/logout, launcher, `/gtm`, traces/feed, connector origin, route-not-found, and unsupported methods.
- [x] Prove exact OAuth redirect/PKCE and compliant bearer challenges remain unchanged.
- [x] Prove one-hour access-token renewal and retry-safe refresh-token rotation for duplicate/concurrent requests, interrupted responses, transient persistence failure, bounded credential families, and replay of the previous refresh request.
- [x] Prove handoff expiry, host binding, atomic one-time consumption, cookie scope, protected pre-auth redaction, log/error redaction, workspace isolation, and node isolation/default-route preservation with no silent fallback.
- [x] Prove connector traffic keeps private-tunnel signed-edge/HMAC enforcement and WAF policy distinguishes public metadata from protected MCP/connector paths without broad bypasses.
- [x] Add guarded, idempotent, fail-closed web release/migration acceptance using the registered `consuelo-os-dev` GitHub environment and run-ID-scoped Cloudflare resource cleanup; produce an inventory instead of deleting unknown resources.
- [ ] Run focused red then green behavioral tests, broader web regressions, syntax/typecheck/Wrangler dry-runs, strict review, and publish verify against `origin/main`.
- [ ] Push a reviewable task PR to `stream/os-web`, request CodeRabbit, run the prescribed Grok 4.5 review, post every result and disposition, remove temporary review artifacts, pass CI, and merge only the task PR into `stream/os-web`.
- [ ] Stop at any unapproved live deploy or real-Mac step with an exact human command and expected result; do not promote the stream to main or start downstream workers.

## plan

1. Read all web workpads, Worker 13-16 and 25 contracts, current authority/edge routes, release workflows, and existing security tests.
2. Build the current executable route/security inventory and identify only evidence-backed acceptance gaps.
3. Update this workpad with the exact test targets, write the smallest behavioral tests first, and capture the intended red failures before production/workflow edits.
4. Implement only the verified integration, release-guard, cleanup-inventory, or retry-safety gaps; preserve the existing Hono, Durable Object, D1, connector, and route architecture.
5. Run focused green and the combined authority, gateway, launcher/GTM, traces, node, connector, and release lanes; inspect the diff and run strict review/verify.
6. Publish PR evidence, request CodeRabbit, run and post the prescribed Grok review, fix valid findings, rerun validation, and post dispositions.
7. Merge PR #1662 into `stream/os-web` only after terminal CI and complete review evidence. Live deployment/browser and second-Mac acceptance require their explicit approval/credential checkpoints.

## test-first contract

- Behavior under test: the integrated web surface has one exact route/security contract; refresh rotation remains usable under duplicate/interrupted/failing persistence paths; tenant/node boundaries fail closed; the registered Cloudflare acceptance lane creates and cleans only run-owned resources.
- Existing local patterns: `os-web-auth-contract.test.ts`, `os-universal-login.test.ts`, `workspace-edge-sites-gateway-integration.test.ts`, `workspace-node-registry-routing.test.ts`, `traces-hono-routes.test.ts`, connector transport/security tests, and `.github/workflows/consuelo-os-distribution-environments.yaml`.
- New or changed tests: `mcp-oauth-refresh-rotation.test.ts`, the existing central-MCP replay assertion in `os-device-authority-worker.test.ts`, an integrated web route matrix/security E2E test, and release-workflow cleanup/guard characterization.
- Focused red command: `bun x vitest run tests/mcp-oauth-refresh-rotation.test.ts` through task-scoped `code.call` against the task worktree.
- Expected red failure: duplicate/interrupted refresh requests returned `invalid_grant`, concurrent duplicates forked credential families, and replacement persistence failure consumed the original credential.
- Captured red evidence: `trc_da45e6a44709` (3 failed, 1 passed). Initial implementation narrowed to one test-fixture mismatch (`trc_8f53c5434fe5`); corrected focused green is `trc_60e70b8e7f5f` (4 passed).
- No-test waiver: none.

## current status

- Mandatory plan, environment registry, Worker 17 brief, Grok template, repository steering, coding standards, OS task/engineering skills, SCRIPTS.md, Workers 13-16/25 briefs, and every committed `os-web` workpad have been read.
- PR #1662 is open against `stream/os-web`; bootstrap head was `9be286f4277677010087fdbad63010215b0913a2`.
- `stream/os-web` and main are aligned, so the fresh-main task includes the integrated Worker 14, 15, 16, and 25 dependencies.
- Refresh-token rotation now commits access/replacement-refresh/tombstone state atomically, encrypts a one-minute identical-request replay receipt with a key derived from the presented old refresh token, preserves the original credential on failed persistence, collapses concurrent duplicates, and keeps one-hour access-token renewal unchanged.
- The focused refresh suite is green (`trc_60e70b8e7f5f`). Existing authority regressions were 63/65 green; the only two failures were the previous one-time-replay expectation now explicitly changed by Worker 17 (`trc_d09bd8370515`) and have been updated for rerun.
- `web-security-route-matrix.ts` now locks 19 distinct surfaces with exact method, path, auth class, success/failure statuses, headers, storage, destination, WAF class, and executable evidence paths. It distinguishes public metadata, session-protected routes, provider-limited MCP paths, and private connector origins.
- The manual Cloudflare acceptance job is environment-gated by `consuelo-os-dev`, requires only `CLOUDFLARE_OS_TEST_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`, provisions exact run-owned Worker/D1/R2 resources, enforces a six-hour inventory TTL, verifies them, uploads inventories, and always deletes only resources owned by the same run. Other reserved-prefix resources are reported rather than deleted.
- Final deterministic validation after formatting: owned auth/release lane 65/65 and connector/WAF/node/trace lane 175/175 (`trc_a2f606c0eff8`); workflow YAML, formatting, and syntax/type checks passed (`trc_e2c07ffa329c`); device-authority and workspace-edge Wrangler dry-runs passed (`trc_a4ba13f0135d`).
- Diff cleanup restored four legacy files from exact `main` blobs through the authenticated GitHub API, then reapplied only semantic hunks. The patch shrank from 3,619 additions/914 deletions (`trc_60dd0f3effce`) to 2,114 additions/28 deletions (`trc_706f336bbea6`). Post-cleanup validation remained 65/65 + 175/175 with syntax checks green (`trc_b89a6a9fe6d6`).
- No live Cloudflare deployment, browser login, account mutation, or real-Mac lifecycle action was performed.
- PR ancestry changed after implementation: `stream/os-web` advanced while this fresh-main task was in progress. Exact comparison first showed 5 commits ahead and 15 behind (`trc_4eaa6b7d7247`). GitHub's update-branch API merged the assigned stream into the task (`trc_79b70e7c01eb`), removing the behind count, but correctly exposed that the fresh-main ancestry still carries three unrelated main-only promotion commits and 63 files (`trc_e7dff335cf58`). The task therefore requires a true API restack onto the current stream before Grok, CodeRabbit disposition, or merge.
- Restack completed through the authenticated repository GitHub library: commit `3d20cda4032e02212cfc9c681c1cc964b96133e8` was created directly from `stream/os-web` SHA `735bd5f3ce66e66ebd3a732de122380cd93aacf3`, using only 18 Worker 17 product and scoped metadata files (`trc_a009f22fe24b`). Exact comparison is now one commit ahead, zero behind, 18 files (`trc_50070943c73a`). No main-only promotion commit remains in the task PR.
- Strict review initially found 19 missing explicit async-boundary handlers (`trc_402c1382b0b3`). The complete list was extracted (`trc_f797e40a049f`), all new crypto, transaction, Cloudflare API, resource lifecycle, and CLI boundaries were converted to typed contextual fail-closed handling, and strict review is now 0 findings (`trc_f2c92b40cc5e`).
- Final post-review validation is 65/65 + 175/175, syntax/typecheck, selected formatting, and workflow YAML parsing green (`trc_610bb9c7fa6b`).

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/cloudflare/os-device-authority/src/constants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/web-security-route-matrix.ts`
- `packages/os/scripts/testing/web-security/cloudflare-acceptance.ts`
- `packages/os/tests/mcp-oauth-refresh-rotation.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/web-security-e2e.test.ts`


## workspace-owned: files changed

- `.task/os-web/implement-web-security-e2e/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/constants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/web-security-route-matrix.ts`
- `packages/os/scripts/testing/web-security/cloudflare-acceptance.ts`
- `packages/os/tests/mcp-oauth-refresh-rotation.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/web-security-e2e.test.ts`

## workspace-owned: activity log

- 2026-07-26 15:42:30 fs.write: `.task/os-web/implement-web-security-e2e/workpad.md`
- 2026-07-26 15:44:39 fs.write: `packages/os/tests/mcp-oauth-refresh-rotation.test.ts`
- 2026-07-26 15:48:57 fs.write: `packages/os/tests/web-security-e2e.test.ts`
- 2026-07-26 15:49:26 fs.write: `packages/os/cloudflare/web-security-route-matrix.ts`
- 2026-07-26 15:50:00 fs.write: `packages/os/scripts/testing/web-security/cloudflare-acceptance.ts`
- maintained by Consuelo OS hooks

## workspace-owned: validation evidence

- 2026-07-26 15:57:43 `review.run`: passed — OK
- 2026-07-26 15:59:02 `review.run`: passed — OK
- 2026-07-26 15:59:51 `review.run`: passed — OK
- 2026-07-26 16:00:47 `verify`: passed — OK
- 2026-07-26 16:04:09 `verify`: passed — OK
- 2026-07-26 16:04:27 `verify`: passed — OK
- 2026-07-26 16:05:53 `verify`: passed — OK

## key decisions

- Treat current integrated architecture as authoritative. Worker 17 may add integration tests, release guards, and minimal fixes, but must not replace Hono, Durable Object, D1, connector, launcher/GTM, trace, or node-routing designs.
- Because `stream/os-web` is at parity with main, retaining `startFrom: main` satisfies both the user's fresh-main requirement and Worker 17 dependency requirement.
- No Cloudflare mutation occurs without the dedicated `consuelo-os-dev` lane and explicit deployment approval; no production credential substitution is permitted.
- Retry-safe rotation deliberately returns the same token pair only for an identical request during a 60-second interruption window. The old token becomes an encrypted replay tombstone; changed requests and expired retries fail with `invalid_grant`.
- Durable Object implementations require transaction support for token-pair issuance and refresh rotation. Missing transaction support fails closed instead of permitting partially persisted credential families.
- The old refresh token becomes an encrypted replay tombstone whose own expiry is the 60-second replay deadline, preventing a long-lived chain of stale credential-family records.
- Cloudflare worker verification uses the account inventory endpoint rather than assuming the worker-script download endpoint returns a JSON API envelope.
- The live acceptance workflow remains manual because the environment registry marks the test credential path as blocked until the dedicated least-privilege secret exists and a human approves deployment.

## notes for ko

- No lifecycle command will run on either real Mac. Live browser login and second-machine installation remain human checkpoints.

## improvements noticed

- Pre-task `fs.read` still depends on active-task selection when multiple worktrees exist, despite being advertised as session-optional.

## issues and recovery

- Mandatory pre-task read of `packages/workspace/senior-engineer.md` failed with `AMBIGUOUS_TASK_SELECTION` because multiple task worktrees were active (`trc_5f7fc963666c`). Retry with explicit `branch: main` failed because `fs.read` required an active task for main (`trc_69c408bb6a1e`). Recovery: create the exact scoped task first, then reread every mandatory file through task-scoped `fs.read`; no legacy connector, native filesystem, or unscoped shell was used.
- The first `task.start` included an unsupported `github: true` value, which was parsed as a PR reference and failed (`trc_b2d47e43e120`). Recovery: retry the typed call without that field; it created PR #1662 and session `tsk_546a718c96a9` (`trc_7ff3c8f7b599`).
- Initial project-memory search for `task/os-web` returned no records (`trc_0e7a0adbcb68`). Recovery: use the committed `.task/os-web/*/workpad.md` files and current source as durable evidence.
- A guessed store-test path (`packages/os/tests/os-device-authority-stores.test.ts`) did not exist (`trc_ac607b085c49`). Recovery: list the actual authority tests (`trc_48bf2d16aac3`) and use the existing DurableStore coverage in `os-universal-login.test.ts` and `os-device-authority-architecture.test.ts`.
- A guessed authority object path (`src/objects.ts`) did not exist (`trc_f6724162e612`). Recovery: search the canonical `DurableStore` construction and locate it in `src/worker.ts` (`trc_7924a8877433`).
- The catalog-advertised `task.call` route failed with HTTP 403 `UNKNOWN_TOOL_SCOPE` because it is absent from the generated Consuelo tool manifest. Recovery: use the supported task-worktree-scoped `code.call`; the same focused red command then executed and produced `trc_da45e6a44709`.
- A release-lane source search requested `maxResults: 300`, above the typed limit, and failed validation (`trc_d80ee07c3d0c`). Recovery: retry with `maxResults: 200` (`trc_c3bf8d0c8cf0`).
- A WAF search included a nonexistent `infra/` root and failed (`trc_4366faaa04fa`). Recovery: retry only against existing `packages/os` and `.github` roots (`trc_93700cc011a1`).
- The first integrated matrix/workflow red run failed because the new owned modules did not exist (`trc_3784989eb105`). After implementation, the first green attempt exposed only deterministic test-fixture ordering and repository-root assumptions (`trc_672051f3ac7c`); both were corrected (`trc_841c9bfc3446`).
- The first broad regression command ran package-root-sensitive tests from the repository root and produced path-resolution false negatives (`trc_498ffc77f128`). Recovery: rerun from `packages/os`; this isolated one genuine stale test assertion (`trc_8049400f9c3c`) and then passed all 175 tests after replacing an over-specific source match (`trc_685e65cdccd0`).
- A matrix evidence path referenced a nonexistent `workspace-edge-auth-integration.test.ts`, causing one of 65 tests to fail (`trc_319a9dfa82ac`). Recovery: inventory the actual tests (`trc_0d90af2a3e80`), replace it with the real workspace-edge integration test, and rerun 65/65 green (`trc_9c85c817d666`).
- The first Prettier check correctly found seven unformatted touched files (`trc_6041041f4142`). The initial formatter call used unsupported `mode: write` and failed validation (`trc_12fc86f03a6a`); retry with typed `mode: edit` formatted the files (`trc_ce078368be1d`), and the final check passed (`trc_e2c07ffa329c`).
- A large workpad patch missed stale context and failed without modifying the file (`trc_aab809f502bc`). Recovery: reread the current workpad (`trc_4a9dec8b90af`) and apply smaller exact hunks.
- A revision diff against `origin/main` initially reported zero because all edits were still uncommitted (`trc_e171638476fb`). Recovery: inspect the typed working-tree diff instead (`trc_60dd0f3effce`).
- Prettier had reformatted four legacy files, inflating the working patch to 3,619 additions and 914 deletions (`trc_60dd0f3effce`). A scoped filesystem attempt to read `main` was correctly rejected because the task session is branch-bound (`trc_0b314569d758`). The first raw GitHub call omitted its required reason (`trc_cb40fae887c5`); the corrected typed GitHub read succeeded (`trc_ad5d625099fe`). Recovery: use the authenticated GitHub API inside task-scoped `code.call` to restore exact `main` blobs (`trc_3195fbbd2e90`), reapply only semantic patches (`trc_75f85e331213`, `trc_83e3914466fe`, `trc_a6c9124d17f3`), and rerun all selected tests (`trc_b89a6a9fe6d6`).
- Strict review found 19 `ERROR_HANDLING` findings across newly added async paths (`trc_402c1382b0b3`). Recovery: extract all findings (`trc_f797e40a049f`), add explicit contextual error boundaries (`trc_1e2b01af4acd`, `trc_5ad4999b0241`), inspect the remaining 15 error/catch-typing findings (`trc_1beaa6b5662f`, `trc_08c1e5190fd9`), type every catch as `unknown`, wrap all Cloudflare client methods and CLI execution (`trc_c2c7a48a74db`, `trc_b350b853ea14`), and rerun strict review clean (`trc_f2c92b40cc5e`).
- The live tool catalog advertised `task.call`, but the generated Consuelo manifest rejected it again with `UNKNOWN_TOOL_SCOPE` during branch recovery. Recovery used the audited GitHub PR update-branch endpoint through `os.call` rather than native Git (`trc_79b70e7c01eb`). Because a merge cannot remove unrelated fresh-main ancestry, the next recovery is to create a commit tree from the current `stream/os-web` SHA using only the exact Worker 17 files and force-update only the task branch through the authenticated GitHub API. The task PR and session remain unchanged.
- The first explicit-file push used repository-root-relative paths from the OS package runtime and failed as outside the repository (`trc_7f7b7b46d509`). Retry with exact task-worktree absolute paths succeeded and durably captured all post-review changes at `ab7ff0912e79265a87827a22c60e32674ba38e60` (`trc_50828184f861`). The first API restack script resolved its module relative to the staged program and failed before mutation (`trc_7307cfcd410e`); retry resolved the repository library from `process.cwd()` and completed the exact restack (`trc_a009f22fe24b`).
- CodeRabbit was requested at https://github.com/consuelohq/opensaas/pull/1662#issuecomment-5084255216 after the typed comment operation proved unavailable. CodeRabbit reported its hourly review limit; retry is required after the external window resets. Grok packet creation was paused when the moving-base divergence was detected, and the temporary packet must be regenerated after restacking.

---

## publish checklist

```bash
bun run task:push -- --message "test(os-web): lock web security acceptance" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-26 15:42:30 write: `.task/os-web/implement-web-security-e2e/workpad.md`

- 2026-07-26 15:44:39 write: `packages/os/tests/mcp-oauth-refresh-rotation.test.ts`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/workers/17-web-security-e2e.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/testing/web-security/cloudflare-acceptance.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

- 2026-07-26 16:04:20 apply-patch: `.task/os-web/implement-web-security-e2e/workpad.md`

- 2026-07-26 16:05:46 apply-patch: `.task/os-web/implement-web-security-e2e/workpad.md`
