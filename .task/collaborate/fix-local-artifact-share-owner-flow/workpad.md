# Fix local artifact share owner flow

branch: `task/collaborate/fix-local-artifact-share-owner-flow`
stream: `stream/collaborate`
pr: https://github.com/consuelohq/opensaas/pull/2508
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(collaborate): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- The local loopback Artifacts page can create and revoke private artifact links from its Share UI without signed edge headers.
- The loopback mutation surface is protected by an owner-only browser CSRF capability generated into the local Artifacts page; arbitrary unsigned POSTs without that capability remain denied.
- Managed workspace share-management routes remain signed and unchanged.
- Public recipient claim/view behavior remains unchanged.

existing local pattern:
- Existing local control-plane pages use browser-origin/CSRF mechanisms for safe loopback mutations; reuse the narrowest established pattern rather than weakening signed gateway authorization.

new or changed tests:
- Extend Artifacts local HTML/Hono tests with the loopback owner mutation capability and negative missing/invalid-capability cases.
- Preserve existing signed management route tests and artifact-sharing link tests.

focused red command:
`bunx vitest run packages/os/tests/artifacts-hono-routes.test.ts packages/os/tests/artifacts.test.ts packages/os/tests/artifact-sharing-links.test.ts`

expected red failure:
- Current local Artifacts Share POST returns `MISSING_SIGNATURE` because the browser has no edge-signed request path.

no-test waiver: not applicable.

- 2026-09-21 05:05:23 append: `.task/collaborate/fix-local-artifact-share-owner-flow/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 05:05:23 fs.write: `.task/collaborate/fix-local-artifact-share-owner-flow/workpad.md`
- 2026-09-21 11:59:26 fs.write: `.task/collaborate/fix-local-artifact-share-owner-flow/workpad.md`
- 2026-09-21 12:02:37 fs.write: `.task/collaborate/fix-local-artifact-share-owner-flow/workpad.md`

## workspace-owned: files read

- `packages/documentation/src/content/docs/build/files-and-artifacts.mdx`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/nodes-site.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/artifacts.ts`
- `packages/os/scripts/server/services/artifact-sharing.ts`
- `packages/os/scripts/server/services/artifacts-gateway.ts`

## acceptance criteria — resolved

- [x] Local loopback Artifacts Share can create a private link without weakening signed workspace-edge authorization.
- [x] Local owner mutations require same-origin loopback plus a durable high-entropy CSRF capability injected only into the loopback Artifacts page.
- [x] The local CSRF capability is stored with mode 0600, compared in constant time, and is not disclosed on remote workspace requests.
- [x] Signed machine/edge share-management requests continue to use the existing `route:/gateway/artifacts:write` authorization.
- [x] Generated links are canonical HTTPS workspace links, never `127.0.0.1` links, so they can be sent by text and opened on another device.
- [x] Recipient claim/view, expiry, revocation, hash-only secret storage, noindex/no-referrer behavior remain intact.
- [x] Focused Artifacts, local-server architecture, workspace-edge contracts, and syntax validation pass.

## implementation notes

- The first artifact-sharing release correctly shipped the secure recipient path and Share controls, but live loopback testing exposed two owner-path defects before handoff: the local Share POST had no signed edge headers, and a relative share URL would resolve to the loopback origin.
- This follow-up uses a loopback-only CSRF capability instead of bypassing auth generally, and canonicalizes every created link against the configured workspace host.
- Remote workspace traffic still depends on edge signing; the local capability never substitutes for remote authorization.

## validation

- Red reproduced: loopback Artifacts page had no CSRF capability and the live Share POST returned `MISSING_SIGNATURE`.
- Green: Artifacts/share suites 29/29.
- Green: Workspace Edge route preservation + Sites Gateway integration 26/26.
- Green: workspace script syntax checks.

- 2026-09-21 11:59:26 append: `.task/collaborate/fix-local-artifact-share-owner-flow/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 11:59:54 `review.run`: passed — OK
- 2026-09-21 12:00:46 `review.run`: passed — OK
- 2026-09-21 12:01:54 `verify`: passed — OK
- 2026-09-21 12:02:37 `verify`: passed — OK

## verify wait cycle

Wait reason: Full task verify exceeded the foreground MCP request timeout after focused suites and static review were already green.
Duration: 30s.
Resume action: Inspect the workpad for a new verify validation record; if absent, run the selected focused suites directly and use the publish gate to report any remaining blocker.
Expected signal: a passed verify entry after 12:00 UTC.
Fallback: diagnose only owned failures; do not rerun blindly.

- 2026-09-21 12:02:37 append: `.task/collaborate/fix-local-artifact-share-owner-flow/workpad.md`
