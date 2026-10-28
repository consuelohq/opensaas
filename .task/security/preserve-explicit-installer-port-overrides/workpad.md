# preserve explicit installer port overrides

branch: `task/security/preserve-explicit-installer-port-overrides`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1419/preserve-explicit-installer-port-overrides
github pr: https://github.com/consuelohq/opensaas/pull/1419
started: 2026-07-11

## acceptance criteria

- [x] Verify the new Codex finding against the current stream before editing.
- [x] Pass an explicit `CONSUELO_OS_PORT` or `PORT` override from the installer into `provisionLocalOs`.
- [x] Preserve the validated runtime precedence and reject malformed/out-of-range ports consistently.
- [x] Prove an explicit legacy `8960` override survives two-pass reprovisioning across config, Caddy, ChatGPT MCP, and cloudflared state.
- [x] Preserve no-override migration from legacy `8960` to `46321`.
- [x] Run focused port/installer/server tests, OS typecheck, strict workspace review, and repository verify.
- [ ] Pass refreshed stream PR CI.
- [x] Leave the separately deferred watchdog comment unchanged.

## plan

1. Add red tests for the shared environment override resolver, installer wiring, and two-pass explicit-legacy preservation.
2. Export the existing validated local-port override resolver from `server/env.ts` and consume it in `install.ts`.
3. Rerun focused behavior and static gates.
4. Promote the task into `stream/security`, resolve only the fixed Codex thread, and wait for PR #1414 CI.

## test-first contract

- Behavior under test: explicit environment port overrides are supplied to provisioning; absence of an override still permits the legacy-default migration.
- Existing pattern: `local-os-port-cutover.test.ts` owns default/override precedence and two-pass generated-state assertions.
- Focused red command: `bun vitest run tests/local-os-port-cutover.test.ts` from `packages/os`.
- Expected red failure: the validated override resolver is not exported and `install.ts` does not pass a port to `provisionLocalOs`.

## current status

- Finding verified at stream head `bc089e3c814d9b105af5e6b8b431577ebc05f084`: `install.ts` omits `port`, while `provisionLocalOs` migrates persisted `8960` unless `options.port` is supplied.
- Exported the existing validated environment override resolver and wired the installer to pass its result into provisioning.
- Focused red produced three expected failures; focused green passed all 10 port-cutover tests.
- Adjacent installer, install-state, Bun server, and Hono architecture suites pass 59/59; OS typecheck passes.
- Strict workspace review reports zero findings and zero blockers; repository verify produced a publish-valid stamp.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-11 18:58:48 `review.run`: passed — OK
- 2026-07-11 18:59:04 `verify`: passed — OK
- 2026-07-11 18:59:19 `verify`: passed — OK

## key decisions

- Reuse the server's existing validated environment-port parser rather than duplicate parsing in the installer.
- The watchdog finding remains intentionally deferred per Ko.

## notes for ko

- The watchdog comment remains unresolved and unchanged as explicitly deferred.

## improvements noticed

- none yet

## issues and recovery

- No shell files changed in this follow-up, so there is no changed-shell syntax gate.

## validation summary

- Test-first red: 3 expected failures covering resolver export, installer wiring, and explicit legacy preservation.
- Focused port-cutover suite: 10/10 passed.
- Adjacent installer/server/install-state suites: 59/59 passed.
- OS typecheck/syntax check: passed.
- Strict workspace review: zero findings and zero blockers.
- Repository verify: passed with a publish-valid stamp.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/install.ts`
- `packages/os/scripts/server/env.ts`

- 2026-07-11 18:56:46 apply-patch: `.task/security/preserve-explicit-installer-port-overrides/workpad.md`
- 2026-07-11 18:56:46 apply-patch: `packages/os/tests/local-os-port-cutover.test.ts`
- 2026-07-11 18:57:14 apply-patch: `packages/os/scripts/server/env.ts`
- 2026-07-11 18:57:14 apply-patch: `packages/os/scripts/install.ts`

- 2026-07-11 18:58:14 apply-patch: `.task/security/preserve-explicit-installer-port-overrides/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/preserve-explicit-installer-port-overrides/current.json`, `.task/security/preserve-explicit-installer-port-overrides/evidence-log.json`, `.task/security/preserve-explicit-installer-port-overrides/read-log.json`, `.task/security/preserve-explicit-installer-port-overrides/session.json`, `.task/security/preserve-explicit-installer-port-overrides/verify.json`, `.task/security/preserve-explicit-installer-port-overrides/workpad.md`, `.task/tasks/security/preserve-explicit-installer-port-overrides.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/server/env.ts`, `packages/os/tests/local-os-port-cutover.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
