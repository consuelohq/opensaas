# restore internal dashboard browser auth handoff

branch: `task/os/restore-internal-dashboard-browser-auth-handoff`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2147/restore-internal-dashboard-browser-auth-handoff
github pr: https://github.com/consuelohq/opensaas/pull/2147
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 22:16:49 fs.write: `.task/os/restore-internal-dashboard-browser-auth-handoff/workpad.md`
- 2026-08-16 22:26:36 fs.write: `.task/os/restore-internal-dashboard-browser-auth-handoff/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 22:27:05 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: an unauthenticated GET browser navigation to the internal dashboard (Accept includes text/html) starts the canonical Google web-login handoff and preserves pathname/query in return_to; non-HTML and API requests remain fail-closed with JSON 401; the owner-only dashboard authorization gate still runs after a valid workspace session.
existing local pattern: packages/os/scripts/lib/workspace-cloudflare-edge-router.ts already redirects unauthenticated HTML navigations to https://os.consuelohq.com/login/google/start with purpose=web and return_to.
new or changed tests: change packages/os/tests/internal-dashboard-integration.test.ts to require 302 + canonical Location for anonymous HTML / and /users requests, and retain an explicit JSON 401 assertion.
focused red command: yarn nx run os:test -- --run packages/os/tests/internal-dashboard-integration.test.ts
expected red failure: current dashboard edge short-circuit returns 401 for HTML / and /users instead of 302.
no-test waiver: not applicable

- 2026-08-16 22:16:49 append: `.task/os/restore-internal-dashboard-browser-auth-handoff/workpad.md`

## Diagnosis and implementation

- Live anonymous root returned 401 `{error: workspace_session_required}` while `/traces` correctly returned a 302 Google web-login redirect.
- Current upstream dashboard dispatch short-circuited generic workspace routing and explicitly asserted 401 for HTML `/` and `/users` requests.
- Fixed dashboard workspace-session rejection to redirect only GET requests accepting `text/html`, preserving pathname and query in a relative `return_to`; JSON/non-browser traffic remains 401.
- Live deployed Worker version `2d69b4b3-7170-46d3-a3d3-7cbd6d14dccf` has no `OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN`, `OS_INTERNAL_DASHBOARD_ACCESS_AUD`, or `OS_INTERNAL_DASHBOARD_ALLOWED_EMAILS` bindings. The Cloudflare account currently reports zero Access applications, so authenticated dashboard traffic necessarily fails closed as 403.
- Added all three operator authorization bindings to workspace-edge release readiness so future deploys cannot silently omit them.

## Verification

- Red: `cd packages/os && bun vitest run tests/internal-dashboard-integration.test.ts` failed `expected 401 to be 302` at the new browser-navigation assertion.
- Green: the same focused suite passed 6/6.
- Red: `cd packages/os && bun vitest run tests/cloudflare-worker-release-readiness.test.ts` failed because deployment incorrectly proceeded without dashboard auth bindings.
- Green: `internal-dashboard-integration`, `install-control-plane-cloudflare`, and `cloudflare-worker-release-readiness` passed 12/12.
- Green: `yarn nx run consuelo-os:typecheck` passed workspace script syntax checks.
- Note: Nx target discovery identified the project as `consuelo-os`; the inferred `consuelo-os:test` target is currently unusable because `packages/os` is not declared in the root Yarn workspace, so focused Vitest ran with Bun from `packages/os`.
- Cloudflare Access provisioning remains an external deployment gate: the cached Wrangler OAuth token can list Access apps but lacks `Access: Apps and Policies Write`; no Access application or audience currently exists to bind.

- 2026-08-16 22:26:36 append: `.task/os/restore-internal-dashboard-browser-auth-handoff/workpad.md`
