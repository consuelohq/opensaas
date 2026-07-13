# close prelaunch port cutover review findings

branch: `task/security/close-prelaunch-port-cutover-review-findings`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1417/close-prelaunch-port-cutover-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1417
started: 2026-07-11

## acceptance criteria

- [x] Reprovision an existing persisted legacy default port `8960` without an explicit override and migrate it to `46321`.
- [x] Regenerate config, Caddy, ChatGPT MCP local URL, and cloudflared launchd state for the migrated port.
- [x] Preserve an existing non-legacy custom port when no explicit override is supplied.
- [x] Preserve an explicit requested port over persisted/default values.
- [x] Update active public install and agent/MCP documentation to `46321` and cover those pages in the port contract.
- [x] Resolve request-derived loopback trace workspace hosts independently of port while preserving explicit workspace-host headers and non-loopback hosts.
- [x] Make default-port tests deterministic when CI already defines `CONSUELO_OS_PORT` or `PORT`.
- [x] Run focused OS port/server/MCP/security/Cloudflare suites, gated provisioning and device-auth contracts, OS typecheck, changed-shell syntax, workspace review, and repository verify.

## plan

1. Add failing two-pass migration, custom-port preservation, public-doc, trace-host, and deterministic-env contracts.
2. Implement the smallest install-state migration and dependent-state regeneration changes.
3. Replace the trace default-port literal with explicit-header-aware loopback detection.
4. Update only the active public documentation confirmed stale at PR head `f6a83905`.
5. Run focused and gated validation, strict review, and repository verify.
6. Push and promote through the security task workflow.

## current status

- Read-only audit completed against PR #1414 head `f6a83905869254c49c497d6d02ce684b99b5427c`.
- All four inline review comments were still valid; no stale findings were found.
- Implemented legacy-default migration, dependent state regeneration, public docs correction, deterministic env setup, and port-independent trace loopback resolution.
- CodeRabbit's proposed default-constant substitution was intentionally superseded because it would still break supported custom ports.
- Strict repository review and full repository verify are clean; the task is ready to publish.

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`
- `packages/os/tests/trace-gateway-workspace-host.test.ts`
- `packages/documentation/src/content/docs/os/getting-started/install.mdx`
- `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx`
- scoped task metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Verified Codex legacy-port migration finding: valid.
- Verified Codex public documentation finding: valid.
- Verified CodeRabbit trace custom-port finding: valid; suggested implementation incomplete.
- Verified CodeRabbit environment cleanup finding: valid.

## workspace-owned: validation evidence

- 2026-07-11 17:31:33 `review.run`: passed — OK
- 2026-07-11 17:32:15 `verify`: passed — OK
- 2026-07-11 17:32:33 `verify`: passed — OK

## key decisions

- Follow-up task starts from `stream/security` so it tests the exact PR #1414 payload.
- Legacy migration applies only when persisted port is `8960` and no explicit `ProvisionOptions.port` is supplied.
- Non-legacy custom ports remain authoritative.
- Trace host substitution keys off request-derived loopback identity, not a particular port number.

## notes for ko

- No findings were stale at the audited PR head.

## improvements noticed

- The ChatGPT MCP materializer currently preserves a stale `localUrl` when the public URL is unchanged; migration coverage must force this dependent state to update.

## issues and recovery

- Local Vitest cannot import `bun:sqlite` from its Node worker in one existing Trace Sites test; verified unrelated and unchanged.
- One existing installer-bootstrap test compares source-string positions across function definitions and fails despite runtime ordering; verified unrelated and unchanged.
- Astro build in the temporary task worktree resolves symlinked dependencies through the main checkout and fails virtual-module metadata lookup; documentation validation itself passed.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): close port cutover review findings" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/security/close-prelaunch-port-cutover-review-findings/current.json`, `.task/security/close-prelaunch-port-cutover-review-findings/session.json`, `.task/security/close-prelaunch-port-cutover-review-findings/verify.json`, `.task/security/close-prelaunch-port-cutover-review-findings/workpad.md`, `.task/tasks/security/close-prelaunch-port-cutover-review-findings.json`, `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx`, `packages/documentation/src/content/docs/os/getting-started/install.mdx`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/server/services/trace-gateway.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/trace-gateway-workspace-host.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
