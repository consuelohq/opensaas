# verify edge transformed site snapshots by source hash

branch: `task/security/verify-edge-transformed-site-snapshots-by-source-hash`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1701/verify-edge-transformed-site-snapshots-by-source-hash
github pr: https://github.com/consuelohq/opensaas/pull/1701
started: 2026-07-28

## acceptance criteria

- [ ] The workspace edge exposes a stable SHA-256 header computed from the exact R2 snapshot bytes before downstream Cloudflare HTML transformation.
- [ ] The platform publisher verifies public snapshots through that source hash, route version, status, and cache authority.
- [ ] Cloudflare challenge-script injection or another downstream HTML transform does not create a false publication failure.
- [ ] A missing or incorrect source hash fails publication verification.
- [ ] Private launcher verification remains the exact `401 workspace_session_required` contract.
- [ ] The live internal publication completes and every intended child Site returns the published release version.
- [ ] Focused tests, typecheck, review, and verify pass before promotion.

## plan

1. Add an edge-router contract for the source-content hash response header.
2. Add publisher coverage proving transformed response HTML is accepted only when the pre-transform source hash matches.
3. Emit the hash from the Worker and verify it in the publisher instead of hashing downstream-mutated HTML.
4. Validate, promote through `stream/security`, deploy the workspace-edge Worker, and rerun the internal publication.

## Test-first contract

- Behavior under test: the Worker computes `x-consuelo-site-content-hash` from the exact R2 HTML; the publisher accepts a transformed public response when that header matches and rejects a mismatched header.
- Existing pattern: edge-router tests inject deterministic R2 bodies; publisher tests inject deterministic edge responses and compare release metadata.
- Changed tests: assert the Worker header against a locally computed SHA-256; make the successful publisher fixture append downstream HTML while returning the source hash; add a wrong-hash rejection.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/install-edge-site-publisher.test.ts tests/workspace-edge-sites-gateway-integration.test.ts`.
- Expected red failure: the Worker has no source-hash header and the publisher hashes the downstream body after Cloudflare injects its challenge script.

## current status

- The complete internal Site set is already uploaded and D1 now routes all intended pages successfully at release `sha256-2094f19b293208ae`.
- Live child pages return `200`, the correct version, and the correct titles. Publication verification still reports failure because Cloudflare injects a challenge script before `</body>`, changing the response body after the Worker reads R2.
- The Worker now emits `x-consuelo-site-content-hash` from the exact R2 HTML before the response leaves the Worker.
- The publisher now verifies that source hash rather than downstream-mutated response bytes while retaining status, route-version, and cache-authority checks.
- A wrong source hash fails closed; a transformed response with the correct source hash succeeds.
- Focused coverage, typecheck, and `git diff --check` pass. Review, verify, promotion, Worker deployment, and the final live publication remain.

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

- 2026-07-28 03:41:02 `review.run`: passed — OK
- 2026-07-28 03:41:17 `verify`: passed — OK

## key decisions

- Do not strip or normalize Cloudflare-injected HTML in the publisher; that would bind correctness to unstable third-party markup.
- Compute the source hash inside the Worker before the response leaves the Worker and verify the signed release metadata at the publisher boundary.
- Preserve exact body-hash semantics internally through the new response header while allowing legitimate downstream transformations.

## validation evidence

- Focused red: the Worker returned no source-hash header; transformed HTML failed publisher verification; an incorrect source hash was incorrectly accepted.
- Focused green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/install-edge-site-publisher.test.ts tests/workspace-edge-sites-gateway-integration.test.ts` — 3 files, 46 tests passed.
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

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`

- 2026-07-28 03:39:30 apply-patch: `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/workpad.md`
- 2026-07-28 03:39:49 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-07-28 03:39:49 apply-patch: `packages/os/tests/install-edge-site-publisher.test.ts`
- 2026-07-28 03:39:49 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- 2026-07-28 03:40:14 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-07-28 03:40:15 apply-patch: `packages/os/scripts/lib/install-edge-site-publisher.ts`

- 2026-07-28 03:40:36 apply-patch: `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/current.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/evidence-log.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/read-log.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/session.json`, `.task/security/verify-edge-transformed-site-snapshots-by-source-hash/workpad.md`, `.task/tasks/security/verify-edge-transformed-site-snapshots-by-source-hash.json`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
