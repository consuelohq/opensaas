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
- [ ] Complete CodeRabbit, Grok 4.5, GitHub posting/dispositions, and final clean validation.
- [ ] Stop at the real-Mac human checkpoint with the exact MacBook Air command and expected two-node result.

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

## notes for Ko / real-Mac checkpoint

- No lifecycle command has been run on the Mac Mini or MacBook Air.
- The final response will quote the exact normal MacBook Air acceptance command from the Worker 25 brief and its expected two-node result. It will not execute that command.

## publish checklist

- [x] Focused red tests recorded.
- [x] Focused green tests recorded.
- [x] Broader gateway/auth/routing and full package validation recorded.
- [x] Diff self-review removed an unrelated generated snapshot.
- [x] Workspace review passes.
- [x] Verify passes.
- [ ] Task branch pushed and PR #1581 ready against `stream/os-web`.
- [ ] CodeRabbit requested and findings dispositioned.
- [ ] Grok 4.5 structured review, inline findings, top-level summary, and dispositions posted to GitHub.
- [ ] Temporary `packages/os/.tmp-reviews/multi-node-registry-presence-and-routing/` removed.
- [ ] Final validation after review fixes passes.
- [ ] Ko checkpoint command and expected result recorded.

- 2026-07-23 03:12:51 write: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 03:12:51 fs.write: `.task/os-web/multi-node-registry-presence-and-routing/workpad.md`

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

## workspace-owned: files read

- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/scripts/task-push.js`
