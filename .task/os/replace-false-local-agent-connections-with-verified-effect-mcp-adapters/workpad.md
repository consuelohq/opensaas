# replace false local agent connections with verified effect mcp adapters

branch: `task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1428/replace-false-local-agent-connections-with-verified-effect-mcp-adapters
github pr: https://github.com/consuelohq/opensaas/pull/1428
started: 2026-07-12

## acceptance criteria

- [x] Replace the marker-file/boolean connection model with explicit local-agent states: `not_detected`, `detected`, `configured`, `approval_required`, `verified`, `failed`, and `unsupported`.
- [x] Treat only `verified` agents as connected in launcher, settings, installer payloads, and doctor output; legacy `connected: true` records and `consuelo-os.json` sidecars must never prove connectivity.
- [x] Implement Effect-owned local-agent application services with typed configuration and MCP probe failures; keep Hono out of the local stdio/configuration path.
- [x] Add native, idempotent MCP configuration adapters for Codex, Cursor, Claude Code, OpenCode, Factory/Droid, and Gemini CLI while preserving unrelated user configuration and creating at most one backup.
- [x] Keep Pi detectable but explicitly unsupported until an authoritative native MCP registration path exists.
- [x] Use a stable installed Consuelo MCP executable wrapper rather than embedding the mutable `scripts/mcp-stdio.ts` path in client configuration.
- [x] Verify the Consuelo stdio server with a real subprocess `initialize` + `notifications/initialized` + `tools/list` handshake before persisting `verified`.
- [x] Fail closed on malformed client configuration, retain actionable typed status/error messages, and allow partial success across selected agents.
- [x] Delete the superseded OpenCode-only and sidecar-writing connection implementation rather than leaving parallel legacy paths.
- [x] Add focused regression coverage for legacy false positives, each native adapter, preservation/idempotency, malformed config, launcher/settings semantics, and the real stdio handshake.
- [x] Run focused tests, adjacent installer/settings tests, package typecheck, strict review, full verify, and realistic local runtime validation before promotion.
- [ ] Push the task, merge it into `stream/os`, refresh the stream PR, and clean up the task after validation.

## plan

1. Add focused red tests for sidecar/legacy-record false positives, adapter-native config output, idempotency/preservation, Pi unsupported state, and launcher verified-only counting.
2. Introduce an Effect-based local-agent connectivity module with typed filesystem/config/probe errors, native adapter registry, stable MCP wrapper, and persisted status/fingerprint migration.
3. Replace the legacy agent code in `install-state.ts`; update installer, doctor, launcher, settings snapshot/site, and sites materialization to consume explicit states.
4. Add and run a real stdio subprocess handshake test, then integrate verification into installer health completion.
5. Run focused and adjacent suites, typecheck, diff review, strict review, full verify, and local installed-runtime/client probes where available.
6. Push and promote through `stream/os`; do not change Cloudflare, WAF, Caddy ingress, or production connector infrastructure.

## test-first contract

- Behavior under test: a detected client is connected only after its native MCP configuration points at the installed Consuelo command and that command completes a real MCP handshake; sidecars and legacy booleans remain unverified.
- Existing local pattern: `packages/os/tests/install-state.test.ts` uses isolated `HOME` and `CONSUELO_HOME` subprocesses; `packages/os/tests/launcher-onboarding.test.ts` protects user-visible connection counts; `packages/os/scripts/lib/code-call/*` demonstrates small named Effect programs and explicit process cleanup.
- New or changed tests: replace the old sidecar-success assertions with adapter table tests for Codex/Cursor/Claude/OpenCode/Factory/Gemini, add malformed/preservation/idempotency and legacy migration cases, add Pi unsupported coverage, add `local-agent-connectivity.test.ts` for real stdio handshake, and update launcher/settings tests to use explicit states.
- Focused red command: `bun --cwd packages/os vitest run tests/install-state.test.ts tests/local-agent-connectivity.test.ts tests/launcher-onboarding.test.ts`.
- Expected red failure: current code writes sidecars, reports legacy booleans as connected, lacks six native adapters and the stable wrapper, has no explicit states, and has no real subprocess handshake verifier.
- No-test waiver: not applicable; this changes installer, client configuration, process lifecycle, doctor, and launcher behavior.

## current status

- Implementation is complete on task branch PR #1428 and has a publish-valid verification stamp.
- The legacy marker/boolean/OpenCode-only implementation has been deleted from `install-state.ts` and replaced by an Effect-owned adapter and verification service.
- Codex, Cursor, Claude Code, OpenCode, Factory/Droid, and Gemini CLI receive native idempotent MCP configuration; Pi remains explicitly unsupported.
- A real installed subprocess handshake proves `initialize` then `notifications/initialized` then `tools/list` before `verified` is persisted.
- Launcher, settings, doctor, capability health, and installer output consume explicit verified state only.
- The task is ready to push and promote into `stream/os`.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/capabilities.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`

## workspace-owned: activity log

- 2026-07-12 17:11:15 fs.write: `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/workpad.md`
- 2026-07-12 17:12:25 fs.write: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-07-12 17:15:14 fs.write: `packages/os/scripts/lib/local-agent-connectivity.ts`
- 2026-07-12 17:25:17 fs.write: `packages/os/tests/installer-local-agent-connectivity.test.ts`

## workspace-owned: validation evidence

- 2026-07-12 17:29:18 `checkFiles`: passed — OK
- 2026-07-12 17:29:59 `review.run`: passed — OK
- 2026-07-12 17:30:18 `checkFiles`: passed — OK
- 2026-07-12 17:30:36 `review.run`: passed — OK
- 2026-07-12 17:30:50 `verify`: passed — OK
- 2026-07-12 17:31:40 `verify`: passed — OK

## explicit validation evidence

- Red gate: the original code failed because six native adapters, explicit states, stable wrapper, and real handshake verification did not exist.
- Focused behavior: 27 tests passed across `install-state`, local-agent connectivity, full installer connectivity, and launcher onboarding.
- New connectivity suites: 8 tests passed, including byte-accurate UTF-8 Content-Length framing, all six adapters, malformed config, Pi unsupported, stale legacy record rejection, forced re-verification, and full CLI install.
- Full noninteractive installer: OpenCode native config pointed at `$CONSUELO_HOME/bin/consuelo-os-mcp`, the installed server returned tools, `verified` persisted, launcher/settings updated, and no obsolete root DB was created.
- Workspace `checkFiles`: all 13 touched source/test files passed.
- Strict `review.run`: zero blocking, related, or pre-existing findings.
- Workspace `verify`: passed, DB guard clean, publish-valid stamp written.

## key decisions

- Effect owns agent detection/configuration/verification and typed failures; Hono remains an HTTP-only boundary and is not introduced into stdio or installer code.
- Preserve `provisionLocalOs` as a synchronous materialization API; native config is written synchronously, then installer health runs the asynchronous MCP verification service and persists `verified`.
- `verified` means the native client entry matches the current installed-command fingerprint and the Consuelo stdio server completed `initialize` and `tools/list`; real client UI/CLI dogfood remains an additional runtime gate.
- The stable client command is an installed wrapper under `$CONSUELO_HOME/bin`, so client configs do not depend directly on the TypeScript source path.
- Legacy sidecars may remain on disk for rollback/audit but are ignored and are no longer written.
- Cloudflare/WAF/remote ChatGPT MCP work is explicitly out of scope.

## notes for ko

- Existing client configuration outside the Consuelo-owned entry will be preserved.
- Old false `connected` records will be downgraded unless current native configuration and MCP verification pass.

## improvements noticed

- Normalized `ProvisionAction` to include the already-used `updated` status.
- The real MCP handshake exposed an existing `mcp-gateway.ts` alias defect that made installed `tools/list` fail; corrected the call to the imported full-manifest reader.
- Capability health was opening obsolete `$CONSUELO_HOME/consuelo.db`, creating an empty root database; switched it to canonical `node/db/consuelo.db` in readonly mode.
- The publish verifier currently selects zero suites for these OS files despite discoverable focused tests; explicit test evidence is recorded below.

## issues and recovery

- The initial advisory task session returned by `task.intent` was not accepted by `task.start`; starting without that advisory session produced the real task session `tsk_f07fab56d362`.
- The broad package suite has existing environment failures where Vitest cannot resolve `bun:sqlite`, plus missing local Caddy/package artifacts. Related task suites pass in isolation and the real installed Bun subprocess path passes end to end.
- `tests/mcp-gateway.test.ts` is also blocked by the Vitest `bun:sqlite` resolver, but the new installed stdio regression executes the same gateway `initialize` and `tools/list` behavior under Bun and passes.
- A broad test run rewrote unrelated facade snapshots; that generated noise was reverted before review.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(os): verify native local agent mcp connections" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/workpad.md`
- `packages/os/CONTRIBUTING.md`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/capabilities.ts`
- `packages/workspace/senior-engineer.md`

## workspace-owned: test selection

- changed files: `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/current.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/evidence-log.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/read-log.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/session.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/verify.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/workpad.md`, `.task/tasks/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/capabilities.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/mcp-gateway.ts`, `packages/os/scripts/lib/settings-site.ts`, `packages/os/scripts/lib/settings-snapshot.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/installer-local-agent-connectivity.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
