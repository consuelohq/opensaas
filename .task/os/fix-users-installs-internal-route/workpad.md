# fix users installs internal route

## Objective
Restore the custom internal `Users & installs` launcher destination at `https://internal.consuelohq.com/users` without exposing the dashboard on customer workspace hosts or replacing the normal internal workspace Home route.

## Root cause / evidence
- The custom launcher link is correct and resolves to `/users` on `internal.consuelohq.com`.
- Workspace Edge only intercepts the dashboard routes when the legacy Cloudflare Access triple (`OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN`, `OS_INTERNAL_DASHBOARD_ACCESS_AUD`, `OS_INTERNAL_DASHBOARD_ALLOWED_EMAILS`) is fully configured.
- The live Workspace Edge deployment has none of those bindings; Cloudflare has no Access applications for the account. Therefore dashboard access state is `disabled` and an authenticated `/users` request falls through to the normal workspace origin, which has no `/users` page and returns bare `Not found`.
- This Access gate predates the current first-party workspace browser-session handoff. The exact internal host already has a server-side workspace-session validator through Device Authority.

## Acceptance contract
1. `/users`, `/users/*`, `/installs`, `/installs/*`, `/devices`, `/errors`, dashboard assets, and internal dashboard API routes on exact host `internal.consuelohq.com` are served when the request has a valid internal workspace browser session, even when legacy Cloudflare Access settings are absent.
2. Anonymous dashboard HTML requests still redirect to the Consuelo web login; JSON/API requests remain 401.
3. `/` on `internal.consuelohq.com` remains the normal workspace Home/launcher when legacy Access is absent; the dashboard must not hijack Home.
4. If all legacy Cloudflare Access settings are configured, preserve the additional Access/operator gate. If only some are configured, continue failing closed.
5. No customer workspace hostname gains dashboard routing.
6. Existing internal dashboard authorization, diagnostic redaction, and enrollment-reset protections remain intact.

## Test plan
- Add a regression test proving no-Access-config + valid internal workspace session serves `/users`, while anonymous `/users` is redirected/401 and `/` still falls through to normal workspace routing.
- Keep the partial-Access fail-closed test.
- Keep the fully configured/explicit authorizer tests proving an operator gate can still deny.
- Run targeted `internal-dashboard-integration`, `workspace-chrome`, and relevant dashboard/control-plane tests.
- Run typecheck/lint or the smallest package verification gate covering modified files.

## Expected code/docs scope
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/tests/internal-dashboard-integration.test.ts`
- `packages/os/docs/install-control-plane.md` (auth contract update if behavior changes)

## Integration
Target: `stream/os` via task workflow. No direct stream edits.

- 2026-09-05 00:28:50 write: `.task/os/fix-users-installs-internal-route/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 00:28:50 fs.write: `.task/os/fix-users-installs-internal-route/workpad.md`
- 2026-09-05 00:29:00 apply-patch: `packages/os/tests/internal-dashboard-integration.test.ts`
- 2026-09-05 00:29:15 apply-patch: `packages/os/cloudflare/workspace-edge/src/index.ts`
- 2026-09-05 00:30:42 fs.write: `.task/os/fix-users-installs-internal-route/workpad.md`

## workspace-owned: files read

- `packages/os/docs/install-control-plane.md`
- `packages/os/package.json`

## workspace-owned: validation evidence

- 2026-09-05 00:30:17 `review.run`: passed — OK
- 2026-09-05 00:30:37 `verify`: passed — OK

## Implementation completed
- Split dashboard page matching into dedicated dashboard paths vs shared `/`.
- When legacy Cloudflare Access settings are absent, dedicated dashboard routes now use the already-established exact-host workspace browser session as the authorization boundary.
- Shared `/` still falls through to normal internal workspace routing, so Home is not replaced.
- Fully configured Cloudflare Access still adds the operator JWT/allow-list gate; partial configuration still fails closed.
- Updated the install-control-plane security/deployment documentation to match the current authorization model.

## Verification evidence
- Red test first: new regression received `404` instead of expected `302` before the production change (`trc_0f8d8fe841fe`).
- Focused regression after fix: 10/10 integration tests pass (`trc_0ce75c5a63eb`).
- Dashboard/chrome suite: 20/20 tests pass; syntax/typecheck passes; Workspace Edge Wrangler dry-run bundles successfully (`trc_7b33d1f6ba92`).
- Strict review: 0 blocking issues / 0 findings (`trc_6f8ca85452bb`).
- Full task verify: passed, publish-valid, no DB risks (`trc_1e93bfa28975`).

## Remaining integration step
Publish/merge the task to `stream/os`, deploy the updated Workspace Edge worker, then verify the live authenticated `/users` route.

- 2026-09-05 00:30:42 append: `.task/os/fix-users-installs-internal-route/workpad.md`
