# fix ChatGPT CIMD OAuth reconnect on Cloudflare

branch: `task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1974/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare
github pr: https://github.com/consuelohq/opensaas/pull/1974
started: 2026-08-14

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

- 2026-08-14 22:29:20 fs.write: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`
- 2026-08-14 22:30:52 fs.write: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`
- 2026-08-14 22:33:32 fs.write: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`
- 2026-08-14 22:35:15 fs.write: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`
- 2026-08-14 22:39:11 fs.write: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`

## workspace-owned: validation evidence

- 2026-08-14 22:39:42 `review.run`: passed — OK
- 2026-08-14 22:40:08 `verify`: passed — OK

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

behavior under test: ChatGPT URL-form Client ID Metadata Document authorization must succeed without a Cloudflare Worker subrequest when the trusted chatgpt.com client-id path is cryptographically-equivalent-by-structure to the requested ChatGPT redirect, while cross-callback substitution, untrusted origins, malformed paths, missing PKCE, and operator-client separation remain rejected.
existing local pattern: `os-device-authority-worker.test.ts` exercises the real Hono `/oauth/authorize` flow with deterministic Google/ChatGPT fetch fakes; `utils.ts` centralizes ChatGPT client-id and redirect validation; `mcp-oauth.ts` owns authorization-state creation.
new or changed tests: add positive URL-form ChatGPT client-id/redirect structural binding that must not call external CIMD fetch; add negative mismatched callback-id binding; preserve existing metadata mismatch rejection semantics for malformed/untrusted client ids through local structural validation.
focused red command: `bun x vitest run packages/os/tests/os-device-authority-worker.test.ts -t "Client ID Metadata|URL-form ChatGPT"` after destructive-literal preflight.
expected red failure: current authorization path always fetches URL-form ChatGPT CIMD; a fetch fake that rejects/403s causes `invalid_client` even when client-id and redirect share the same trusted ChatGPT callback id.
no-test waiver: none; this is an OAuth client/redirect security boundary and requires positive and negative integration coverage.

## Acceptance criteria

- Reconnect no longer depends on a Cloudflare Worker fetching `chatgpt.com` CIMD over a blocked subrequest.
- Only HTTPS `chatgpt.com` URL-form client IDs with the expected OAuth client-document shape are accepted.
- URL-form client ID and redirect URI are bound to the same callback identifier; cross-callback substitution fails closed.
- PKCE S256, resource validation, scope restriction, Google approval, token binding, operator-client isolation, and tenant checks remain unchanged.
- Focused Device Authority OAuth tests, strict review, full verify, and a production HTTP/browser reconnect smoke pass before completion.
- Production Device Authority deployment uses the reviewed task/stream release path only; no secret values are read or printed.

- 2026-08-14 22:29:20 append: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`

- 2026-08-14 22:30:26 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
### RED evidence
- Safety preflight: `os-device-authority-worker.test.ts` contains zero destructive/system-modifying command literals.
- Focused RED: `bun x vitest run packages/os/tests/os-device-authority-worker.test.ts -t "ChatGPT CIMD"` failed 1/1 selected test at the expected assertion: valid URL-form ChatGPT client authorization returned 400 instead of 302 because the fetch fake rejected the CIMD network request.
- The negative cross-callback test remains present but was not selected by the narrow name filter; it will be run with the full Worker suite after implementation.

- 2026-08-14 22:30:52 append: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`

## workspace-owned: files read

- `bun run --cwd packages/os cloudflare:device-authority:deploy:dry-run`
- `bun run --cwd packages/os typecheck`
- `packages/os/package.json`
- `packages/os/tests/operator-oauth-client.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-14 22:37:57 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-14 22:38:23 apply-patch: `packages/workspace/tests/test-selection.test.js`
### Publish selection ownership
- Added critical/exclusive `os-chatgpt-mcp-oauth` selector ownership for the MCP OAuth route/service and its two direct tests. Selector TDD failed before the rule existed, then passed after canonical registry regeneration.
- Actual task selection suppresses `@consuelo/os package test` and runs seven bounded suites: workspace selector, ChatGPT MCP OAuth, OS syntax, canonical device approval, changed-server selector, GitHub workflow policy, and TypeORM CLI compatibility.
- Static destructive-literal preflight covered all 14 selected test files: zero unsafe literals.
- Exact registry execution (`test-selection check --base origin/main --run`) passed all seven selected suites.

- 2026-08-14 22:39:11 append: `.task/os/fix-chatgpt-cimd-oauth-reconnect-on-cloudflare/workpad.md`
