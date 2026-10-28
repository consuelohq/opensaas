# Preserve in-flight MCP requests during worker rolling reload

branch: `task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2102/preserve-in-flight-mcp-requests-during-worker-rolling-reload
github pr: https://github.com/consuelohq/opensaas/pull/2102
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

- 2026-08-16 02:42:29 fs.write: `.task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload/workpad.md`
- 2026-08-16 02:49:55 fs.write: `.task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload/workpad.md`
- 2026-08-16 02:54:57 fs.write: `.task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 02:50:55 `review.run`: passed — OK
- 2026-08-16 02:53:37 `review.run`: passed — OK
- 2026-08-16 02:53:58 `verify`: failed — COMMAND_FAILED
- 2026-08-16 02:54:24 `review.run`: passed — OK
- 2026-08-16 02:54:47 `verify`: passed — OK

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
behavior under test: rolling worker replacement must let active MCP responses finish before worker exit, keep one healthy peer available, and retain both activation and rollback error context.
existing local pattern: worker pool supervisor controls replacement; focused lifecycle and MCP tests cover the path.
new or changed tests: graceful active-request drain, sequential worker readiness, and dual-cause rollback diagnostics.
focused red command: `bun x vitest run packages/os/tests/worker-pool-lifecycle.test.ts packages/os/tests/mcp-gateway.test.ts packages/os/tests/lifecycle-engine.test.ts`
expected red failure: active response can be interrupted during worker replacement and rollback can hide the original activation cause.
no-test waiver: not applicable.

- 2026-08-16 02:42:29 append: `.task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload/workpad.md`

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/reference/configuration.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/scripts/server/worker-runtime-state.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-ingress-continuity.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/twenty-docs/user-guide/data-model/capabilities/fields.mdx`
- `packages/twenty-docs/user-guide/data-model/capabilities/objects.mdx`

## Live acceptance findings from 0.1.53
- Caddy and Cloudflared stayed on the same PIDs while the two OS workers rolled, so the ingress availability boundary from #2086 is working.
- The first request during worker replacement still received a 502; the same conversation recovered on its next retry after the roll settled.
- Caddy active health is `/ready`; POST requests are intentionally not blindly replayed after a connected upstream fails. The follow-up therefore uses a two-phase worker drain: mark `/ready` unavailable, wait for load-balancer propagation, then close the listener gracefully.
- The failed legacy activation also exposed mutable-helper-path drift: rollback changed `runtime/current` before the new controller invoked its helper, so it accidentally ran the old release's installer and masked the original activation error. Restart helpers are now pinned to an explicit immutable `runtimeRoot`, and error text preserves both activation and rollback failures.
- Recovery-capable service restarts now try rolling reload first and use destructive replacement only if rolling recovery itself fails.

## Validation so far
- Worker drain/readiness tests: 13/13.
- Immutable runtime-root targeted contract: green after red baseline.
- Double activation+rollback failure regression: green after implementation.
- Full affected lifecycle/MCP set: 223/223 before the rolling-first fallback addition; fallback contract then passed 17/17 lifecycle-restart tests.
- Syntax + test-selection integrity passed; selection registry regenerated and includes `server/main.ts`, `worker-runtime-state.ts`, and `health-readiness.test.ts` in the critical lifecycle rule.

- 2026-08-16 02:49:55 append: `.task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload/workpad.md`

## Final validation
- Critical lifecycle/MCP suite: 224/224 passed (`trc_f92765ca3093`).
- Documentation validation + foundation: 19/19 foundation tests passed (`trc_c572bd4ddd0a`).
- Syntax and selection registry: 39/39 selection tests passed.
- Final strict review: 0 task issues / 0 blockers (`trc_8dd9a8364ce9`).
- Formal verify: `publishValid=true` (`trc_3b7a7a16c29f`).
- A mechanical error-handling review finding in `server/main.ts` was fixed by ensuring lifecycle endpoint cleanup also happens on worker-drain failure before rethrowing.

- 2026-08-16 02:54:57 append: `.task/os/preserve-in-flight-mcp-requests-during-worker-rolling-reload/workpad.md`
