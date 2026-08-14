# verify edge transformed site snapshots by source hash retry

branch: `task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1702/verify-edge-transformed-site-snapshots-by-source-hash-retry
github pr: https://github.com/consuelohq/opensaas/pull/1702
started: 2026-07-28

## acceptance criteria

- [ ] The workspace edge exposes a stable SHA-256 header computed from the exact R2 snapshot bytes before downstream Cloudflare HTML transformation.
- [ ] The platform publisher verifies public snapshots through that source hash, route version, status, and cache authority.
- [ ] Cloudflare challenge-script injection or another downstream HTML transform does not create a false publication failure.
- [ ] A missing or incorrect source hash fails publication verification.
- [ ] Private launcher verification remains the exact `401 workspace_session_required` contract.
- [ ] The live internal publication completes and every intended child Site returns the published release version and expected source hash.
- [ ] Focused tests, typecheck, review, and verify pass before promotion.

## plan

1. Reapply the already reviewed source-hash change on a task branch created directly from the current `stream/security` head.
2. Re-run the focused red/green contract packet and package validation against the stream-based branch.
3. Promote through `stream/security` to `main`, deploy the workspace-edge Worker, and rerun the internal publication.
4. Verify the private launcher and every public child Site from the live hostname.

## Test-first contract

- Behavior under test: the Worker computes `x-consuelo-site-content-hash` from the exact R2 HTML; the publisher accepts a transformed public response when that header matches and rejects a mismatched header.
- Existing pattern: edge-router tests inject deterministic R2 bodies; publisher tests inject deterministic edge responses and compare release metadata.
- Changed tests: assert the Worker header against a locally computed SHA-256; make the successful publisher fixture append downstream HTML while returning the source hash; add a wrong-hash rejection.
- Focused red evidence: PR #1701 demonstrated that the Worker had no source-hash header, transformed HTML failed publisher verification, and an incorrect source hash was accepted.
- Focused green command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/install-edge-site-publisher.test.ts tests/workspace-edge-sites-gateway-integration.test.ts`.

## current status

- PR #1701 contains the validated implementation but was based on `main` while targeting a newly advanced stream, producing non-metadata merge conflicts.
- This replacement task starts from the current `stream/security` head and will carry the same five-file product change without branch-history surgery or force push.
- The complete internal Site set is already uploaded and D1 routes all intended pages at release `sha256-2094f19b293208ae`; only stable post-transform verification and final publication confirmation remain.
- The source-hash implementation is reapplied on the stream-based branch.
- Focused coverage is green: 46 tests across publisher, edge router, and Sites/Gateway integration.
- Typecheck and `git diff --check` pass. Review, verify, promotion, Worker deployment, and live publication remain.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 03:45:11 `review.run`: passed — OK
- 2026-07-28 03:45:28 `verify`: passed — OK

## key decisions

- Replace the conflicted task with a clean stream-based task rather than resetting or force-pushing the existing branch.
- Do not strip or normalize Cloudflare-injected HTML in the publisher; that would bind correctness to unstable third-party markup.
- Compute the source hash inside the Worker before the response leaves the Worker and verify it at the publisher boundary.

## validation evidence

- Prior red evidence: PR #1701 proved the Worker returned no source hash, transformed HTML failed publisher verification, and a wrong source hash was accepted.
- Replacement green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/install-edge-site-publisher.test.ts tests/workspace-edge-sites-gateway-integration.test.ts` — 3 files, 46 tests passed.
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

- 2026-07-28 03:43:45 apply-patch: `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-28 03:44:21 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-07-28 03:44:21 apply-patch: `packages/os/scripts/lib/install-edge-site-publisher.ts`
- 2026-07-28 03:44:21 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-07-28 03:44:22 apply-patch: `packages/os/tests/install-edge-site-publisher.test.ts`
- 2026-07-28 03:44:22 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-28 03:44:43 apply-patch: `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/current.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/evidence-log.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/read-log.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/session.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash-retry/workpad.md`, `.task/tasks/security/verify-edge-transformed-site-snapshots-by-source-hash-retry.json`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
