# audit launcher traces web wave before main

branch: `task/os-web/audit-launcher-traces-web-wave-before-main`
stream: `stream/os-web`
pr: https://github.com/consuelohq/opensaas/pull/1649
started: 2026-07-25

## goal

Audit the completed launcher/GTM work together with the already-integrated universal-login, node-routing, and trace contracts before promoting `stream/os-web` to `main`.

## acceptance criteria

- [x] Recheck Worker 15 and Worker 16 against Workers 13, 14, and 25 contracts.
- [x] Verify the reported workspace-edge route-record fixture drift with a focused failing test before editing.
- [x] Preserve private workspace-root, authenticated `/gtm`, protected traces, explicit node routing, offline disclosure, and redaction boundaries.
- [x] Run combined auth, launcher, gateway, trace, security, and typecheck gates.
- [x] Run task review and verify with zero task-owned findings.
- [ ] Merge corrections into `stream/os-web` and promote the audited stream to `main` only after normal CI.
- [ ] Do not request or retry external AI reviews.

## test-first contract

The combined route record must represent the shipped authenticated route matrix rather than an older public-root fixture:

- `/` is a workspace-session route with private preview metadata;
- `/gtm` is present and workspace-session protected;
- trace routes remain authenticated and workspace/node isolated;
- no fixture may silently bless a public workspace root.

No production or fixture edit before the focused integration test proves the current mismatch.

## plan

1. Read the route-record fixture, route seed, launcher/GTM tests, trace routes, and relevant worker briefs/workpads.
2. Run the narrow integration test red and confirm the failure is the reported fixture drift.
3. Patch only the verified fixture/contract gap.
4. Run combined web security and routing suites, then review and verify.
5. Merge into the web stream and promote the stream after CI.

## current status

- Worker 15 merged to `stream/os-web` through PR #1641 with CodeRabbit and Grok approval.
- Worker 16 was already integrated in the preceding web wave; PR #1643 only reconciled a duplicate dispatch.
- Closed duplicate PR #1648 surfaced one potentially valid integration finding: `integratedRouteRecord()` may still model the workspace root as public and omit `/gtm`.
- The finding was valid. The integration fixture now includes literal authenticated `/gtm` before the root fallback and models the launcher root as `workspace-session` plus `private-preview`.
- No production route behavior changed; the correction prevents integration tests from blessing an obsolete public-root topology.
- No new external review will be requested.

## test-first and validation evidence

- RED: the new fixture-alignment assertion failed 1/14 because `/` was `public`/`static-shell`; `/gtm` was also absent (`trc_f7d11d1d7d1b`).
- GREEN: workspace edge Sites/Gateway integration passed 14/14 with the registered gateway contract enabled (`trc_1e71b60713cf`).
- GREEN: launcher, Sites CLI, universal login, Hono traces, trace redaction, and trace rendering passed 31 tests; environment-gated route suites remained separately covered.
- GREEN: workspace gateway and hostname edge-router contracts passed 9/9.
- GREEN: OS package typecheck/syntax gate passed.
- GREEN: strict task review reported zero owned or pre-existing findings (`trc_4af188be3c99`).
- GREEN: full task verify is publish-valid with review, package registry selection, and DB safety clean (`trc_3b643d71aeb8`).

## files changed

- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-25 01:10:53 write: `.task/os-web/audit-launcher-traces-web-wave-before-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-25 01:10:53 fs.write: `.task/os-web/audit-launcher-traces-web-wave-before-main/workpad.md`

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/workers/15-launcher-gtm-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/16-traces-hono.md`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-25 01:11:12 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- 2026-07-25 01:11:26 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-25 01:11:58 apply-patch: `.task/os-web/audit-launcher-traces-web-wave-before-main/workpad.md`

## workspace-owned: validation evidence

- 2026-07-25 01:12:21 `review.run`: passed — OK
- 2026-07-25 01:12:37 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os-web/audit-launcher-traces-web-wave-before-main/current.json`, `.task/os-web/audit-launcher-traces-web-wave-before-main/evidence-log.json`, `.task/os-web/audit-launcher-traces-web-wave-before-main/read-log.json`, `.task/os-web/audit-launcher-traces-web-wave-before-main/session.json`, `.task/os-web/audit-launcher-traces-web-wave-before-main/workpad.md`, `.task/tasks/os-web/audit-launcher-traces-web-wave-before-main.json`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

- 2026-07-25 01:12:44 apply-patch: `.task/os-web/audit-launcher-traces-web-wave-before-main/workpad.md`