# Forward artifact share session at edge

branch: `task/collaborate/forward-artifact-share-session-at-edge`
stream: `stream/collaborate`
pr: https://github.com/consuelohq/opensaas/pull/2514
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
- The public `/share/artifacts/*` edge proxy forwards the recipient's artifact-share HttpOnly cookie to the node after claim, so the second request can render the artifact.
- The edge must not forward arbitrary browser cookies to unrelated signed gateway-service routes.
- Public share requests continue to receive node-scoped edge signing, and recipient claim/view remain no-store.

existing local pattern:
- `buildGatewayNodeProxyRequest` already builds the minimal header allowlist for node-bound gateway-service traffic.
- Public artifact sharing is uniquely cookie-bearing: the recipient session cookie is scoped to `/share/artifacts/<shareId>` and the node validates it against the persisted hashed session token.

new or changed tests:
- Add a workspace-edge integration regression proving `cookie` is forwarded for the public artifact-share route.
- Add/retain an assertion that authenticated non-share gateway routes do not forward browser cookies.

focused red command:
`CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os ../../node_modules/vitest/vitest.mjs run tests/workspace-edge-sites-gateway-integration.test.ts`

expected red failure:
- The upstream request for `/share/artifacts/*` currently has no `cookie` header because `buildGatewayNodeProxyRequest` copies only accept/content-type/last-event-id.

no-test waiver: not applicable.

- 2026-09-21 12:51:09 append: `.task/collaborate/forward-artifact-share-session-at-edge/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 12:51:09 fs.write: `.task/collaborate/forward-artifact-share-session-at-edge/workpad.md`
- 2026-09-21 12:53:00 fs.write: `.task/collaborate/forward-artifact-share-session-at-edge/workpad.md`

## workspace-owned: files read

- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## implementation and evidence

- Live E2E proved the share capability was claimed successfully: the browser received `consuelo_artifact_share_<shareId>`.
- The second public share GET still rendered the landing page because Workspace Edge stripped all browser cookies when constructing the signed node request.
- Fix is intentionally narrow: only the public `/share/artifacts` gateway-service route may forward cookies, and it filters the Cookie header down to names beginning `consuelo_artifact_share_`.
- Workspace session cookies and unrelated cookies remain stripped from node-bound requests.
- Red test reproduced the missing upstream artifact-share cookie.
- Green after fix:
  - Workspace Edge integration/route/router suites: 53/53.
  - Artifact sharing/routing/Hono suites: 9/9.
  - Workspace script syntax checks passed.

- 2026-09-21 12:53:00 append: `.task/collaborate/forward-artifact-share-session-at-edge/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 12:53:25 `review.run`: passed — OK
- 2026-09-21 12:53:43 `verify`: passed — OK
