# fix ghl first user menu refresh and pipeline ux

branch: `task/dialer/fix-ghl-first-user-menu-refresh-and-pipeline-ux`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1810/fix-ghl-first-user-menu-refresh-and-pipeline-ux
github pr: https://github.com/consuelohq/opensaas/pull/1810
started: 2026-08-10

## acceptance criteria

- [x] Keep the initial authenticated CRM/caller load intact.
- [x] Replace the unchanged-overlay 10-second full CRM/caller batch with event-driven refresh and clean teardown.
- [x] Prove the installed menu ownership boundary and document the exact external payload if GHL/Marketplace owns the no-op route.
- [x] Prove pipeline stages render from a healthy response and queue preview preserves Marketing Pipeline -> New Lead without starting a call.
- [x] Preserve Single Dial and queue-first flows.
- [ ] Run focused tests, affected dialer tests, strict review, canonical verify, and publish to the task PR without merging.

## plan

1. Read the relevant code, task guidance, and current acceptance evidence.
2. Add red tests for the reproducible refresh defect and any pipeline/admin source defect found by reproduction.
3. Implement the smallest source fixes, preserving authentication and call-flow contracts.
4. Run focused LeadConnector/embed and dialer-server validation, then strict review and canonical verify.
5. Update this workpad with root causes, external configuration instructions, residual smoke steps, and GO/NO-GO.

## test-first contract

- Refresh: a scheduler test must prove no background full-resource interval is installed, focus/visibility refreshes are supported, and stop/remount cleanup does not retain listeners or duplicate work.
- Pipeline: a component/controller test must prove a response containing Marketing Pipeline -> New Lead produces a selectable option and queue preview state.
- Admin: repository tests must prove `/admin` resolves to the admin surface and authenticated controller initialization loads commercial dashboard data; live `javascript:void(0)` ownership will be classified from deployment payload code versus supplied acceptance evidence.
- Focused red command: `bun test packages/lead-connector/src/embed/idle-refresh.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/commercial-ui.acceptance.test.ts`.
- Expected first red result: the new refresh scheduler contract cannot pass against the existing 10-second interval implementation; pipeline/admin tests remain green if reproduction finds no repository defect.

## current status

- Implementation and package validation complete. Refresh is event-driven with teardown; pipeline/admin paths were reproduced and remain repository-correct. The live Custom Menu no-op is an external GHL/Marketplace configuration defect.

## files changed

- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/idle-refresh.ts`
- `packages/lead-connector/src/embed/idle-refresh.test.ts`
- `packages/lead-connector/src/embed/commercial-ui.acceptance.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `.task/dialer/fix-ghl-first-user-menu-refresh-and-pipeline-ux/workpad.md`

## workspace-owned: files changed

- `packages/lead-connector/src/embed/idle-refresh.test.ts`
- `packages/lead-connector/src/embed/idle-refresh.ts`

## workspace-owned: activity log

- 2026-08-10 01:51:10 fs.write: `packages/lead-connector/src/embed/idle-refresh.test.ts`
- 2026-08-10 01:51:43 fs.write: `packages/lead-connector/src/embed/idle-refresh.ts`

## workspace-owned: validation evidence

- 2026-08-10 02:00:15 `review.run`: passed — OK
- 2026-08-10 02:00:16 `review.run`: passed — OK
- 2026-08-10 02:00:28 `verify`: passed — OK

## key decisions

- Treat the installed `javascript:void(0)` Custom Menu as a live GHL/Marketplace payload/configuration issue unless repository evidence shows a generated artifact overwriting the URL.
- Do not mutate GHL/Marketplace configuration, customer data, billing, carrier state, or provider call state in this task.
- Keep the initial authenticated `authenticate()` batch unchanged. Remove only the unconditional idle resource timer and refresh on focus or a transition to visible; controller-level coalescing and active-call suppression remain in force.
- Do not add a speculative pipeline normalizer: `listLeadConnectorPipelines()` maps provider `pipelines[].stages[]`, the embed view flattens those stages into queue options, and queue preview already returns candidates without starting a call.

## notes for ko

- No `packages/lead-connector/AGENTS.md` exists on the task branch; `packages/lead-connector/EMBED.md` and `README.md` are the applicable area guidance, and `packages/workspace/senior-engineer.md` was read after task creation.

## root causes and evidence

- Refresh: `packages/lead-connector/src/embed/main.ts` installed `setInterval(refreshIdleResources, 10_000)`. Each tick called `controller.refreshResources()` (Contacts + Opportunities + Pipelines) and `controller.loadCommercial()` (caller, plus admin dashboard), even when the overlay was unchanged. The controller coalesced overlapping calls but did not prevent the repeated batches. The fix is `createLeadConnectorIdleRefreshScheduler()` with idempotent start/stop, focus refresh, visible-transition refresh, and no polling timer.
- Admin entry: `packages/lead-connector/src/deployment/custom-menu.ts` already emits `new URL('/admin', embedUrl).toString()` with iframe mode, location scoping, admin role, microphone permission, and no camera. `packages/lead-connector/scripts/build-embed.ts` only emits Marketplace click-to-call JS/CSS artifacts; it does not generate `javascript:void(0)` menu URLs. `/admin` is an application-shell path in `cloudflare-worker.ts`; controller authentication exchanges the supported parent context at `/v1/embed/session` and, for the admin surface, loads `/v1/commercial/admin`. Repository ownership is therefore disproved for the live no-op.
- Pipeline: provider/application tests prove `pipelines[].stages[]` mapping and queue candidate hydration; new embed/controller tests prove `Marketing Pipeline — New Lead` renders as an option and previews one candidate. No deterministic source defect reproduced, so no pipeline production edit was made. Removing the destructive idle overwrite also prevents a later empty/transient resource response from needlessly replacing a previously healthy selector.

- Exact external GHL/App Test change for orchestrator application, not run here:

  ```json
  {
    "title": "Consuelo Dialer",
    "url": "https://calls.consuelohq.com/admin",
    "icon": { "name": "phone", "fontFamily": "fas" },
    "showOnCompany": false,
    "showOnLocation": true,
    "showToAllLocations": false,
    "locations": ["Wkbuoi0VRjQ7KMKUjdTY"],
    "openMode": "iframe",
    "userRole": "admin",
    "allowCamera": false,
    "allowMicrophone": true
  }
  ```

  The repository-owned operator path is `bun run --cwd packages/lead-connector configure:sandbox-menu` with the orchestrator-managed access token, `LEADCONNECTOR_SANDBOX_LOCATION_ID=Wkbuoi0VRjQ7KMKUjdTY`, and `LEADCONNECTOR_SANDBOX_EMBED_URL=https://calls.consuelohq.com`; do not run it from this task.

## improvements noticed

- The existing controller coalescing test covers concurrent refresh calls, while the new scheduler test covers browser lifecycle cleanup and the lack of polling.

## issues and recovery

- The initial `git.diff` against local `stream/dialer` showed 148 inherited files because that local ref did not match the task-start source SHA. `origin/stream/dialer` showed no committed delta before task publish; task worktree edits remain scoped to the files listed above. No destructive cleanup or branch reset was performed.
- An initial typecheck probe used unsupported Bun option ordering and printed help with exit 0; it was discarded. Corrected `bun run --cwd <package> typecheck` commands passed.

## validation evidence

- Red: `bun test packages/lead-connector/src/embed/idle-refresh.test.ts` failed before implementation because `./idle-refresh` did not exist.
- Green: `bun test packages/lead-connector/src` -> 108 pass, 0 fail; `bun run --cwd packages/lead-connector typecheck` -> pass.
- Green: `bun test packages/dialer-server/src` -> 122 pass, 0 fail; `bun run --cwd packages/dialer-server typecheck` -> pass.
- Green: `bun run --cwd packages/lead-connector build` -> TypeScript and browser embed build pass.
- Green: deployment/embed-build/worker contracts -> 11 pass, 0 fail.
- No authenticated live browser smoke was run because this task branch was not deployed and provider mutation is prohibited. Do not press Start Dialer during the residual smoke.

## residual post-deploy smoke

1. In GHL App Test location `Wkbuoi0VRjQ7KMKUjdTY`, verify the Custom Menu opens `https://calls.consuelohq.com/admin` as an iframe, not `javascript:void(0)`; capture `/v1/embed/session` 201 and `/v1/commercial/admin` 200 with commercial headings.
2. Open the overlay from Contacts or Opportunities, confirm the initial CRM/caller batch, wait at least 30 seconds without interaction, and confirm no repeating 10-second Contacts + Opportunities + Pipelines + Caller batch. Switch focus or visibility and confirm one reasonable refresh; verify close/reopen and route change still recover the overlay.
3. In Choose list, select `Marketing Pipeline — New Lead`, verify the queue summary and expected callable candidate preview, and stop before any dial action. Verify Single dial still selects a contact/number and queue-first setup remains available.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `package.json`
- `packages/api/src/middleware/requireAuth.ts`
- `packages/api/src/routes/__tests__/ghl.spec.ts`
- `packages/api/src/routes/commercial.ts`
- `packages/api/src/routes/ghl.ts`
- `packages/api/src/routes/index.ts`
- `packages/api/src/routes/leadconnector.ts`
- `packages/api/src/services/ghl-auth.ts`
- `packages/api/src/services/ghl-client.ts`
- `packages/api/src/services/ghl-pipeline.ts`
- `packages/dialer-server/package.json`
- `packages/dialer-server/src/embed-boundary.test.ts`
- `packages/dialer-server/src/lead-connector-boundary.test.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/lead-connector/AGENTS.md`
- `packages/lead-connector/EMBED.md`
- `packages/lead-connector/README.md`
- `packages/lead-connector/package.json`
- `packages/lead-connector/project.json`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/scripts/configure-sandbox-menu.ts`
- `packages/lead-connector/src/application.contract.test.ts`
- `packages/lead-connector/src/application/resources.ts`
- `packages/lead-connector/src/contracts/index.ts`
- `packages/lead-connector/src/contracts/lead-connector.ts`
- `packages/lead-connector/src/deployment/custom-menu.test.ts`
- `packages/lead-connector/src/deployment/custom-menu.ts`
- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/combobox.ts`
- `packages/lead-connector/src/embed/commercial-ui.acceptance.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/embed-build.contract.test.ts`
- `packages/lead-connector/src/embed/index.html`
- `packages/lead-connector/src/embed/index.ts`
- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/protocol.ts`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/surface.ts`
- `packages/lead-connector/src/embed/view.test.ts`
- `packages/lead-connector/src/embed/view.ts`
- `packages/twenty-front/public/consuelo-ghl-click-to-call.js`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/senior-engineer.md`
