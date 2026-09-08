# make stale lifecycle recovery windows compatible

branch: `task/os/make-stale-lifecycle-recovery-windows-compatible`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2423
started: 2026-09-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [ ] Explicit stale Windows nodes are not sent the POSIX/macOS bootstrap command.
- [ ] Native Windows recovery uses Windows paths/shell semantics and the native Bun layout, or fails closed onto a compatible existing path rather than generating an impossible command.
- [ ] POSIX stale-node recovery behavior remains unchanged.
- [ ] Platform selection is driven by the authoritative routed node platform, not request-controlled input.
- [ ] Focused tests, review, and full verify pass before promotion.

## Test-first contract

behavior under test: when an explicitly routed stale node has platform `windows`, legacy lifecycle recovery must not inject the POSIX `[ ... ]`/`command -v` command nor reject a drive-letter `CONSUELO_HOME`; supported POSIX nodes must retain the existing recovery command.
existing local pattern: `legacyLifecycleBootstrapCommand` produces one POSIX shell command and stale-route rewriting uses it unconditionally. Native Windows installs a managed Bun executable under the Consuelo user profile and does not depend on WSL.
new or changed tests: add a stale explicit Windows routing case asserting the forwarded legacy recovery command is Windows-compatible (or that the rewrite intentionally declines and preserves a compatible Windows path), plus keep POSIX command contracts.
focused red command: run the stale lifecycle routing/recovery slice in `workspace-node-registry-routing.test.ts` after adding Windows assertions.
expected red failure: Windows currently receives the POSIX `mac.call` bootstrap containing `[`, `command -v`, Unix executable paths, and an inline absolute-path check requiring `/`.
no-test waiver: not applicable.

## Review source

- Codex P1 on stream PR #2411, comment 3959401271: generate a Windows-compatible stale-node recovery command or leave Windows on a compatible recovery path.

- 2026-09-08 15:15:40 append: `.task/os/make-stale-lifecycle-recovery-windows-compatible/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 15:15:40 fs.write: `.task/os/make-stale-lifecycle-recovery-windows-compatible/workpad.md`
- 2026-09-08 15:22:17 fs.write: `.task/os/make-stale-lifecycle-recovery-windows-compatible/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tools/mac/handler.ts`
- `packages/workspace/scripts/mac.js`

## workspace-owned: validation evidence

- 2026-09-08 15:21:45 `review.run`: passed — OK
- 2026-09-08 15:22:01 `verify`: passed — OK

## Validation evidence

- RED: explicit stale Windows routing received the existing POSIX recovery bootstrap and failed the new command contract because it contained no PowerShell entrypoint (trace `trc_08e677e18e51`).
- Implementation: the authoritative routed `safeNode.platform` is now passed into legacy lifecycle rewriting. Windows gets a PowerShell resolver using `$CONSUELO_HOME\\bin\\bun.exe`, `BUN_BIN`, `Get-Command bun(.exe)`, then `%USERPROFILE%\\.bun\\bin\\bun.exe`; POSIX retains its existing resolver. The shared inline Bun recovery now validates `CONSUELO_HOME` with runtime-native `node:path.isAbsolute` instead of requiring a leading `/`.
- Focused GREEN: Windows routing contract passes (trace `trc_0ac8904055ba`).
- Related platform/routing suites: 97/97 pass across stale routing, Windows bootstrap source, and Windows platform contracts (trace `trc_9ef4cdea162b`).
- Strict review: 0 issues / 0 blockers (trace `trc_2d4974591c77`). The MCP docs opportunity is non-blocking and this is internal recovery compatibility, not a user-visible MCP API contract.
- Full verify: passed, `publishValid=true` (trace `trc_c1157227a1df`).

## Errors and recovery

- Initial `fs.search` used an unescaped `(` and ripgrep rejected the regex; retried with the literal function name.
- First test-edit helper accidentally interpolated the test fixture’s `${origin}` inside the edit program and failed before writing; retried with the interpolation escaped.
- First production-edit helper expected an over-escaped resolver block and failed before writing; retried using stable markers and single-match replacements.

## Acceptance checklist

- [x] Explicit stale Windows nodes receive a native PowerShell recovery bootstrap, not POSIX shell syntax.
- [x] Native Windows Bun layouts are covered while POSIX resolution remains unchanged.
- [x] Platform selection uses the authoritative routed node record.
- [x] Focused + related tests, strict review, and full verify pass.

- 2026-09-08 15:22:17 append: `.task/os/make-stale-lifecycle-recovery-windows-compatible/workpad.md`
