
## Hotfix contract

- Incident: Wave 0 moved generated manifests while the live Bun daemon retained old module paths; /health stayed green while authenticated /mcp calls returned 500/502.
- Incident: remote MCP get_steering calls share one daemon process key, so concurrent worker chats rate-limit each other.
- TDD: first prove remote MCP bootstrap does not share the process loop guard; prove reload/start uses an installed plist even when unloaded and exits non-zero on lifecycle/health failure; prove health detects unreadable canonical manifests.
- Scope: packages/os MCP steering service/route, lifecycle helper, health readiness, and focused tests only.
- Preserve: direct CLI/stdio loop guard, OAuth/signed request behavior, tool facade, and immutable generated manifest paths.

- 2026-07-23 03:03:21 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-23 03:03:21 apply-patch: `packages/os/tests/health-readiness.test.ts`
- 2026-07-23 03:03:21 apply-patch: `packages/os/tests/consuelo-reload.test.ts`
- 2026-07-23 03:04:45 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-23 03:04:45 apply-patch: `packages/os/tests/health-readiness.test.ts`
- 2026-07-23 03:04:45 apply-patch: `packages/os/tests/consuelo-reload.test.ts`
- 2026-07-23 03:12:09 apply-patch: `packages/os/tests/consuelo-reload.test.ts`
- 2026-07-23 03:12:09 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-23 03:12:40 apply-patch: `packages/os/scripts/server/services/mcp-session.ts`
- 2026-07-23 03:12:40 apply-patch: `packages/os/scripts/server/services/steering-service.ts`
- 2026-07-23 03:13:10 apply-patch: `packages/os/scripts/server/routes/mcp.ts`
- 2026-07-23 03:13:35 apply-patch: `packages/os/scripts/server/routes/health.ts`
- 2026-07-23 03:14:04 apply-patch: `packages/os/scripts/consuelo-reload.js`
- 2026-07-23 03:14:29 apply-patch: `packages/os/scripts/consuelo-reload.js`
- 2026-07-23 03:16:12 apply-patch: `packages/os/tests/mcp-gateway.test.ts`

## Root cause and implementation

- The service outage was a stale-runtime failure: generated manifest paths moved on disk while the long-lived Bun daemon retained imports from the previous release. The health route did not read those manifests, so it incorrectly stayed green while authenticated MCP calls failed.
- One daemon PID is intentional and still serves concurrent requests. The isolation bug was using that shared PID as the remote steering guard identity.
- Authenticated MCP initialization now issues an opaque session ID bound to a digest of the authenticated principal. Steering guard state is scoped to that issued session.
- Unknown, expired, or caller-invented session IDs fall back to the authenticated credential bucket, so rotating headers cannot bypass the existing soft, hard, or cooldown thresholds.
- CLI and local stdio behavior retain the existing process-scoped guard.
- Health readiness now loads the canonical full and core manifests and returns a sanitized 503 when runtime assets are unavailable.
- The reload helper now bootstraps an installed-but-unloaded LaunchAgent, treats bootstrap/kickstart failures as fatal, and fails when the replacement server never becomes healthy.

## Validation

- Red phase: focused tests failed on shared MCP caller identity, false-green health, unloaded LaunchAgent startup, and swallowed launchctl failures.
- Green phase: `bun run typecheck` passed.
- Green phase: 23/23 tests passed across `os-get-steering-trace`, `mcp-gateway`, `health-readiness`, and `consuelo-reload`.
- `git diff --check` passed.
- The package-wide test command currently has unrelated baseline failures across browser parity, trace-site fixtures, facade dry-run, and inventory suites. Its generated facade snapshot change was reverted; no baseline snapshots are included in this hotfix.

- 2026-07-23 03:21:45 apply-patch: `.task/os-distribution/hotfix-os-steering-isolation-and-reload-lifecycle/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 03:23:47 `review.run`: passed — OK
- 2026-07-23 03:23:54 `verify`: passed — OK
