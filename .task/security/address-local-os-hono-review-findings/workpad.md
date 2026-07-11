# address local OS Hono review findings

branch: `task/security/address-local-os-hono-review-findings`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1408/address-local-os-hono-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1408
started: 2026-07-11

## acceptance criteria

- [x] Validate configured local OS ports before Bun startup while preserving the unset default.
- [x] Keep HTTP error responses generic and client-safe while recording redacted structured diagnostics.
- [x] Log MCP tool execution failures without changing the existing MCP error response.
- [x] Bound OAuth introspection with a finite timeout and preserve the existing unavailable response.
- [x] Allow the lazy OS runtime import to retry after an initialization failure while caching success.
- [x] Apply the two still-valid type/import nitpicks without unrelated cleanup.
- [x] Preserve existing routes, status codes, error codes, auth behavior, MCP behavior, loopback binding, and port precedence.
- [ ] Run focused tests, typecheck, strict review, verify, promote to `stream/security`, and merge PR #1406 after CI is green.

## plan

1. Add focused regression tests for each behavior-changing finding and prove the expected red state.
2. Add a local structured server logger using the existing redaction utility.
3. Validate the port, sanitize client errors, add the introspection timeout, reset rejected runtime imports, and log MCP execution failures.
4. Apply the explicit call-input type and duplicate-import cleanup.
5. Run focused server/security tests, typecheck, strict review, and verify.
6. Push and promote the task into `stream/security`, wait for PR #1406 checks, merge it to `main`, and verify the production release.

## test-first contract

- Behavior under test: invalid configured ports fail before `Bun.serve`; internal parse/runtime details never reach clients; diagnostics are structured and redacted; OAuth fetches have a finite abort signal; failed runtime imports can retry; MCP execution exceptions are logged while preserving `OS_EXECUTION_FAILED`.
- Existing patterns: `local-os-server-hono-architecture.test.ts` covers the local server boundary, `mcp-gateway.test.ts` covers MCP responses, and `scripts/lib/redaction.ts` is the canonical secret-redaction utility.
- New test: `packages/os/tests/local-os-server-review-findings.test.ts`.
- Focused red command: `bun --cwd packages/os vitest run tests/local-os-server-review-findings.test.ts`.
- Expected red failures: invalid ports are currently returned as `NaN`/invalid numbers; errors expose `error.message` and do not log; OAuth fetch has no signal; the cached rejected import cannot retry; MCP execution failure has no diagnostic log.
- Safety: the focused test contains no destructive command literals and uses mocked fetch/import/runtime dependencies only.

## current status

- All seven findings were valid and are fixed. Focused tests, existing server/security contracts, typecheck, diff checks, and strict review are green. Verification and publication remain.

## files changed

- `packages/os/scripts/server/env.ts`
- `packages/os/scripts/server/logger.ts`
- `packages/os/scripts/server/middleware/errors.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/scripts/server/services/os-runtime.ts`
- `packages/os/tests/local-os-server-review-findings.test.ts`

## workspace-owned: files changed

- `packages/os/tests/local-os-server-review-findings.test.ts`

## workspace-owned: activity log

- 2026-07-11 04:30:24 fs.write: `packages/os/tests/local-os-server-review-findings.test.ts`

## workspace-owned: validation evidence

- 2026-07-11 04:32:45 `review.run`: passed — OK
- 2026-07-11 04:33:35 `verify`: passed — OK

## key decisions

- Reuse `scripts/lib/redaction.ts` in a dedicated local-server logger rather than the facade logger, whose schema is specific to workspace tool execution.
- Use a five-second OAuth introspection timeout: finite enough to prevent hung MCP requests while leaving normal same-region edge introspection ample time.
- Keep the client response contract fixed and generic; full diagnostics go only to redacted JSON stderr logs.
- Export a small runtime-loader factory solely to test rejection reset deterministically; the production export remains `loadOsRuntime`.

## notes for ko

- No findings were skipped: each comment matches the current code and can be fixed without changing the HTTP contract.

## validation evidence

- TDD red: 12 expected failures and one default-port control pass.
- New focused regression suite: 13 passed.
- Existing architecture, MCP, security, process, Bun-runtime, and install suites: 71 passed across 6 files.
- `bun run --cwd packages/os typecheck`: passed.
- `git diff --check`: passed.
- Strict review against `origin/stream/security`: 0 findings.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/redaction.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/scripts/server/middleware/errors.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/scripts/server/services/os-runtime.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/security-gateway.test.ts`

- 2026-07-11 04:33:20 apply-patch: `.task/security/address-local-os-hono-review-findings/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/address-local-os-hono-review-findings/current.json`, `.task/security/address-local-os-hono-review-findings/evidence-log.json`, `.task/security/address-local-os-hono-review-findings/read-log.json`, `.task/security/address-local-os-hono-review-findings/session.json`, `.task/security/address-local-os-hono-review-findings/workpad.md`, `.task/tasks/security/address-local-os-hono-review-findings.json`, `packages/os/scripts/server/env.ts`, `packages/os/scripts/server/logger.ts`, `packages/os/scripts/server/middleware/errors.ts`, `packages/os/scripts/server/routes/call.ts`, `packages/os/scripts/server/routes/mcp.ts`, `packages/os/scripts/server/services/oauth-introspection.ts`, `packages/os/scripts/server/services/os-runtime.ts`, `packages/os/tests/local-os-server-review-findings.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
