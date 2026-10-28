# verify private launcher during site publication

branch: `task/security/verify-private-launcher-during-site-publication`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1699/verify-private-launcher-during-site-publication
github pr: https://github.com/consuelohq/opensaas/pull/1699
started: 2026-07-28

## acceptance criteria

- [ ] The platform publisher verifies the private launcher without requiring an operator browser session or workspace cookie.
- [ ] A launcher route is accepted only when the edge returns the exact redacted `workspace_session_required` JSON contract.
- [ ] An unauthenticated `200` launcher response fails publication verification because it would expose a private workspace shell.
- [ ] Public Site snapshots still require status `200`, snapshot cache authority, the expected release version, and the exact body hash.
- [ ] All R2 uploads complete before the D1 route record switches to the new publication set.
- [ ] The internal workspace publication succeeds and `/configuration`, `/tools`, `/environments`, and `/secrets` serve the new snapshot version.
- [ ] Focused tests, typecheck, review, and verify pass before promotion.

## plan

1. Add focused publisher tests for the private-launcher verification contract and the public-child verification contract.
2. Teach the publisher to verify `/` through an exact `401 workspace_session_required` JSON response while keeping strict content verification for public routes.
3. Preserve upload-before-route-switch ordering and bounded redacted publication logs.
4. Run focused tests, typecheck, review, and verify; promote through `stream/security` to `main`.
5. Publish the complete internal Site snapshot set and verify the live routes.

## Test-first contract

- Behavior under test: after publication, the root launcher must reject an unauthenticated JSON request with exactly `workspace_session_required`; every public child snapshot must return the uploaded bytes and release metadata.
- Existing pattern: `install-edge-site-publisher.test.ts` injects command and fetch adapters, captures exact Wrangler ordering, and verifies failure-stage diagnostics.
- Changed tests: make the successful publisher fixture return a private-launcher `401`, assert the root request asks for JSON, and add a regression proving an unauthenticated launcher `200` fails closed.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-edge-site-publisher.test.ts`.
- Expected red failure: the current publisher requires `200` plus a Site body for every URL and cannot distinguish the intentionally private launcher from public snapshots.

## current status

- The first publication repair is merged and both Cloudflare Workers are deployed.
- The publisher now verifies the private launcher through an exact JSON `401 workspace_session_required` response and continues strict version/body verification for public snapshots.
- An unauthenticated launcher `200` and a `401` response with extra fields both fail closed.
- Focused integration coverage is green: 76 tests across publisher, route seed, edge router, device authority, and Sites/Gateway integration.
- Typecheck/syntax and `git diff --check` pass. Review, verify, promotion, and live publication remain.

## files changed

- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 03:34:43 `review.run`: passed — OK
- 2026-07-28 03:34:55 `verify`: passed — OK

## key decisions

- Verify privacy through the public edge contract rather than supplying or persisting a workspace session cookie in the platform publisher.
- Accept only exact JSON `401 { "error": "workspace_session_required" }` for the root launcher; arbitrary `401`, redirects, HTML, or unauthenticated `200` responses remain failures.
- Keep byte-for-byte verification for public snapshots. R2 upload success proves the private launcher object exists; edge `401` proves its D1 route is private.

## validation evidence

- Focused red: the successful publication fixture failed at `/` because the old publisher required a public `200` Site body for the private launcher.
- Focused green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-edge-site-publisher.test.ts` — 6 tests passed.
- Integrated green: the five-file Cloudflare/Sites packet passed 76 tests.
- `bun run --cwd packages/os typecheck` — passed.
- `git diff --check` — passed.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-28 03:33:55 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-28 03:34:17 apply-patch: `.task/security/verify-private-launcher-during-site-publication/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/verify-private-launcher-during-site-publication/current.json`, `.task/security/verify-private-launcher-during-site-publication/evidence-log.json`, `.task/security/verify-private-launcher-during-site-publication/read-log.json`, `.task/security/verify-private-launcher-during-site-publication/session.json`, `.task/security/verify-private-launcher-during-site-publication/workpad.md`, `.task/tasks/security/verify-private-launcher-during-site-publication.json`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
