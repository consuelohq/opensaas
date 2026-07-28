# unify node heartbeat agent presence

branch: `task/os/unify-node-heartbeat-agent-presence`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1709/unify-node-heartbeat-agent-presence
github pr: https://github.com/consuelohq/opensaas/pull/1709
started: 2026-07-28

## acceptance criteria

- [x] The existing signed node heartbeat reports a sorted, deduplicated allowlist of currently verified local agents without sending paths, configuration contents, credentials, or signing material.
- [x] Device authority stores the reported agents on the authenticated workspace node and rejects unknown identifiers, replayed requests, invalid signatures, revoked nodes, and cross-workspace identity mismatches.
- [x] The public workspace-agent read model is derived from node records and TTL presence, returning explicit online, stale, offline, or never-reported state while retaining the legacy bootstrap write as a compatibility path.
- [x] The launcher starts in a neutral checking state, renders the returned presence state accurately, and reports unavailable on request or payload failure instead of replacing local state with zero.
- [x] The native lifecycle contract safely projects per-node agents without creating another heartbeat, remains backward compatible with snapshots that omit the field, and renders a compact agent summary.
- [x] Installer/runtime packaging keeps the existing user-level 30-second heartbeat LaunchAgent and supplies enough private local context to re-inspect verified agents on every run.
- [x] Focused TypeScript, device-authority, installer, launcher, and Swift contract tests pass; strict review and task verification pass.

## plan

1. Add failing contracts for signed agent payloads, node persistence and TTL aggregation, launcher states, installer heartbeat context, and native lifecycle decoding/presentation.
2. Introduce one shared canonical workspace-agent allowlist and node-backed aggregate projection.
3. Extend heartbeat generation and execution to inspect verified local agents fresh on every one-shot launchd run.
4. Persist agents on workspace nodes and add a workspace-host node index while preserving the bootstrap status store as a compatibility fallback.
5. Project safe agents through the lifecycle endpoint and optional Swift model, then update launcher state rendering.
6. Run focused validation, syntax/type checks, Swift contracts, strict review, full task verification, publish, and merge to stream.

## Test-first contract

### Behavior under test

- A heartbeat signs the exact canonical payload including only sorted, unique known verified-agent identifiers; the private signing key and local OS path never appear in the request or result.
- A valid signed heartbeat atomically updates node liveness, capabilities, connector status, and agent set. Missing agents from an older client preserve prior state; an explicit empty array clears it; malformed or unknown agents fail closed.
- Public agent status prefers node-backed reports, uses the node TTL to select online then stale then offline reports, distinguishes no report from an empty report, and uses legacy bootstrap records only for nodes that have not yet reported through heartbeat.
- A bootstrap-token write remains accepted, is workspace/node bound, and seeds the matching node agent set without fabricating a heartbeat timestamp.
- Launcher HTML has no embedded connected count as initial truth, visibly enters checking, and deterministically renders online, stale, offline, never-reported, and unavailable states using DOM text APIs.
- Installer output keeps heartbeat config private and records the canonical OS home only in the private config, never in the signed public payload.
- Native TypeScript and Swift models accept the new safe agent array, reject malformed/secret-bearing authority payloads, preserve old snapshots that omit agents, and display agents without owning liveness.

### Existing patterns

- Signed node identity, nonce replay protection, and TTL presence in `workspace-node-heartbeat-client.ts`, `workspace-nodes.ts`, and `services/nodes.ts`.
- Canonical local detection and verified fingerprints in `local-agent-connectivity.ts`.
- Legacy bootstrap compatibility and redacted public output in `workspace-agents.ts`.
- Static launcher hydration in `launcher-onboarding.ts`.
- Safe lifecycle normalization and optional presentation defaults in the native TypeScript/Swift contract.

### Focused red command

`bun --cwd packages/os test tests/workspace-node-heartbeat-client.test.ts tests/workspace-node-registry-routing.test.ts tests/os-device-agent-status.test.ts tests/launcher-onboarding.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/native-lifecycle-client.test.ts`

Then run the Swift executable contract separately with the package command discovered from `Package.swift`.

### Expected red failure

The current heartbeat omits agents, workspace nodes have no agent field or host index, the public read ignores node TTL, launcher HTML embeds a static count and swallows fetch failures, installer config omits OS home, and native models cannot decode or render agents.

## current status

- Production implementation and focused contracts are complete.
- The existing node heartbeat now owns agent presence; no new scheduler or Swift publisher was added.
- Focused TypeScript, device-authority, installer, launcher, lifecycle, and Swift contracts are green.
- Strict workspace review and full publish verification passed; the branch is ready to publish and merge into `stream/os`.

## files changed

- Device authority: node types/store/indexing, heartbeat route, agent compatibility route, shared agent projection service, architecture tests.
- Runtime: heartbeat client/entrypoint, installer heartbeat config, launcher hydration, native lifecycle projection.
- Native macOS: optional node agent model plus presentation/menu rendering and contract fixtures.
- Documentation: daemon behavior and node-registry architecture.
- Tests: signed payloads, fresh one-shot detection, TTL aggregation, compatibility writes, launcher states, installer config, lifecycle decoding.

## workspace-owned: files changed

- All task changes are confined to `.task/os/unify-node-heartbeat-agent-presence/**`, `.task/tasks/os/unify-node-heartbeat-agent-presence.json`, and `packages/os/**`.
- No live installation, LaunchAgent, credentials, or user-owned Consuelo state was modified.

## workspace-owned: activity log

- Started task session `tsk_5ff8b3c17fab` from `main` on `task/os/unify-node-heartbeat-agent-presence`.
- Added behavioral contracts first, observed expected red failures, then implemented the shared node-backed model.
- Removed Swift build artifacts produced inside the isolated task worktree after contract execution.

## workspace-owned: validation evidence

- Red: initial focused suite failed 7 assertions because heartbeat agents, node persistence/indexing, TTL state, neutral launcher state, installer home context, and native agent projection did not exist.
- Focused green: 6 files, 39 tests passed for heartbeat script/client, node registry, agent status, launcher, and native lifecycle client.
- Integration green: 4 files, 75 tests passed for device-authority architecture/worker, native lifecycle endpoint, and installer runtime dependencies.
- Installer heartbeat contract: targeted environment-gated test passed; 1 passed and 9 unrelated tests skipped by name filter.
- Syntax: `node packages/os/scripts/check-syntax.js` passed.
- Swift: `swift run --package-path packages/os/native/macos ConsueloMacContractTests` passed.
- Diff hygiene: `git diff --check` passed.
- Strict workspace review passed against `origin/stream/os` with static rules, ESLint, typecheck, and spec compliance: 0 task-owned issues, 0 blocking issues, 0 must-fix findings (trace `trc_35dd69bbc3c1`).
- Full workspace verify passed with `publishValid: true`; review, package-test registry selection, and database guards passed, and `.task/os/unify-node-heartbeat-agent-presence/verify.json` was written (trace `trc_97b86603824c`).
- Known baseline drift: the full environment-gated installer contract has three pre-existing unrelated failures, and the device-authority release contract has one pre-existing stale secret-list expectation on unchanged `origin/main` files. These are not task-owned regressions.
- 2026-07-28 05:36:11 `review.run`: passed — OK
- 2026-07-28 05:37:18 `verify`: passed — OK
- 2026-07-28 05:37:53 `verify`: passed — OK

## key decisions

- Preserve one liveness authority: the signed node heartbeat and its existing TTL.
- Treat the bootstrap-token agent write as backward compatibility only; it seeds the matching node without changing `lastSeenAt`.
- Prefer online reports, then stale, then offline, so an offline node cannot override a currently online node.
- Omitted `agents` preserves old-client state; an explicit empty array clears the node report.
- Keep `osHome` only in the private 0600 heartbeat config. The normalized/signed request drops it.
- Make Swift agent fields optional so older lifecycle snapshots remain decodable.

## notes for ko

- This machine's installed OS still predates the generated `com.consuelo.os.node-heartbeat.<node-id>` LaunchAgent. Shipping this code does not mutate the live installation; an approved update/daemon regeneration is required afterward for real status to begin reporting.

## improvements noticed

- The OS facade was unavailable (`Session terminated`), so the approved workspace fallback was used for all repository operations.
- The first Swift run exceeded the code-call window while warming the build cache; the cached rerun passed. Build artifacts were removed from the task worktree.
- A combined broad test exposed unrelated baseline drift. Task-owned architecture expectations were updated for the new `wnh:` host index; unrelated failures were isolated and documented rather than silently changed.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/AGENTS.md`
- `packages/os/SCRIPTS.md`
- `packages/workspace/senior-engineer.md`

## Discovery and approved architecture

- Approval: reuse the existing signed node heartbeat, node TTL presence, local agent detector, launcher aggregate, and native lifecycle projection.
- Primary change: include the bounded canonical verified-agent set in the signed heartbeat and persist it on the node record.
- Read model: derive `/workspace/agents` from node records and presence, retaining the bootstrap write only as a compatibility path.
- UI behavior: launcher starts in `checking`, then renders online/stale/offline/never-reported/unavailable without replacing errors with zero.
- Native behavior: Swift remains a consumer; no second heartbeat or scheduler.
- Discovery probes: semantic explore, recent implementation context, source ownership, test contracts, and current task-branch state.

## workspace-owned: test selection

- changed files: `.task/os/unify-node-heartbeat-agent-presence/current.json`, `.task/os/unify-node-heartbeat-agent-presence/evidence-log.json`, `.task/os/unify-node-heartbeat-agent-presence/read-log.json`, `.task/os/unify-node-heartbeat-agent-presence/session.json`, `.task/os/unify-node-heartbeat-agent-presence/verify.json`, `.task/os/unify-node-heartbeat-agent-presence/workpad.md`, `.task/tasks/os/unify-node-heartbeat-agent-presence.json`, `packages/os/SCRIPTS.md`, `packages/os/cloudflare/os-device-authority/src/routes/workspace-agents.ts`, `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`, `packages/os/cloudflare/os-device-authority/src/services/agents.ts`, `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`, `packages/os/cloudflare/os-device-authority/src/stores.ts`, `packages/os/cloudflare/os-device-authority/src/types.ts`, `packages/os/docs/architecture/workspace-node-registry.md`, `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`, `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`, `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`, `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/native-lifecycle-client.ts`, `packages/os/scripts/lib/native-lifecycle-endpoint.ts`, `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`, `packages/os/scripts/workspace-node-heartbeat.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/native-lifecycle-client.test.ts`, `packages/os/tests/os-device-agent-status.test.ts`, `packages/os/tests/os-device-authority-architecture.test.ts`, `packages/os/tests/workspace-node-heartbeat-client.test.ts`, `packages/os/tests/workspace-node-heartbeat-script.test.ts`, `packages/os/tests/workspace-node-registry-routing.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
