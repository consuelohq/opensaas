# fix stream security review comments

branch: `task/security/fix-stream-security-review-comments`
stream: `stream/security`
pr: https://github.com/consuelohq/opensaas/pull/1363
started: 2026-07-03

## acceptance criteria

- Verify each review finding against current `stream/security` code before editing.
- Fix only still-valid issues.
- Skip obsolete findings with a brief reason and evidence.
- Keep changes minimal and scoped to the commented files/tests.
- Validate with focused OS tests and workspace review/verify where applicable.

## current verification map

- `packages/os/scripts/bootstrap.sh`: still valid. New `OS_HOME=~/.consuelo` can miss existing `~/.consuelo/os` installs, and daemon helper paths still use `$OS_HOME` as the package root.
- `packages/os/scripts/lib/install-diagnostics.ts` line 43: still valid. Query redaction omits `cloudflare_tunnel_token` and `cloudflared_tunnel_token`; token regex can redact only the key-like prefix.
- `packages/os/scripts/lib/install-diagnostics.ts` line 44: still valid. `USER_PATH_PATTERN` only matches `/Users/<name>`.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`: still valid. Error lacks hostname/baseDomain values.
- `packages/os/scripts/lib/sites.ts`: still valid. Launcher reads and preserves any existing `chatgpt-mcp.json` URL instead of rewriting to the central constant.
- `packages/os/cloudflare/os-device-authority/src/index.ts`: still valid. `edgeSignature` lacks freshness headers and the shared upstream verifier still checks only method/path/workspace/surface.
- `packages/os/scripts/install-tty.test.ts`: still valid. Darwin PTY test runs whenever `process.platform === 'darwin'` without CI/container guard.
- `packages/os/tests/os-device-authority-worker.test.ts`: still valid for the central proxy test near line 356; it reads `tokenJson.access_token` before asserting token exchange success.

## test-first contract

Behavior under test:
- Bootstrap should resolve legacy `~/.consuelo/os` installs before initializing or using a fresh flattened home, while still defaulting fresh installs to `~/.consuelo`.
- Diagnostics redaction should mask Cloudflare tunnel tokens in key=value and query-param forms and scrub both macOS and Linux home paths.
- Existing ChatGPT MCP config with legacy URL should be migrated to `https://os.consuelohq.com/mcp`; sites launcher and install-state writer should share one URL constant.
- Internal edge signatures should include a freshness component carried in headers and verified by the edge router.
- Darwin PTY test should skip in known CI/container contexts while preserving normal Darwin assertions.
- OAuth token exchange tests should fail at the token response when exchange breaks.

Existing patterns to follow:
- `packages/os/tests/install-diagnostics.test.ts` for redaction tests.
- `packages/os/tests/install-state.test.ts` and `packages/os/tests/sites-cli.test.ts` for installed config and launcher behavior.
- `packages/os/tests/cloudflare-edge-router.test.ts` and `packages/os/tests/os-device-authority-worker.test.ts` for internal signature header behavior.
- `packages/os/scripts/install-tty.test.ts` for the PTY harness.

Focused red command:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/install-diagnostics.test.ts tests/install-state.test.ts tests/sites-cli.test.ts tests/cloudflare-provisioning-contract.test.ts tests/cloudflare-edge-router.test.ts tests/os-device-authority-worker.test.ts`
- `bun test scripts/install-tty.test.ts`

Expected red failure:
- New assertions should fail on current code for legacy bootstrap fallback, Cloudflare token/path redaction, MCP config migration, signature freshness headers, and CI-gated PTY behavior.

## validation evidence

Red-first evidence:
- Initial focused regression run failed 9 assertions across bootstrap legacy fallback, Linux path redaction, Cloudflare tunnel token redaction, stale ChatGPT MCP URL migration, managed MCP hostname error details, edge signature freshness headers, central MCP proxy freshness headers, and token exchange status assertion.

Green evidence:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/install-diagnostics.test.ts tests/install-state.test.ts tests/sites-cli.test.ts tests/cloudflare-provisioning-contract.test.ts tests/cloudflare-edge-router.test.ts tests/os-device-authority-worker.test.ts tests/bootstrap-source.test.ts tests/workspace-edge-sites-gateway-integration.test.ts` — 104 passed.
- `bun test scripts/install-tty.test.ts` — 9 passed.
- `bun run typecheck` from `packages/os` — passed (`workspace script syntax checks passed`).

## skip list

- None. Every submitted finding was still valid against current `stream/security` code and received a minimal fix.

- 2026-07-04 03:59:34 write: `.task/security/fix-stream-security-review-comments/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-04 03:59:34 fs.write: `.task/security/fix-stream-security-review-comments/workpad.md`

## workspace-owned: validation evidence

Red-first evidence:
- Initial focused regression run failed 9 assertions across bootstrap legacy fallback, Linux path redaction, Cloudflare tunnel token redaction, stale ChatGPT MCP URL migration, managed MCP hostname error details, edge signature freshness headers, central MCP proxy freshness headers, and token exchange status assertion.
Green evidence:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/install-diagnostics.test.ts tests/install-state.test.ts tests/sites-cli.test.ts tests/cloudflare-provisioning-contract.test.ts tests/cloudflare-edge-router.test.ts tests/os-device-authority-worker.test.ts tests/bootstrap-source.test.ts tests/workspace-edge-sites-gateway-integration.test.ts` — 104 passed.
- `bun test scripts/install-tty.test.ts` — 9 passed.
- `bun run typecheck` from `packages/os` — passed (`workspace script syntax checks passed`).
- 2026-07-04 04:11:32 `review.run`: passed — OK
- 2026-07-04 04:12:04 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-stream-security-review-comments/current.json`, `.task/security/fix-stream-security-review-comments/session.json`, `.task/security/fix-stream-security-review-comments/workpad.md`, `.task/tasks/security/fix-stream-security-review-comments.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-tty.test.ts`, `packages/os/scripts/lib/chatgpt-mcp-connection.ts`, `packages/os/scripts/lib/install-diagnostics.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/install-diagnostics.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
