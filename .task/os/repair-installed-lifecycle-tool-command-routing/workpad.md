# repair installed lifecycle tool command routing

branch: `task/os/repair-installed-lifecycle-tool-command-routing`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1964/repair-installed-lifecycle-tool-command-routing
github pr: https://github.com/consuelohq/opensaas/pull/1964
started: 2026-08-14

## acceptance criteria

- [x] `lifecycle.status` and `lifecycle.update` execute the canonical package-local `packages/os` lifecycle script when the facade controller cwd is the monorepo root.
- [x] The same manifest remains valid in an installed runtime, where the runtime package root itself owns the `lifecycle` script; no root-level alias and no second updater are introduced.
- [x] `lifecycle.update` continues to delegate to the existing signed lifecycle CLI / detached update handoff and preserves channel validation and dry-run behavior.
- [x] Generated tool manifest baseline stays consistent and `tools.search` continues to discover the lifecycle tools.
- [x] Focused lifecycle/facade tests, strict review, and full verify pass before promotion; release scope remains canary only.

## plan

1. Reproduce the live `Script not found "lifecycle"` failure and pin the package-root routing contract in `lifecycle-facade.test.ts`.
2. Mark lifecycle tool handlers with the existing `executionScope: "runtime"` contract already used by runtime-owned `tools.search`; do not add another updater or root package alias.
3. Regenerate/check tool manifest surfaces if required, then run focused lifecycle + facade + tool-package contracts.
4. Review/verify, merge through `stream/os`, publish/promote only to canary, and validate the tool against the canary dogfood install.

## current status

- Live reproduction is deterministic: `tools.search` discovers `lifecycle.status` / `lifecycle.update`, but `lifecycle.status` currently fails with `error: Script not found "lifecycle"`.
- Root cause: lifecycle handlers declare `script: "lifecycle"` without an execution scope. The facade therefore uses the controller cwd, whose monorepo-root `package.json` has no `lifecycle` script. `packages/os/package.json` does own the canonical script. The executor already supports `executionScope: "runtime"` and resolves that scope to the package root; `tools.search` already uses the same mechanism successfully.
- Runtime canary promotion is separately complete: signed canary is now 0.1.38 / release-set `sha256:2f05dc...`, and this Mac is switched to channel `canary`. Its installed darwin bundle already matches, so `consuelo update --check --channel canary` reports no update available.
- Minimal implementation is GREEN: both lifecycle handlers now use the existing `executionScope: "runtime"` command contract; the generated full tool manifest and characterized tool-package baseline were updated accordingly.
- Strict review against `origin/main` reports 0 issues / 0 blockers. Full verify is `publishValid: true`; DB guard has 0 risks/findings. Review noted only a non-blocking docs opportunity, but the public tool API/arguments/semantics did not change—this is an internal execution-location repair—so no public docs copy change is warranted.

## files changed

- `packages/os/tools/lifecycle/handler.ts`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/tests/lifecycle-facade.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 20:09:05 `review.run`: passed — OK
- 2026-08-14 20:09:22 `verify`: passed — OK

## key decisions

- Reuse the existing `executionScope: "runtime"` abstraction rather than special-casing lifecycle cwd or adding a monorepo root script alias.
- Keep `consuelo update` / `scripts/lifecycle.ts` as the only updater implementation; this task changes only where the facade launches that canonical script.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Home WiFi loss made the MCP facade return 502s until Ko ran `consuelo restart`; after restart, steering/status/tool calls recovered. Network-outage self-healing is a separate lifecycle/watchdog issue and is not being mixed into this focused tool-routing repair.

## Test-first contract

- Behavior under test: manifest-backed lifecycle facade commands run from the runtime package root, so a monorepo controller can invoke the package-local `lifecycle` script and an installed runtime continues using its own package root.
- Existing pattern: `ToolCommand.executionScope` already supports `runtime | workspace`; `buildCommandPlan` uses `runtimePackageRoot` for runtime-scoped commands, and `tools.search` is already marked `executionScope: "runtime"`.
- Focused test: extend `packages/os/tests/lifecycle-facade.test.ts` to assert both lifecycle status/update command plans use the OS runtime package root even when caller/controller cwd is elsewhere.
- Expected RED: current lifecycle handlers omit `executionScope`, so command-plan cwd remains `/tmp/not-a-repo` instead of `packages/os`.
- Negative coverage retained: invalid channels are rejected before execution; synthetic dry-run does not invoke the updater.

### RED evidence

- Ran `bun x vitest run packages/os/tests/lifecycle-facade.test.ts` after adding only the cwd assertions.
- Result: 2 failed / 2 passed. Both status and update planned `cwd: /tmp/not-a-repo` instead of the runtime package root, while invalid-channel and dry-run tests remained green. This exactly reproduces the live `Script not found "lifecycle"` failure mechanism.

### GREEN evidence

- Regenerated the canonical tool manifest with `bun run --cwd packages/os generate-tool-manifest`; only `packages/os/manifests/generated/tool.manifest.json` changed because lifecycle is not part of the 13-tool core/workflow bundles.
- Updated the characterized tool-package baseline for the two lifecycle definitions.
- Focused lifecycle/tool/platform regression run passed: 10 files / 144 tests, including lifecycle facade, lifecycle tool discovery, manifest/layout determinism, CLI routing, detached native operation, restart contract, lifecycle engine, Linux, and Windows platform contracts.
- Strict review: 0 task issues, 0 blockers.
- Full verify against `origin/main`: passed, `publishValid: true`, DB guard clean.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/tests/lifecycle-facade.test.ts`
- `packages/os/tools/lifecycle/handler.ts`
- `packages/os/tools/tool-discovery/handler.ts`

- 2026-08-14 20:05:21 apply-patch: `.task/os/repair-installed-lifecycle-tool-command-routing/workpad.md`
- 2026-08-14 20:05:30 apply-patch: `packages/os/tests/lifecycle-facade.test.ts`

- 2026-08-14 20:05:56 apply-patch: `.task/os/repair-installed-lifecycle-tool-command-routing/workpad.md`
- 2026-08-14 20:06:06 apply-patch: `packages/os/tools/lifecycle/handler.ts`

- 2026-08-14 20:08:42 apply-patch: `.task/os/repair-installed-lifecycle-tool-command-routing/workpad.md`

- 2026-08-14 20:09:36 apply-patch: `.task/os/repair-installed-lifecycle-tool-command-routing/workpad.md`