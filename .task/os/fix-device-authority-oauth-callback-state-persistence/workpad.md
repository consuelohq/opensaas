# Fix Device Authority OAuth callback state persistence

branch: `task/os/fix-device-authority-oauth-callback-state-persistence`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1979/fix-device-authority-oauth-callback-state-persistence
github pr: https://github.com/consuelohq/opensaas/pull/1979
started: 2026-08-15

## acceptance criteria

- [x] Prove whether MCP/web Google approval state survives separate production requests and separate handler/store instances.
- [x] Prevent a valid MCP or web OAuth state from falling through to the device-authorization error page when Google returns an OAuth error instead of `code`.
- [x] Preserve canonical-account routing from PR #1976.
- [x] Keep device approval behavior separate and retain fail-closed auth behavior.
- [x] Add regression coverage for the shared Google callback dispatcher and run the focused OS auth suite.

## plan

1. Reproduce the reported message with a valid durable state and identify the actual callback branch.
2. Add a cross-instance DurableStore regression that starts OAuth in one handler and processes the Google callback in another handler sharing durable backing storage.
3. Make callback dispatch state-driven rather than `code`-driven; map Google provider errors inside the matched flow.
4. Run focused auth tests, review, verify, then publish through the task workflow.

## Test-first contract

behavior under test: a valid MCP/web OAuth state remains identifiable across handler instances and a Google error callback is handled by that OAuth flow rather than falling through to device authorization.
existing local pattern: `os-device-authority-worker.test.ts` exercises `/oauth/authorize` -> `/login/google/callback`; DurableStore tests use a shared `StorageLike` Map backing.
new or changed tests: cross-instance MCP and web callback tests use separate handlers and separate `DurableStore` instances over the same backing storage.
focused red command: `bunx vitest run packages/os/tests/os-device-authority-worker.test.ts -t "durable Google callback"`
observed red failure: MCP returned 400 instead of 302 OAuth error redirect; web returned `text/html` device fallback instead of `application/json`.
observed green result: 2/2 focused callback-boundary tests passed after the routing change.
no-test waiver: not applicable.

## current status

- Root cause is callback dispatch ambiguity, not state persistence.
- Production MCP and web state persistence both succeed across separate HTTPS requests.
- Exact reported message was reproduced with a valid stored MCP state when Google callback contains `error=access_denied` and no `code`; the same state was immediately reusable, proving state was not lost.
- Shared Google callback now identifies MCP/web/device flow by persisted state before evaluating whether Google returned a success code.
- MCP provider errors are returned to the validated OAuth client redirect with the original client `state`; web errors remain in web login; device errors render a device-specific restart message.
- Task-scoped full safety gate passes against the actual merge base `stream/os` and produced a publish-valid verify stamp.

## files changed

- `.task/os/fix-device-authority-oauth-callback-state-persistence/workpad.md`
- `.task/tasks/os/fix-device-authority-oauth-callback-state-persistence.json`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- `.task/os/fix-device-authority-oauth-callback-state-persistence/workpad.md`
- `.task/tasks/os/fix-device-authority-oauth-callback-state-persistence.json`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: activity log

- 2026-08-15 01:27:48 fs.write: `.task/os/fix-device-authority-oauth-callback-state-persistence/workpad.md`
- 2026-08-15: added failing cross-handler DurableStore regressions before production edits.
- 2026-08-15: implemented state-driven callback dispatch and OAuth provider-error handling.
- 2026-08-15: removed an incidental facade snapshot mutation created by an over-broad validation run.
- 2026-08-15: reproduced production MCP and web state retrieval across separate HTTPS requests.
- 2026-08-15: reproduced exact reported device-error text with a valid MCP state and Google `error=access_denied` callback.
- 2026-08-15: started task #1979 from the OS stream workflow.

## workspace-owned: validation evidence

- Production MCP probe: authorize 302 -> valid `mcp_oauth_state_*`; fake-code callback reached Google token exchange (502 `invalid_grant`), proving state retrieval.
- Production web probe: start 302 -> valid `web_state_*`; fake-code callback returned `invalid_login`, proving state retrieval.
- Production error probe: valid MCP state + `error=access_denied` reproduced exact `Google approval session was not found.` page; same state + fake code then reached token exchange.
- TDD red: focused `durable Google callback` tests failed 2/2 for the expected device-fallback misrouting.
- TDD green: focused `durable Google callback` tests passed 2/2.
- `packages/os/tests/os-device-authority-worker.test.ts`: 31/31 passed.
- Prior #1976 OS auth/control-plane regression surface: 66/66 passed across 7 test files.
- `packages/workspace/tests/test-selection.test.js`: 32/32 passed.
- `bun run --cwd packages/os typecheck`: passed (`workspace script syntax checks passed`).
- `review.run --base stream/os --strict --mine --no-tests`: zero blocking issues attributable to the task.
- `verify --base stream/os`: passed; `publishValid=true`; verify stamp written.
- 2026-08-15 01:28:01 `verify`: passed — OK

## key decisions

- Do not replace DurableStore or move OAuth state to D1/KV: production already uses one named Durable Object (`DEVICE_GRANTS.idFromName('global')`) and persisted state is demonstrably retrievable.
- Treat persisted state type as the callback flow discriminator. Google success/error fields are interpreted only after the flow is identified.
- Do not echo arbitrary Google `error_description` content to the OAuth client; return bounded Consuelo-owned descriptions.
- Preserve PR #1976 canonical-account resolution unchanged.

## notes for ko

- The handoff inference that `byMcpOAuthState()` returned undefined was disproven by production evidence. The same user-visible page could occur while the MCP state still existed.
- The earlier full `verify --base main` runs were invalid for this task because #1979 targets `stream/os`; they pulled unrelated stream changes into test selection and triggered pre-existing broad facade failures. The correct task-scoped gate against `stream/os` passes.
- Historical Cloudflare log retrieval through the deployment facade returned `MALFORMED_OUTPUT`; no claim is based on unavailable historical logs.

## improvements noticed

- Shared callback routes should always identify the owning state machine before interpreting provider success/error parameters.
- The compact verify summary can obscure a failing `testSelection` section; direct test-selection output was needed to diagnose the wrong-base run.

## issues and recovery

- Initial `task.start` omitted required title; retried with title successfully.
- First `code.run` used a 300ms outer timeout by mistake; retried with 300000ms successfully.
- Parallel `explore` was noisy/slow; narrowed investigation with exact known-file reads and runtime probes.
- Container runtime could not enter the host task worktree, so repository execution used the authenticated Consuelo workspace facade.
- Cloudflare `deployment.logs` / `deployment.list` historical retrieval returned `MALFORMED_OUTPUT`; continued with deterministic live HTTPS probes.
- Full verify against `main` selected unrelated `stream/os` work and broad package tests; reran against the task's actual merge base `stream/os`, which passed.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): route Google OAuth callback errors by stored state" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 01:27:48 write: `.task/os/fix-device-authority-oauth-callback-state-persistence/workpad.md`
