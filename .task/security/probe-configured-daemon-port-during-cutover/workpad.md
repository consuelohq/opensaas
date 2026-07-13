# probe configured daemon port during cutover

branch: `task/security/probe-configured-daemon-port-during-cutover`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1418/probe-configured-daemon-port-during-cutover
github pr: https://github.com/consuelohq/opensaas/pull/1418
started: 2026-07-11

## acceptance criteria

- [x] Verify the Codex cutover-health finding against the current `stream/security` head and fix it only if still valid.
- [x] Derive the post-LaunchAgent local health URL from the same `.env` and port precedence used by `start-consuelo-daemon.sh`.
- [x] Preserve an explicit `WORKSPACE_CUTOVER_LOCAL_HEALTH_URL` override.
- [x] Cover default, persisted custom-port, daemon-port override, and explicit-health-URL behavior with focused regression tests.
- [x] Run focused installer/runtime tests, changed-shell syntax, OS typecheck, workspace review, and repository verify.
- [ ] Pass final refreshed stream PR CI.
- [x] Record the unrelated Codex comment as intentionally deferred.

## plan

1. Add a focused shell-contract test that reproduces the hard-coded `46321` probe against a custom persisted port.
2. Add a narrow resolver in `install-system-daemons.sh` that mirrors the daemon launcher's env-file and port precedence.
3. Document the cutover probe contract in `packages/os/SCRIPTS.md`.
4. Run focused and broad validation, then promote the task into `stream/security` and refresh PR #1414.

## test-first contract

- Behavior under test: post-cutover health probing follows `WORKSPACE_DAEMON_PORT`, then `.env`/environment `CONSUELO_OS_PORT`, then `PORT`, then default `46321`; an explicit health URL remains authoritative.
- Existing pattern: `installer-runtime-dependencies.test.ts` executes shell helpers in isolated temporary homes and checks daemon dry-run behavior.
- Changed test: add a focused resolver test to `packages/os/tests/installer-runtime-dependencies.test.ts`.
- Focused red command: `bun vitest run tests/installer-runtime-dependencies.test.ts -t "configured daemon port during cutover"` from `packages/os`.
- Expected red failure: `install-system-daemons.sh` exposes no port-aware health resolver and still declares a literal `46321` local health URL.

## current status

- Finding verified as valid at PR #1414 head `e2ab4df7c0a525390a04f83d44cc08d095e8c437`: the daemon launcher loads `.env` and honors custom ports, while the installer probes literal `46321` after LaunchAgent cutover.
- Implemented a port-aware post-cutover health resolver that mirrors the daemon launcher's env-file and override precedence.
- Focused red reproduced the missing resolver; focused green passed all four precedence cases.
- Installer/runtime plus port-cutover suites pass 21/21; changed shell syntax and OS typecheck pass.
- Strict workspace review reports zero findings and zero blockers; repository verify produced a publish-valid stamp.

## files changed

- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`
- `packages/os/SCRIPTS.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-11 18:46:53 `review.run`: passed — OK
- 2026-07-11 18:47:07 `verify`: passed — OK
- 2026-07-11 18:47:23 `verify`: passed — OK

## key decisions

- Keep the fix scoped to the post-cutover local probe. The second Codex comment is unrelated and intentionally deferred per Ko.
- Follow the existing shell-local `load_env_file` pattern rather than introduce a cross-script shell library in a review hotfix.

## validation summary

- Test-first red: the focused test failed because the daemon installer had no env-aware health resolver.
- Focused precedence regression: 1/1 passed for `.env`, daemon override, explicit URL, and default cases.
- Installer/runtime and local-port suites: 21/21 passed.
- `bash -n packages/os/scripts/install-system-daemons.sh`: passed.
- OS package typecheck/syntax check: passed.
- Strict workspace review: zero findings and zero blockers.
- Repository verify: passed with a publish-valid stamp.

## notes for ko

- The second Codex comment was not addressed because Ko classified it as unrelated and currently unused.

## improvements noticed

- none yet

## issues and recovery

- The first OS typecheck invocation placed `--cwd` incorrectly and only printed Bun help; reran from an explicit `packages/os` process cwd and obtained the real passing syntax-check result.
- The broad port contract initially required a literal `46321` health URL in the daemon installer. Updated it to assert the dynamic resolver's `46321` fallback rather than reintroducing the bug.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`

- 2026-07-11 18:45:11 apply-patch: `packages/os/tests/local-os-port-cutover.test.ts`

- 2026-07-11 18:46:22 apply-patch: `.task/security/probe-configured-daemon-port-during-cutover/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/probe-configured-daemon-port-during-cutover/current.json`, `.task/security/probe-configured-daemon-port-during-cutover/evidence-log.json`, `.task/security/probe-configured-daemon-port-during-cutover/read-log.json`, `.task/security/probe-configured-daemon-port-during-cutover/session.json`, `.task/security/probe-configured-daemon-port-during-cutover/verify.json`, `.task/security/probe-configured-daemon-port-during-cutover/workpad.md`, `.task/tasks/security/probe-configured-daemon-port-during-cutover.json`, `packages/os/SCRIPTS.md`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
