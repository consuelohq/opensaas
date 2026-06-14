# back cloudflare registry with d1 and preserve post bodies

## Goal

Verify and fix two current stream/security findings:
- Cloudflare route registry must work with real D1-style bindings, not only WeakMap-backed in-memory test objects.
- Edge router must preserve non-GET/HEAD request bodies under the Node/Vitest fetch runtime by using portable Request construction.

## Verification

- D1 finding: valid. Current registry operations reached `getState`; real D1 bindings missed the WeakMap and threw before route rows could be read or written.
- POST body finding: valid. Current proxy request construction assigned `request.body` without Node-compatible `duplex`, so POST routes returned `WORKSPACE_EDGE_ROUTER_ERROR` instead of reaching upstream.

## Test-first contract

Behavior under test:
- Registry operations work against a D1-like binding object that was not created by `createInMemoryWorkspaceRouteD1`.
- D1 storage persists route rows, resolves active routes, revokes hosts, and does not expose credentials.
- A signed POST request with a JSON body reaches upstream in the Node/Vitest runtime, preserving method/body and edge metadata.

## Implementation notes

- Added D1-like prepared-statement support to the registry type surface.
- Kept the existing in-memory WeakMap path for existing tests and local registry fixtures.
- Added real-D1 paths for migration, upsert, resolve, and revoke using `prepare`, `bind`, `first`, and `run`.
- Added POST body preservation by setting `duplex: 'half'` on non-GET/HEAD proxy requests.
- Converted new D1 helper functions away from async-await to satisfy the existing review rule for local try/catch; review still reports only pre-existing ERROR_HANDLING findings in this file.
- Removed temporary patch helper files before publishing.

## Files changed

- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`

## Validation

- Red focused opt-in D1 + edge-router contracts failed as expected: 2 failed / 11 passed. Trace `trc_e13271eaa06a`.
- Focused opt-in D1 + edge-router contracts passed: 2 files / 13 tests. Trace `trc_8a79cee0c578`.
- Full opt-in Cloudflare contract trio passed: 3 files / 18 tests. Trace `trc_efe9fe78d000`.
- Default-gated Cloudflare contract trio skipped 18 tests. Trace `trc_886986d44cd4`.
- Syntax check passed for D1 registry. Trace `trc_9d7da077b9a2`.
- Syntax check passed for edge router. Trace `trc_7960e9a8d1cf`.
- Diff stat inspected: 4 files changed, 286 insertions, 24 deletions. Trace `trc_c25e02fcf2d6`.
- Review initially failed on new async helpers. Trace `trc_2ec334f332b4`.
- Review passed after helper fix: 0 your issues, 0 blockers; 5 pre-existing findings remain. Trace `trc_7715b6e7930b`.
- Verify passed and wrote publish-valid stamp. Trace `trc_72d7af1883dc`.

- 2026-06-11 07:36:26 write: `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`

## workspace-owned: activity log

- 2026-06-11 07:36:26 fs.write: `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/workpad.md`

## workspace-owned: validation evidence

- 2026-06-11 07:36:34 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/current.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/evidence-log.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/read-log.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/session.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/verify.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/workpad.md`, `.task/tasks/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies.json`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/cloudflare-d1-route-registry.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
