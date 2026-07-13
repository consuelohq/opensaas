# Prelaunch local port cutover

branch: `task/security/prelaunch-local-port-cutover`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1412/prelaunch-local-port-cutover
github pr: https://github.com/consuelohq/opensaas/pull/1412
started: 2026-07-11
base: current `main` at PR 2 merge commit `444561eb926a87f659105592aa705e7ff362116f`

## acceptance criteria

- [x] Confirm the exact approved destination default port before editing tests or production code: `46321`.
- [x] Add/update port-contract tests first and prove the expected failure against default `8960`.
- [x] Cut over every active OS runtime, health probe, daemon, Docker, installer, generated gateway, Cloudflare connector-provisioning, documentation, and test reference that forms the local-port contract.
- [x] Preserve `CONSUELO_OS_PORT`, then `PORT`, then the new default precedence.
- [x] Preserve loopback-only binding, all HTTP/auth/security/MCP behavior, and all PR 2 hardening behavior.
- [x] Classify all `8960`, destination-port, and historical `8850` matches before changing them.
- [x] Run focused server/port, security/MCP, installer/gateway, status/doctor, daemon/entrypoint tests; OS typecheck; shell syntax; strict review; repository verify.
- [ ] Push and promote through `stream/security`; stop at the refreshed stream PR without merging it.

## plan

1. Use Ko-approved destination port `46321`.
2. Add a table-driven port-contract test covering the default, overrides, generated service URLs, daemon/watchdog probes, Docker, installer output/state, and Cloudflare connector provisioning.
3. Run the focused contract red and record the expected `8960` mismatches.
4. Apply only the atomic default-port cutover across active surfaces; retain independent workspace-runtime fixtures and historical evidence.
5. Run the required focused suites and static checks.
6. Run strict review and repository verification.
7. Push and promote into `stream/security`; stop at the refreshed stream PR.

## current status

- Task and draft PR created from current `main`.
- Read-only destination search completed across active repository files, task history, GitHub issues/PRs, and prior explicit user decisions.
- Ko explicitly approved destination default port `46321`.
- Atomic active OS cutover to `46321` is implemented. Independent `packages/workspace` `8850` defaults and historical evidence remain unchanged.
- Post-edit scan finds `8960` only in the new regression assertions that forbid the old default.
- Process-level proof passed with a temporary installed OS home: the real Bun/Hono server listened on `127.0.0.1:46321`, the status helper returned healthy, and doctor returned `ok: true`.

## test-first contract

- Behavior under test: the local OS default moves atomically from `8960` to `46321`, while `CONSUELO_OS_PORT` then `PORT` override precedence and loopback-only behavior remain unchanged.
- Existing pattern: `bun-product-server-contract.test.ts`, `local-os-server-review-findings.test.ts`, installer/gateway contracts, and device-authority release contracts combine runtime behavior with deterministic configuration assertions.
- New test: `packages/os/tests/local-os-port-cutover.test.ts`, covering server defaults/overrides, active runtime/config/docs defaults, Cloudflare connector service URL, and scope guards for independent `packages/workspace` `8850` behavior.
- Focused red command: `bun --cwd packages/os vitest run tests/local-os-port-cutover.test.ts`.
- Expected red failure: current active defaults still resolve or declare `8960`; override controls remain green.
- Red result: 3 expected failures and 1 scope-guard pass. The server default and generated install config returned `8960`, and Docker was the first deterministic active-surface mismatch. The independent `packages/workspace` `8850` contract passed.

## port-reference classification

### active OS default contract — must move atomically

- Bun server default and config: `packages/os/scripts/server/env.ts`, `server.js`, reload/status helpers.
- Daemon/watchdog/install paths: start wrappers, `workspace-watchdog.sh`, `install-system-daemons.sh`, bootstrap messaging and install state.
- Local gateway/smoke paths: security gateway default upstream, trace smoke URLs, generated Caddy assertions.
- Cloudflare connector provisioning: device-authority Wrangler variable, constants, release contract, provisioning tests.
- Runtime packaging/docs: Docker `EXPOSE`, README, runtime docs, installer release checklist, SCRIPTS.
- Behavior tests: server config/default, MCP/security requests, status/doctor, installer, daemon/process, Cloudflare provisioning.

### active but independent `8850` — do not mass-replace

- `packages/workspace/**` is a separate legacy workspace runtime with its own default.
- Gateway/security test fixtures that deliberately pass explicit custom upstream `8850` values test override behavior, not the OS default.
- `packages/os/.env.example` currently says `8850`; this is stale active OS configuration and should change during the cutover.

### historical/regression evidence — retain unless the assertion itself becomes obsolete

- `packages/os/docs/review/stream-os-pr-362-review-packet.md` records historical findings.
- Regression assertions such as `not.toContain('localhost:8850')` prove stale defaults do not return.
- Archived `.task` records are evidence and are not cutover targets.

## files changed

- Active OS runtime/configuration: server default, server manager, reload/status helpers, daemon wrappers, watchdog, installer bootstrap, generated gateway upstream, trace smoke defaults, Docker, OS environment example, and Cloudflare connector defaults.
- Documentation: OS README, scripts reference, runtime surfaces, and installer runtime checklist.
- Tests: existing port-dependent server, security, MCP, installer, generated-gateway, trace, Cloudflare, and release contracts plus new `packages/os/tests/local-os-port-cutover.test.ts`.
- Scoped task metadata and workpad.

## workspace-owned: files changed

- `.task/security/prelaunch-local-port-cutover/workpad.md`
- `packages/os/tests/local-os-port-cutover.test.ts`

## workspace-owned: activity log

- 2026-07-11 05:32:53 fs.write: `packages/os/tests/local-os-port-cutover.test.ts`
- 2026-07-11: created task PR #1412 from current main and completed read-only port inventory.

## workspace-owned: validation evidence

- Base verified as `444561eb926a87f659105592aa705e7ff362116f`.
- Active scan found 103 explicit `8960`/`8850` references across OS/workspace/config/docs/tests; each class is recorded above.
- 2026-07-11 07:04:26 `review.run`: passed — OK
- 2026-07-11 07:04:39 `verify`: passed — OK

## key decisions

- Hard cutover is approved; no permanent `8960` compatibility layer will be added.
- Independent `packages/workspace` port behavior and explicit override fixtures are outside this cutover.
- Destination port `46321` was explicitly approved by Ko; historical `8850` and independent workspace-runtime values remain out of scope.

## notes for ko

- This is a prelaunch hard cutover. Existing internal installations on `8960` must reinstall/reprovision after the stream PR is merged and released.

## improvements noticed

- A single exported OS default-port constant could reduce future drift, but introducing broader configuration refactoring is out of scope unless required for the atomic cutover.

## issues and recovery

- `stream/security` was behind current main, but `task.start` correctly based PR #1412 directly on current `main` at `444561eb...`.
- The initial workpad write exceeded the workspace wrapper command limit; recovered with a scoped patch-file write.
- Two broad-suite failures were verified as pre-existing and unrelated: `doctor-redaction.test.ts` cannot import `bun:sqlite` under the Node-hosted Vitest worker, and one installer-bootstrap source-order assertion is stale. The other 9 gated bootstrap behaviors passed, and real doctor/status process proof passed.

## validation summary

- TDD red: new port contract failed 3 expected assertions against `8960`; independent workspace `8850` guard passed.
- TDD green: `local-os-port-cutover.test.ts` — 4/4 passed.
- Server/security/MCP/process-entrypoint group — 76/76 passed.
- Installer/gateway/Cloudflare/status-related broad group — 138 passed, plus 5/5 gated device-approval hardening and 9/9 non-brittle gated installer-bootstrap behaviors.
- Process proof: installed temporary OS home, started real Bun/Hono server without port overrides, health returned port `46321`, status helper succeeded, doctor returned `ok: true`.
- OS typecheck passed.
- Shell syntax passed for all changed shell entrypoints.
- `git diff --check` passed.
- Wrangler device-authority dry-run passed and reported connector local service URL `http://127.0.0.1:46321`.
- Strict review against `origin/main` passed with 0 findings and 0 blockers.
- Repository verify against `origin/main` passed and wrote a publish-valid stamp. Its automatic selector chose zero suites; explicit focused validation above supplied the behavior coverage.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(os): cut over local service port" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/constants.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/doctor-redaction.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/workspace/senior-engineer.md`

## workspace-owned: test selection

- changed files: `.task/security/prelaunch-local-port-cutover/current.json`, `.task/security/prelaunch-local-port-cutover/evidence-log.json`, `.task/security/prelaunch-local-port-cutover/read-log.json`, `.task/security/prelaunch-local-port-cutover/session.json`, `.task/security/prelaunch-local-port-cutover/workpad.md`, `.task/tasks/security/prelaunch-local-port-cutover.json`, `packages/os/.env.example`, `packages/os/Dockerfile`, `packages/os/README.md`, `packages/os/SCRIPTS.md`, `packages/os/cloudflare/os-device-authority/src/constants.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/docs/installer-runtime-release-checklist.md`, `packages/os/docs/runtime-surfaces.md`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/consuelo-reload.js`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/trace-sites-live-smoke.ts`, `packages/os/scripts/lib/workspace-state.js`, `packages/os/scripts/server.js`, `packages/os/scripts/server/env.ts`, `packages/os/scripts/server/services/trace-gateway.ts`, `packages/os/scripts/start-brain-daemon.sh`, `packages/os/scripts/start-brain.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/scripts/workspace-watchdog.sh`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/dangerous-material-policy.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/local-os-server-hono-architecture.test.ts`, `packages/os/tests/local-os-server-review-findings.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`, `packages/os/tests/os-device-authority-release-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/os/tests/trace-sites-live-smoke-script.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-11 07:04:48 apply-patch: `.task/security/prelaunch-local-port-cutover/workpad.md`