# test(os-web): define universal login auth contract

branch: `task/os-web/test-os-web-define-universal-login-auth-contract`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1559/test-os-web-define-universal-login-auth-contract
github pr: https://github.com/consuelohq/opensaas/pull/1559
started: 2026-07-22
base sha: `a7a3265b2f54d74ff5416c5a9d92659dde6e8fc3`
task session: `tsk_fb2f87d41f93`

## acceptance criteria

- [ ] Inventory every current public and protected OS web route with exact method, path, status, headers, host assumptions, and backing store.
- [ ] Characterize Google OAuth, MCP OAuth/PKCE, device-code, connector HMAC, workspace membership, node registration, cookie, D1, and workspace-route behavior without changing existing contracts.
- [ ] Define the universal-login handoff schema, route matrix, threat model, and Worker 14 implementation ownership.
- [ ] Add deterministic characterization tests and executable future-contract tests for zero/one/multiple membership, safe return paths, single-use audience-bound handoffs, host-scoped sessions, OAuth invariants, bearer challenges, protected pre-auth data, and repeat-install routing.
- [ ] Preserve existing regression suites and keep unimplemented Worker 14 behavior explicitly identified without shipping the full login/session implementation.
- [ ] Record focused red/green evidence, broader OS regression results, CodeRabbit and Grok review/dispositions, and merge the task PR into `stream/os-web` only.

## plan

1. Map current route/storage/auth ownership through memory, explore, exact searches, and full-file reads.
2. Choose the nearest existing test harness and document the current route matrix and security invariants.
3. Write focused behavioral tests first; run the expected red failure before adding any minimal deterministic test seam or contract fixture.
4. Add only fixtures, contract helpers, tests, and an OS design note needed to hand Worker 14 an executable implementation boundary.
5. Run focused tests, unchanged OS web/security/MCP regressions, review, verify, CodeRabbit, Grok, and disposition all findings.
6. Push and merge the task PR into `stream/os-web`; leave the stream PR unmerged.

## Test-first contract

- Behavior under test: current protected-route/OAuth/MCP/connector contracts remain exact while the new universal-login contract rejects unsafe return paths and models host-scoped, audience-bound, expiring, single-use workspace handoffs.
- Existing pattern to follow: pending repository exploration of OS Cloudflare/Hono route tests and deterministic D1/auth fixtures.
- New or changed tests: route matrix characterization plus universal-login contract helpers/fixtures; concrete files pending exploration.
- Focused red command: pending test-harness discovery.
- Expected red failure: missing universal-login contract module/fixture or absent required security behavior, before any minimal seam is added.
- No-test waiver: none; this task is test-first by definition.

## current status

- Task started from fresh `main`; stream was initialized from the same SHA because the assigned remote stream did not yet exist.
- Investigation in progress. No product implementation has been changed.

## files changed

- `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`
- `packages/os/tests/os-web-auth-contract.test.ts`

## workspace-owned: files changed

- `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`
- `packages/os/tests/os-web-auth-contract.test.ts`

## workspace-owned: activity log

- 2026-07-22 20:40:12 fs.write: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
- 2026-07-22 20:41:14 fs.write: `packages/os/tests/os-web-auth-contract.test.ts`
- 2026-07-22 20:41:40 fs.write: `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- 2026-07-22 20:42:27 fs.write: `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`
- 2026-07-22 20:42:56 fs.write: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
- 2026-07-22 20:44:16 fs.write: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
- managed by workspace hooks

## workspace-owned: validation evidence

- managed by workspace hooks
- 2026-07-22 20:43:23 `review.run`: passed — OK
- 2026-07-22 20:44:11 `verify`: passed — OK

## key decisions

- Keep this worker limited to contract analysis, tests, fixtures, and minimal deterministic seams. Worker 14 owns the full login/session route implementation.
- Use local deterministic stores/fixtures. The live Cloudflare lane and credential remain reserved for Worker 17.

## notes for ko

- No lifecycle command will be run on either real Mac.

## improvements noticed

- The active core `task.start` facade dropped the discovered `createStream` flag. Recovery required the typed GitHub raw escape hatch to create `stream/os-web` from current `main`.
- The active `batch` facade did not propagate the outer task session to a child `fs.read`; direct task-scoped calls are being used.

## issues and recovery

- Initial main-file reads were ambiguous with parallel task worktrees. Recovered through bounded OS `code.call` from the verified main checkout.
- `stream.sync` failed because `origin/stream/os-web` did not exist (`trc_e48002e7b578`).
- `task.start` accepted `createStream` in discovery schema but dropped the flag (`trc_6d6608195b9e`). Created the missing stream ref from main through typed GitHub raw operations (`trc_a194a5d5e3a5`, `trc_9c50183640be`), then stream sync passed (`trc_37baea488a28`) and normal task start succeeded (`trc_78ac82acaf8e`).
- A task-scoped batch failed to propagate `taskSession` (`trc_d958c4a23188`). Switched to direct task-scoped calls.

---

## publish checklist

- [ ] workpad current
- [ ] focused red then green
- [ ] route/security regressions pass
- [ ] diff self-reviewed
- [ ] review and verify pass
- [ ] task pushed
- [ ] CodeRabbit requested and dispositions posted
- [ ] Grok review posted and temporary review files removed
- [ ] task merged into stream; stream not promoted to main

- 2026-07-22 20:40:12 write: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- `packages/workspace/scripts/task-push.js`

## implementation and validation update

- Route inventory: 21 current Hono routes captured in `packages/os/plans/consuelo-os-foundation/web-auth-contract.md` with backing stores and preserved protocol boundaries.
- Added pure, non-registered contract seam for safe return paths, zero/one/multiple membership outcomes, host-only session cookies, route ownership, and deterministic audience/expiry/single-use handoff behavior.
- Focused red: `trc_578a18320b17` failed because `security/web-auth-contract.ts` did not exist.
- Focused green: `trc_70430113d19d` passed 5 new tests.
- Security/regression selection: `trc_f24f688a6432` passed 38 tests; 21 pre-existing environment-gated tests skipped under their existing flags.
- Syntax/type lane plus core device/MCP regressions: `trc_21bc756503b4` passed syntax checks and 38 tests.
- Working-tree diff reviewed: `trc_8fd3a50461dd`; changes remain inside the worker-owned contract/test/design-note boundary plus task metadata.
- Additional route ownership details: device-code remains `/login/device/code` and `/login/oauth/access_token`; MCP remains `/oauth/*` plus `/mcp*`; no runtime route registration changed.

## files changed (final implementation set)

- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/tests/os-web-auth-contract.test.ts`
- `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`
- task-local metadata/workpad files under `.task/os-web/test-os-web-define-universal-login-auth-contract/`

## acceptance status before repository gates

- [x] Current public/protected route and storage inventory documented.
- [x] Google OAuth, MCP OAuth/PKCE, device-code, connector HMAC, D1, workspace, and node regression boundaries documented.
- [x] Handoff/session schema and threat model defined.
- [x] Deterministic executable contract tests added with red/green evidence.
- [x] Worker 14 implementation files and ownership specified.
- [ ] Repository review/verify gates, external reviews, push, dispositions, and stream merge pending.

- 2026-07-22 20:42:56 append: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`

## repository gates

- Strict review passed with no findings: `trc_3d8ba1c9d912`.
- Full publish-valid verify passed for the three owned files, including review and DB guard: `trc_69150347dba2`.

- 2026-07-22 20:44:16 append: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
