# multi-node registry, presence, and routing

branch: `task/os-web/multi-node-registry-presence-and-routing`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1581/multi-node-registry-presence-and-routing
github pr: https://github.com/consuelohq/opensaas/pull/1581
started: 2026-07-23
task session: `tsk_60891d97bfc2`
start point: fresh `main` at source SHA prefix `05cb010a`
assigned lane: Stream C / `stream/os-web`; local fixtures and GitHub CI only
real-machine boundary: no install, update, reset, restart, or uninstall on Ko's Mac Mini or MacBook Air

## acceptance criteria

- [x] Persist one authoritative server-side workspace node registry with safe metadata, globally unique node identity/key binding, home/member roles, explicit default node, connector identity, capabilities, revocation state, and deterministic presence.
- [x] Preserve same-account workspace reuse, reconnect a valid same-machine node identity, create a distinct member identity on a fresh machine, and reject another node ID presented with a different key.
- [x] Support authenticated list, default selection, rename, revoke, heartbeat, and safe node-summary contracts with cross-workspace isolation and redaction.
- [x] Keep workspace hostname routing separate from node targeting; multiple node connectors coexist, explicit calls reach the requested node, untargeted calls use the default, and an unavailable default fails without cross-node fallback.
- [x] Revoked nodes cannot heartbeat, route, or call.
- [x] Add deterministic behavioral coverage for two-node registration, routing, TTL presence, revocation, isolation, and response redaction while preserving existing auth/gateway regressions.
- [x] Document the selected Durable Object/D1 authority boundary and expose the compact current/default/node-count contract needed by Worker 07.
- [x] Complete CodeRabbit, Grok 4.5, GitHub posting/dispositions, and final clean validation.
- [x] Stop at the real-Mac human checkpoint with the exact MacBook Air command and expected two-node result.

## plan

1. Map current device-authority persistence, connector provisioning, gateway routing, auth route matrix, API contracts, and tests from fresh main. **Done.**
2. Select one storage/routing authority boundary and record the test-first contract. **Done.**
3. Add focused behavioral tests first and confirm expected red failures. **Done.**
4. Implement the narrow store/API/routing changes while preserving legacy single-node records. **Done.**
5. Run focused, gateway, authority, syntax, manifest, and full package validation. **Done; formal review gates remain.**
6. Push the task PR to `stream/os-web`; request CodeRabbit and run the prescribed Grok 4.5 review. **Pending.**
7. Verify/fix findings, post dispositions, remove temporary review artifacts, and stop at Ko's real-Mac checkpoint. **Pending.**

## test-first contract

- Behavior: one account may own multiple independently authenticated machines; the first home/default remains stable; node presence and revocation are deterministic; routing requires an explicit/default authorized online node and never silently crosses machines.
- Existing patterns followed: device authority Durable Object store, workspace-edge D1 route registry, connector provisioning, MCP proxy, edge router, web auth route matrix, and Vitest contract fixtures.
- Focused red command: `bun --cwd packages/os vitest run tests/workspace-node-registry-routing.test.ts` with `tddPhase: red`.
- Red result: 7/7 tests failed for missing node-key binding, management routes, heartbeat/presence, and node-aware routing (`trc_ad090171ad8f`).
- CLI red command: `bun --cwd packages/os vitest run tests/workspace-nodes-cli.test.ts`.
- CLI red result: missing canonical client module (`trc_33bbc99aba7a`).
- No-test waiver: none.

## implementation summary

### Durable Object authority

- `AccountWorkspace` now records `workspaceId`, `homeNodeId`, and explicit `defaultNodeId`.
- `WorkspaceNode` records safe metadata, connector identity/status, capabilities, state, public-key binding, and last-seen/revoked timestamps.
- Durable Object and memory stores maintain global node-ID ownership, account node indexes, and consumed heartbeat nonces.
- Registration reconnects only with the same node ID and key thumbprint; a different key or revoked node fails closed.

### Signed presence and administration

- Added protected `GET /workspace/nodes`, `POST /workspace/nodes/default`, `PATCH /workspace/nodes/:nodeId`, and `POST /workspace/nodes/:nodeId/revoke`.
- Added signed `POST /workspace/nodes/heartbeat` using the registered Ed25519 public key, bounded timestamps, and one-time nonces.
- Presence derives from server time: online <=60s and connected; stale >60s through 180s; offline after 180s, disconnected, or revoked.
- Safe responses omit public-key JWKs, credentials, tunnel origins, local paths, and tokens.

### D1 connector projection and routing

- Durable Object remains authoritative for membership/identity/admin; D1 owns only routable connector projections and the mirrored default.
- Existing D1 schema is reused: multiple `workspace_connectors` rows plus the per-host `record_json` projection; no new migration file is needed.
- Connector provisioning appends a member target without replacing the home/default target.
- Central MCP and direct workspace-edge routing accept `x-consuelo-node-id`, strip untrusted routing headers, and forward only resolved node/connector IDs.
- Untargeted requests use the explicit default. Missing, revoked, stale, or offline selected nodes fail deterministically. There is no cross-node fallback.
- Legacy single-connector records remain readable.

### Operator and UI contract

- Added `workspace:nodes` CLI commands: list, default, rename, revoke. OAuth bearer credentials are environment-only.
- Added `packages/os/docs/architecture/workspace-node-registry.md` with the DO/D1 boundary, presence/routing semantics, API/CLI usage, and Worker 07's compact `currentNodeId`, `defaultNodeId`, `nodeCount`, `presence`, and `nodes` payload.

## validation evidence

- Core green after implementation: 7/7 (`trc_e2ecf19288e0`).
- Existing authority/auth regression initially exposed an obsolete reconnect fixture that generated a new key for the same node ID (`trc_fcbe6955a524`). Updated the fixture to reuse the registered key, matching Worker 25's approved behavior change; 39/39 passed (`trc_507ced1032c7`).
- Gateway fake D1 adapter initially assumed the old two-column insert (`trc_4a011d81befd`). Updated the fixture to parse the full production schema; 31/31 gateway contracts passed (`trc_fa8be046898d`).
- Combined targeted validation after production-schema alignment: 31/31 gateway plus 45/45 authority/routing/CLI/auth passed (`trc_7ea89241845a`).
- Routing/registry suite expanded to 9/9, including two connector provisioning, explicit/default central and edge routing, no fallback, tenant isolation, and revoked-call zero-dispatch (`trc_5c5f08166db5`).
- CLI unit contract: 4/4 (`trc_cb9817cd9adc`).
- Syntax/typecheck script passed (`trc_fe3acaaa27ec`; rerun also passed before `check-files` argument validation in `trc_40a7092b207d`).
- Generated tool manifest is current (`trc_4342841f1c19`).
- CLI help rendered successfully (`trc_9534d5b1288e`).
- Default full package command executed all assertions successfully but exited nonzero after completion because Vitest's default fork pool emitted `options.minThreads and options.maxThreads must not conflict` (`trc_557af4056986`). No repository or environment worker bounds were present.
- Recovery: explicit nonconflicting worker bounds, `bun --cwd packages/os vitest run --pool=threads --maxWorkers=4`, passed 270 files with 1,544 tests passed, 62 skipped, and 11 todo.
- Full-suite-created unrelated facade snapshot changes were inspected, identified as missing/reordered pre-existing snapshots, and restored exactly from main; focused diff is clean (`trc_a250193b00eb`, restore `trc_90a70fac09e2`, confirmation `trc_ac097cd561d4`).
- Initial strict workspace review reported nine error-boundary findings (`trc_13d58886984c`). Added explicit route/service and D1 read/write/connector error boundaries; syntax plus 52 focused tests passed (`trc_7be1dcbbda84`).
- Strict workspace review rerun passed with zero findings (`trc_3094989ab435`).
- Full `verify` passed review and DB-risk gates, marked the task publish-valid, and wrote the verify stamp (`trc_33150812367d`).

## changed product/test/doc files

- `packages/os/package.json`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/os/scripts/workspace-nodes.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tests/workspace-nodes-cli.test.ts`
- `packages/os/docs/architecture/workspace-node-registry.md`

Task metadata under `.task/os-web/multi-node-registry-presence-and-routing/` and `.task/tasks/os-web/` is maintained by Consuelo OS.

## key decisions

- Start from fresh `main`, not the seven-commit-behind `stream/os-web` tip.
- Extend the existing device-authority/D1 model; do not create a parallel registry or another product review tool.
- Treat node ID + Ed25519 key as the durable machine identity. Same-ID/different-key reconnect is an explicitly approved rejection.
- Keep the first home node as default when members are added. Default changes are explicit administrative actions.
- Fail when the selected/default node is unavailable; never route to another online machine automatically.
- Use local deterministic fixtures and GitHub CI. Live Cloudflare resources remain Worker 17's lane.
- Do not execute any lifecycle action on Ko's real machines.

## issues and recovery

- Pre-task `fs.read` was ambiguous across unrelated worktrees (`trc_06a812474e6f`); `branch: main` was interpreted as a task branch (`trc_ed10696c484d`). Recovered by reading pre-task governance through the OS host-read route and creating the exact task session.
- Task-scoped `batch` lost the parent session (`trc_5c5af30c2a18`; children `trc_70b9c2c6572c`, `trc_74d4fbcb1d6e`). Direct task-scoped file/code calls succeeded (`trc_7458dd733027`).
- Direct `status` ignored the task session and reported shared main (`trc_f302df5f9610`). Task truth remains `tsk_60891d97bfc2`.
- Initial `code.call` red invocation used unsupported `command` rather than `code` (`trc_b6cf57a7539d`); corrected typed input.
- Initial `fs.apply_patch` used unsupported `patch` rather than `patchText` (`trc_5dbf2794a54c`); corrected typed input.
- An attempted `build` script did not exist (`trc_fc026965cb2f`); repository-defined scripts were inspected and only valid lanes were used.
- A `code.call` JSON import resolved relative to its temporary program path and failed (`trc_382df5230594`); recovered with `readFileSync` from the task cwd (`trc_57154d817cc9`).
- `check-files` was called without its required explicit file list after syntax passed (`trc_40a7092b207d`). It is a JS-only nested checker and is not the TypeScript validation lane for these files; syntax, focused tests, full tests, manifest check, review, and verify are used instead.
- A specific-file `git.diff` call used `files` as an array instead of `paths` (`trc_9a8129c9353b`); corrected after inspecting the typed schema.
- GitHub raw content retrieval first omitted the required reason (`trc_ecb40d05a6b4`); retried with a reason (`trc_3643a5128334`). The bounded response was not used as file content; exact local main content was restored through task-scoped `fs.write`.
- `task.push` injected an unsupported `--task-session` flag into the canonical script (`trc_4fcbb03fe2d1`). The advertised `task.call` and `task.exec` recovery routes were absent from the generated runtime manifest (HTTP 403 `UNKNOWN_TOOL_SCOPE`). Manifest-backed `code.call` retained `tsk_60891d97bfc2` and exposed the canonical help (`trc_690906fa8354`), but branch and PR recovery initially found no local active-task record (`trc_890fe8693bab`, `trc_975fed2883d0`). Recovery: `task.init` reconstructed the local registry from the existing branch, PR #1581, worktree, and session (`trc_8265c8c060db`); the canonical verified task-push script can then publish from the resolved task worktree without the incompatible CLI flag.
- Grok review launch through the exact wrapper and typed `subagent` route each exceeded the outer OS call boundary while their child Grok processes remained active; the wrapper output file was still empty, so both attempts fail closed until a completed JSON artifact is observed. Active same-prompt Grok processes at diagnosis: PIDs 43639, 45536, and 47609 (`trc_e6d0f65e38cd`).

### Grok wait cycle 1

- Start time (UTC): 2026-07-23 03:31:15Z
- Wait reason: allow the already-running bounded Grok 4.5 reviews to finish after the outer OS calls timed out without terminating child processes.
- Duration: 60 seconds.
- Resume action: immediately inspect the three same-prompt Grok PIDs and the temporary review output/log artifacts.
- Expected signal: at least one same-prompt Grok process exits and yields a non-empty completed JSON review; empty, cancelled, incomplete, or timed-out output fails closed.
- Fallback: continue bounded polling without launching another Grok process; if the 900-second harness deadline is reached without valid JSON, record the failed review as blocked by the provider/harness route.
- Wake result: the 60-second wait completed (`trc_0201181f956f`). All three processes were still present and the wrapper output remained empty (`trc_d4b88ab6e5bf`). Session logs showed active workspace MCP progress; the newest session subsequently ended with `outcome: cancelled`, `cancellation_category: permission_cancelled` (`trc_97fb449feb7f`) and is invalid.

### Grok wait cycle 2

- Start time (UTC): 2026-07-23 03:33:05Z
- Wait reason: allow the two older same-prompt Grok sessions to finish while excluding the cancelled newest session.
- Duration: 60 seconds.
- Resume action: immediately inspect PIDs 43639 and 45536 plus their session-log terminal events and any non-empty review output.
- Expected signal: one session exits with a completed, non-empty JSON review object.
- Fallback: continue polling to the 900-second harness deadline without launching another provider process.

## notes for Ko / real-Mac checkpoint

- No lifecycle command has been run on the Mac Mini or MacBook Air.
- Exact MacBook Air command for Ko to run, using the same Google account as the Mac Mini: `curl -fsSL https://install.consuelohq.com/os | bash -s -- --yes --install-daemons --mode local`.
- Expected browser result: Google OAuth opens and the existing workspace is selected instead of creating or renaming a workspace.
- Expected terminal result: installation completes, the MacBook Air receives a distinct member node/connector identity, and cloudflared plus the 30-second heartbeat LaunchAgent are installed.
- Expected node-list result: two distinct nodes are listed; the original Mac Mini remains `home` and default; the MacBook Air is `member` and online. Powering either machine off transitions it to stale after 60 seconds and offline after 180 seconds without routing to the other machine.

## publish checklist

- [x] Focused red tests recorded.
- [x] Focused green tests recorded.
- [x] Broader gateway/auth/routing and full package validation recorded.
- [x] Diff self-review removed an unrelated generated snapshot.
- [x] Workspace review passes.
- [x] Verify passes.
- [x] Task branch pushed and PR #1581 ready against `stream/os-web` at `3f5bb419ee99afe1adf44098bf993e406f9438a1`.
- [x] CodeRabbit requested twice; initial and post-fix incremental reviews completed with no inline findings (`trc_5abc5fbcbe1f`, `trc_a0c634d47949`).
- [x] Grok 4.5 structured review, three inline findings, top-level summary, and all dispositions posted to GitHub (`trc_6f762d80e228`).
- [x] Temporary `packages/os/.tmp-reviews/multi-node-registry-presence-and-routing/` removed (`trc_378e49b29323`).
- [x] Final validation after review fixes passes: strict review zero findings, verify publish-valid, 32/32 gateway contracts, and complete bounded suite 1,555 passing.
- [x] Ko checkpoint command and expected browser, terminal, node-list, and offline-state results recorded.

- 2026-07-23 03:12:51 write: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`

## files changed

- `packages/os/package.json`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/docs/architecture/workspace-node-registry.md`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/scripts/workspace-nodes.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tests/workspace-nodes-cli.test.ts`


## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/docs/architecture/workspace-node-registry.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/scripts/workspace-nodes.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tests/workspace-nodes-cli.test.ts`

## workspace-owned: activity log

- 2026-07-23 03:12:51 fs.write: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`
- 2026-07-23 03:39:54 fs.write: `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- 2026-07-23 03:41:09 fs.write: `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- 2026-07-23 03:41:15 fs.write: `packages/os/scripts/workspace-node-heartbeat.ts`
- 2026-07-23 03:47:48 fs.write: `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`

## workspace-owned: validation evidence

- Core green after implementation: 7/7 (`trc_e2ecf19288e0`).
- Existing authority/auth regression initially exposed an obsolete reconnect fixture that generated a new key for the same node ID (`trc_fcbe6955a524`). Updated the fixture to reuse the registered key, matching Worker 25's approved behavior change; 39/39 passed (`trc_507ced1032c7`).
- Gateway fake D1 adapter initially assumed the old two-column insert (`trc_4a011d81befd`). Updated the fixture to parse the full production schema; 31/31 gateway contracts passed (`trc_fa8be046898d`).
- Combined targeted validation after production-schema alignment: 31/31 gateway plus 45/45 authority/routing/CLI/auth passed (`trc_7ea89241845a`).
- Routing/registry suite expanded to 9/9, including two connector provisioning, explicit/default central and edge routing, no fallback, tenant isolation, and revoked-call zero-dispatch (`trc_5c5f08166db5`).
- CLI unit contract: 4/4 (`trc_cb9817cd9adc`).
- Syntax/typecheck script passed (`trc_fe3acaaa27ec`; rerun also passed before `check-files` argument validation in `trc_40a7092b207d`).
- Generated tool manifest is current (`trc_4342841f1c19`).
- CLI help rendered successfully (`trc_9534d5b1288e`).
- Default full package command executed all assertions successfully but exited nonzero after completion because Vitest's default fork pool emitted `options.minThreads and options.maxThreads must not conflict` (`trc_557af4056986`). No repository or environment worker bounds were present.
- Recovery: explicit nonconflicting worker bounds, `bun --cwd packages/os vitest run --pool=threads --maxWorkers=4`, passed 270 files with 1,544 tests passed, 62 skipped, and 11 todo.
- Full-suite-created unrelated facade snapshot changes were inspected, identified as missing/reordered pre-existing snapshots, and restored exactly from main; focused diff is clean (`trc_a250193b00eb`, restore `trc_90a70fac09e2`, confirmation `trc_ac097cd561d4`).
- 2026-07-23 03:13:17 `review.run`: passed — OK
- 2026-07-23 03:13:56 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- 2026-07-23 03:14:04 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- 2026-07-23 03:14:22 `review.run`: passed — OK
- 2026-07-23 03:14:35 `verify`: passed — OK
- 2026-07-23 03:14:42 apply-patch: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`
- 2026-07-23 03:15:18 apply-patch: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`
- 2026-07-23 03:15:25 `verify`: passed — OK
- 2026-07-23 03:16:03 apply-patch: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`
- 2026-07-23 03:16:07 `verify`: passed — OK
- 2026-07-23 03:46:48 `review.run`: passed — OK
- 2026-07-23 03:47:00 `verify`: passed — OK
- 2026-07-23 03:48:09 `verify`: passed — OK
- 2026-07-23 03:53:43 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/.tmp-reviews/multi-node-registry-presence-and-routing/grok-output.json`
- `packages/os/.tmp-reviews/multi-node-registry-presence-and-routing/grok-prompt.md`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/docs/architecture/workspace-node-registry.md`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/25-multi-node-registry-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/scripts/task-push.js`

## Grok finding verification and fixes

- `CR-001` — **valid, fixed**. Red coverage showed installed nodes had no recurring heartbeat emitter (`trc_35ce4595577b`). Added a one-shot signed heartbeat client, private persisted key/config, a 30-second user LaunchAgent, and standard daemon install/rollback/debug/uninstall ownership. The daemon discovery tests failed before lifecycle support (`trc_897a60b7a25b`) and passed 3/3 afterward (`trc_4651357ef79f`). Cryptographic client, TTL routing, and installer materialization coverage are green.
- `CR-002` — **false positive, characterized**. The production Worker binding is a native D1 binding with `prepare`; a new prepare-only production-shaped fixture proved `updateWorkspaceNodeTargetInD1` reads, updates, and resolves heartbeat state without `dumpHostnameRow`. No production adapter change was required. Characterization passed in the red investigation (`trc_44ff35c4d0d4`) and the current 32/32 gateway contract lane (`trc_a5d22034aaf8`).
- `CR-003` — **valid, fixed**. Red coverage showed OAuth discovery returned 503 with a stale default (`trc_35ce4595577b`). Added an explicit `requireOnlineNode: false` resolution mode used only by the two OAuth metadata paths; normal MCP routing still returns `WORKSPACE_NODE_OFFLINE`. The routing suite now passes 10/10.

## Review-fix validation

- Heartbeat client + routing red: missing heartbeat module and offline OAuth metadata (`trc_35ce4595577b`).
- Production-shaped D1 characterization and install materialization red investigation (`trc_44ff35c4d0d4`).
- Heartbeat client 2/2, routing 10/10, targeted D1 1/1, and targeted heartbeat plist 1/1 passed (`trc_2c8cb8196f44`).
- Generated heartbeat LaunchAgent install/uninstall red: 3/3 failed before lifecycle discovery (`trc_897a60b7a25b`); green: 3/3 passed (`trc_4651357ef79f`).
- Shell syntax, OS syntax/typecheck, authority/installer 65 passing with 10 opt-in skips, and gateway 32/32 passed (`trc_a5d22034aaf8`).
- The heartbeat-specific opt-in install test passed. Running the entire opt-in install contract also exposed three unrelated existing failures: a missing office artifact fixture, a stale source-order expectation for platform provisioning, and a pre-existing device-login/message ordering assertion (`trc_5cd3cf9a4626`). These do not touch the Worker 25 heartbeat path and remain outside this worker's ownership.
- Post-fix strict workspace review passed with zero findings (`trc_53f00dc32ede`).
- Post-fix full verify passed review and DB-risk gates and marked the task publish-valid (`trc_c496fe07bad1`).
- Complete bounded OS suite passed: 273 files passed, 10 skipped; 1,555 tests passed, 62 skipped, 11 todo (`bun --cwd packages/os vitest run --pool=threads --maxWorkers=4`).
- The complete suite again generated unrelated facade snapshot drift; restored that snapshot exactly from local `main` (`trc_b9239ae9fbcb`).

- 2026-07-23 03:47:48 write: `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`

- 2026-07-23 03:47:57 apply-patch: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`

## final PR state

- Published review-fix head: `3f5bb419ee99afe1adf44098bf993e406f9438a1` (`trc_631b261051e9`).
- Grok dispositions: CR-001 valid/fixed (`trc_785ffad8f39c`), CR-002 false positive/proved (`trc_bedf3ff4d985`), CR-003 valid/fixed (`trc_aa96323fa35e`).
- GitHub CI after the final commit: 47 checks, 0 failed, 4 still running after two bounded waits (`trc_3e212acccfc5`). All completed checks are green or intentionally skipped; no failed route requires recovery.
- `--changed` publication could not pass its local-ref sync guard because API publication leaves the OS worktree ref unchanged. Recovery used the canonical task-push explicit-file path against the remote task head; no force push or native-git bypass was used (`trc_631b261051e9`).
