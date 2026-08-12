# os replica correctness

branch: `task/os/os-replica-correctness`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1836/os-replica-correctness
github pr: https://github.com/consuelohq/opensaas/pull/1836
started: 2026-08-11

## acceptance criteria

- [x] Independent OS processes on one node cannot lose concurrent settings or environment control-plane mutations.
- [x] Shared browser profile/session operations are serialized node-wide so two workers cannot interleave browser state transitions.
- [x] Trace persistence accepts concurrent writers from independent processes without dropped rows or lock failures.
- [x] The same `taskSession` resolves to the same task/worktree from independent processes on one node.
- [x] Branch 1-3 auth, replay, steering, dangerous-material, and modern stateless MCP behavior remain unchanged.
- [x] Process-local state is explicitly classified; correctness-critical state is not left behind a module-local Map/queue.
- [x] Legacy MCP compatibility remains usable without making modern MCP depend on legacy session state.

## plan

1. Inventory module-level mutable state and classify it as request-local, disposable cache, node-shared correctness state, or out-of-scope multi-node/edge state.
2. Add deterministic multi-process RED coverage for settings/environment lost updates and shared-browser interleaving; add multi-process proof for traces and taskSession resolution.
3. Introduce one reusable same-node resource lock following the existing lifecycle lock ownership/stale-recovery pattern, but with bounded waiting for ordinary concurrent requests.
4. Apply the lock narrowly to settings/environment read-modify-write transactions and shared browser profile operations.
5. Harden trace SQLite only if the multi-process test demonstrates contention; avoid speculative changes when existing SQLite behavior already passes.
6. Run focused green tests, existing Branch 1-3 security/MCP regressions, strict review, full verify, then publish only this branch.

## current status

- Implementation complete and publish-valid.
- Settings/environment read-modify-write paths now use a cross-process same-node resource lock rather than process-local mutation queues.
- OS and workspace facade browser tools share the same profile-path lock, including the legacy umbrella `browser` tool; a mixed OS/workspace multi-process test proves no profile-operation overlap.
- Trace SQLite and taskSession resolution required no production changes because their independent-process tests were already green.
- Strict review is clean (0 blocking findings) and full verify passed with `publishValid: true`.

## Test-first contract

Behavior under test:
- two independent processes mutating the same settings overlay preserve both mutations;
- two independent processes mutating the same environment registry preserve both records;
- two independent browser operations sharing one profile never enter the injected browser process concurrently;
- concurrent trace writers preserve every unique trace;
- independent processes resolve one `taskSession` to the same worktree.

Existing local patterns:
- same-process concurrency tests already exist in `settings-control-plane.test.ts` and `environment-control-plane.test.ts`;
- browser service supports injected `BrowserContext.process`, enabling deterministic collision detection without a real browser;
- lifecycle lock uses atomic `wx`, PID liveness, stale quarantine, and owner-safe release;
- Branch 2 runtime-state tests already use multi-process concurrency for SQLite correctness state.

New/changed tests:
- add a focused replica-correctness integration test plus small fixture worker(s) for independent Bun processes;
- extend browser service tests only where service-level lock behavior needs a local assertion;
- preserve existing tests rather than replacing same-process coverage.

Focused RED command:
- preflight the new test file for blocked destructive literals, then run `bun test tests/os-replica-correctness.test.ts` from `packages/os`.

Expected RED failure:
- settings/environment lose at least one concurrently applied mutation and/or browser collision marker is observed before the node-resource lock exists. Trace/taskSession subtests may already pass and will document that no production change is needed there.

## files changed

- `packages/os/scripts/lib/node-resource-lock.ts`
- `packages/workspace/scripts/lib/node-resource-lock.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/environment-control-plane.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/os/tests/fixtures/os-replica-correctness-worker.ts`
- `packages/os/tests/node-resource-lock.test.ts`
- `packages/os/tests/os-replica-correctness.test.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`

## workspace-owned: files changed

- `packages/os/scripts/lib/node-resource-lock.ts`
- `packages/os/tests/fixtures/os-replica-correctness-worker.ts`
- `packages/os/tests/node-resource-lock.test.ts`
- `packages/os/tests/os-replica-correctness.test.ts`
- `packages/workspace/scripts/lib/node-resource-lock.ts`

## workspace-owned: activity log

- 2026-08-11 20:58:26 fs.write: `.task/os/os-replica-correctness/workpad.md`
- 2026-08-11 20:59:49 fs.write: `packages/os/tests/fixtures/os-replica-correctness-worker.ts`
- 2026-08-11 21:00:25 fs.write: `packages/os/tests/os-replica-correctness.test.ts`
- 2026-08-11 21:02:17 fs.write: `packages/os/tests/os-replica-correctness.test.ts`
- 2026-08-11 21:03:34 fs.write: `.task/os/os-replica-correctness/workpad.md`
- 2026-08-11 21:04:24 fs.write: `packages/os/tests/node-resource-lock.test.ts`
- 2026-08-11 21:06:26 fs.write: `packages/os/scripts/lib/node-resource-lock.ts`
- 2026-08-11 21:06:52 fs.write: `packages/workspace/scripts/lib/node-resource-lock.ts`

## workspace-owned: validation evidence

- 2026-08-11 21:02:26 `checkFiles`: passed — OK
- 2026-08-11 21:07:12 `checkFiles`: passed — OK
- 2026-08-11 21:09:02 `checkFiles`: passed — OK
- 2026-08-11 21:11:14 `audit`: failed — COMMAND_FAILED
- 2026-08-11 21:13:39 `checkFiles`: passed — OK
- 2026-08-11 21:15:11 `review.run`: passed — OK
- 2026-08-11 21:15:12 `review.run`: passed — OK
- 2026-08-11 21:15:57 `review.run`: passed — OK
- 2026-08-11 21:16:07 `verify`: passed — OK

## key decisions

- Branch 4 is same-node multi-process correctness only. Worker supervision is Branch 5; Caddy balancing is Branch 6; multi-node resource ownership is Branch 8.
- Reuse the lifecycle lock's safety model, but do not reuse its fail-fast API because concurrent request mutations should wait and succeed.
- Do not make `batch` distributed and do not add `browserSession` here.
- Do not add shared storage for Branch 3's legacy MCP Map unless executable evidence shows a compatibility behavior depends on it; current route code does not.

## notes for ko

- The stateless transport is already doing what we wanted: most of this PR is exposing application state that had relied on single-process serialization.

## improvements noticed

- The Cloudflare-side device authorization helper retains device-code sessions in a module-local Map. That is outside this node-replica PR but should be audited against Cloudflare isolate/request behavior and likely moved to D1/Durable Object state if still production-active.

## issues and recovery

- Two large discovery fanouts hit transient MCP network errors; both were read-only. Recovery was to split them into smaller task-scoped batches, which succeeded.
- Initial workpad overwrite was rejected by task FS because the file already existed; retried with explicit `force` as required.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/browser/cli.ts`
- `packages/os/scripts/lib/browser/config.ts`
- `packages/os/scripts/lib/browser/errors.ts`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/scripts/lib/browser/service.ts`
- `packages/os/scripts/lib/browser/types.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/environment-control-plane.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/lock.ts`
- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/node-resource-lock.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/mcp-session.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/browser-service.test.ts`
- `packages/os/tests/environment-control-plane.test.ts`
- `packages/os/tests/fixtures/os-replica-correctness-worker.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-replica-correctness.test.ts`
- `packages/os/tests/safe-temp-cleanup.ts`
- `packages/os/tests/settings-control-plane.test.ts`
- `packages/workspace/scripts/lib/browser/service.ts`
- `packages/workspace/scripts/lib/consuelo-home.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/senior-engineer.md`

## RED evidence — 2026-08-11

Focused command: `cd packages/os && bun test tests/os-replica-correctness.test.ts`

Result: 2 passed, 3 failed.

- RED settings: two independent workers captured the same starting overlay; final file retained only one disabled tool (`aiReview` in this run), proving cross-process lost update despite atomic rename.
- RED environment: two independent workers captured the same empty registry; final document retained only `Alpha`, proving the same lost-update race.
- RED browser: injected shared-profile workers overlapped and created `browser-collision`, proving high-level browser operations can interleave across OS processes.
- GREEN baseline trace: 4 independent processes × 40 writes retained all 160 rows in the shared trace DB; no production trace persistence change is justified for Branch 4.
- GREEN baseline taskSession: two independent processes resolved the same handle to equal task/worktree execution data; no production taskSession resolver change is justified for same-node workers.
- Trace fixture correction before final RED: the parent test inherited a live `CONSUELO_TRACE_DB`; worker writes were verified present in the intended temp DB. The lookup now passes `env: {}` so the test observes its isolated home rather than the live explicit override.

- 2026-08-11 21:03:34 append: `.task/os/os-replica-correctness/workpad.md`

- 2026-08-11 21:04:24 write: `packages/os/tests/node-resource-lock.test.ts`

- 2026-08-11 21:06:26 write: `packages/os/scripts/lib/node-resource-lock.ts`

- 2026-08-11 21:06:52 write: `packages/workspace/scripts/lib/node-resource-lock.ts`

## Final validation — 2026-08-11

- RED: replica harness produced 2 pass / 3 fail before implementation: trace + taskSession green; settings/environment lost updates and browser overlap red.
- GREEN: `node-resource-lock.test.ts` + `os-replica-correctness.test.ts`: 10/10 pass, including malformed stale-lock recovery and mixed OS/workspace browser facade serialization.
- Existing settings/environment plus replica/lock suites: 17/17 pass.
- Branch 1-3 migration regression set: 99/100 pass. The one failure is pre-existing: `trace-persistence.test.ts` fail-open fixture calls retired `context`; both failing test/fixture are byte-identical to `origin/stream/os`, and Branch 4 executor diff affects only browser dispatch.
- Security/MCP/replay/steering/Hono tests within that set all passed.
- `checkFiles`: all changed TypeScript files pass.
- `packages/os` typecheck/syntax script passes. `packages/workspace` has no `typecheck` package script; its changed TS files pass `checkFiles` and strict review.
- OS/workspace node-resource-lock copies are byte-identical; `git diff --check` passes.
- Global workspace `audit` is pre-existing red (script-doc mismatch, stale docs/index). Targeted script-parity audit is also pre-existing stale by dozens of paths; Branch 4 added only the required `node-resource-lock.ts` parity classification.
- Strict `review.run --base origin/stream/os`: 0 blocking findings.
- Full `verify --base origin/stream/os`: passed, `publishValid: true`.

## Final scope classification

- Node-shared correctness fixed here: settings overlay RMW, environment registry RMW, implicit shared browser profile execution.
- Already replica-safe on one node: taskSession filesystem/worktree resolution, trace SQLite writes, Branch 2 replay/steering state.
- Disposable/local compatibility state: Branch 3 legacy MCP session map does not control modern execution or steering identity.
- Deferred edge/multi-node state: Cloudflare device-authorization session Map and explicit task/browser owner-node routing remain outside Branch 4.
