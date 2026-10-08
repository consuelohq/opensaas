# repair GoHighLevel installation and queue loading smoke

branch: `task/dialer/repair-gohighlevel-installation-and-queue-loading-smoke`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2621
linear: DEV-1619
started: 2026-10-08

## acceptance criteria

- [ ] Admin sidebar and Contacts/Opportunities launcher still open the intended Consuelo dialer surfaces.
- [ ] Authenticated LeadConnector opportunity advanced search returns JSON HTTP 200 instead of 502.
- [ ] Populated and empty pipeline-stage queues render correctly from the installed UI.
- [ ] Fresh install/reinstall for the approved Wet Stone test location completes using the intended HTTPS callback.
- [ ] Marketplace/backend redirect configuration is internally consistent without altering billing, number provisioning, carrier-call behavior, or unrelated live installations.
- [ ] Exact candidate deployment/source commit and post-deploy read-back evidence are recorded.

## plan

1. Re-establish current runtime truth: Railway dialer deployment, relevant 5xx/provider logs, redirect env presence/value, and browser/API reproduction.
2. Reconcile source ownership for LeadConnector opportunity search and OAuth callback/redirect handling.
3. Define focused tests around the observed provider contract and redirect behavior, run them red, then implement the smallest repair.
4. Run LeadConnector/dialer-server focused tests and service-backed no-carrier smoke coverage.
5. Deploy only the affected backend/edge/config surfaces, then verify queue loading and fresh Wet Stone install/reinstall with read-back evidence.
6. Publish through the task workflow into stream/dialer and record the stream review PR.

## current status

- Task started from `stream/dialer` at stream head `2d135a31...`.
- Re-verified Wet Stone in the authenticated GHL browser. The admin custom page loads and Contacts -> Open Consuelo Dialer opens the overlay.
- Current production no longer reproduces the historical queue API failure: authenticated `POST /v1/integrations/leadconnector/opportunities/search` and `POST /v1/integrations/leadconnector/queues/preview` both return HTTP 200.
- Railway production `dialer-server` is healthy on deployment `7f7135c4-9546-4ba3-83dd-12227221b630` (2026-09-22) and still has `LEADCONNECTOR_REDIRECT_URI` configured.
- The Marketplace-approved callback path from DEV-1619, `/api/lead-connector-embed/auth/callback`, currently falls through to the LeadConnector SPA instead of the backend OAuth callback. The canonical backend callback at `/v1/integrations/leadconnector/callback` is live through the edge.
- Existing Mercury LIVE registration and all billing/number/carrier settings are preservation constraints.

## Test-first contract

behavior under test:
- LeadConnector advanced opportunity search uses the provider contract GoHighLevel currently accepts and maps upstream failures into safe diagnostic errors.
- OAuth installation/session exchange uses the canonical HTTPS callback consistently across source/runtime configuration.

existing local pattern:
- Reuse existing `packages/lead-connector` provider adapter/application contract tests and `packages/dialer-server` LeadConnector route/integration tests.

new or changed tests:
- Added Cloudflare edge coverage requiring the existing Marketplace callback path to rewrite to the canonical backend OAuth callback while preserving query parameters.

focused red command:
- `bun test packages/lead-connector/src/embed/cloudflare-worker.test.ts`

expected red failure:
- Before the implementation, the Marketplace callback was served as a 200 SPA asset response instead of proxying to the backend test origin (expected 201, received 200).

no-test waiver:
- Not applicable.

## files changed

- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`

## key decisions

- Use `stream/dialer`; DEV-1619 is in the Linear [stream]dialer project and references stream source audit `d768f6cc...`.
- Do not place a carrier call. No live call is required for this repair.
- Preserve the shared Mercury LIVE app/other installations unless current evidence proves an approved, narrowly-scoped config mutation is required for Wet Stone reinstall.
- Prefer compatibility at our edge over editing the shared LIVE Marketplace registration: accept its already-approved HTTPS callback path and rewrite only that exact path to the existing backend callback route.
- Do not change the opportunity-search request shape without a current failure. Production now returns 200 for both search and queue preview, so the historical 502 is treated as already repaired unless subsequent smoke evidence regresses.

## notes for ko

- Wet Stone is the approved test location from DEV-1619.
- The issue explicitly separates OS browser click-helper artifacts from product defects; UI navigation must be confirmed by a real browser interaction/network result before changing launcher code.

## improvements noticed

- none yet

## errors i ran into

- `tools.search` initially rejected `limit: 8` because the current maximum is 5; retried with the supported limit successfully.
- First workpad rewrite required the current `fs.write` overwrite flag; retried with `force: true`.
- The first Cloudflare raw deploy attempt resolved a relative Wrangler config outside the task worktree; do not treat it as a provider deployment. Use a task-worktree execution path for the actual release.

## validation evidence

- Red: focused edge test failed exactly on the Marketplace callback being served as the SPA (`expected 201, received 200`).
- Green: `packages/lead-connector/src/embed/cloudflare-worker.test.ts` -> 9 pass / 0 fail.
- Package: `@consuelo/lead-connector` -> 158 pass / 0 fail / 1294 assertions.
- Typecheck: `tsc --noEmit` passed.
- Build: `tsc && bun run build:embed` passed.
- Browser network: current Wet Stone overlay -> opportunity search 200 and queue preview 200; no carrier call initiated.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): repair gohighlevel install and queue smoke" --changed
bun run task:pr
bun run task:finish
```

- 2026-10-08 01:12:04 write: `.task/dialer/repair-gohighlevel-installation-and-queue-loading-smoke/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-08 01:12:04 fs.write: `.task/dialer/repair-gohighlevel-installation-and-queue-loading-smoke/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/src/errors.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/lead-connector/package.json`
- `packages/lead-connector/src/application.contract.test.ts`
- `packages/lead-connector/src/application/provider.ts`
- `packages/lead-connector/src/application/resources.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/wrangler.jsonc`
- `packages/os/tools/railway/handler.test.ts`

- 2026-10-08 02:01:49 apply-patch: `.task/dialer/repair-gohighlevel-installation-and-queue-loading-smoke/workpad.md`