# fix grok subagent executable discovery

branch: `task/os/fix-grok-subagent-executable-discovery`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1536/fix-grok-subagent-executable-discovery
github pr: https://github.com/consuelohq/opensaas/pull/1536
started: 2026-07-20

## acceptance criteria

- [x] The OS `subagent` tool can discover Grok when a GUI/MCP process has a restricted `PATH` but Grok is installed in its canonical user locations.
- [x] The Grok provider accepts an explicit absolute `WORKSPACE_SUBAGENT_GROK_BIN` path.
- [x] The provider can fall back to the installed `agent` executable when `grok` is unavailable.
- [x] Existing provider overrides remain authoritative and no shell startup files are sourced.
- [x] Focused tests, syntax/type checks, review, and verify pass.
- [x] A live task-branch OS subagent invocation succeeds with the restricted facade `PATH`.

## plan

1. Add focused red facade tests for canonical Grok discovery, the `agent` alias, and an absolute configured executable.
2. Replace PATH-only lookup with deterministic executable resolution: explicit paths, process PATH, and approved user bin directories.
3. Limit the `agent` alias fallback to the default Grok provider configuration.
4. Run focused tests and OS validation, inspect the diff, push, and promote to `stream/os`.
5. Reload the local OS runtime and rerun the real Grok research subagent.

## discovery

- Manual `/Users/kokayi/.grok/bin/grok --prompt-file /tmp/grok-os-smoke.md --output-format json` succeeded.
- Manual `/Users/kokayi/.grok/bin/agent --prompt-file /tmp/grok-os-smoke.md --output-format json` also succeeded; both names resolve to the same Grok 0.2.101 binary.
- The OS facade process PATH is `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin` plus repo `node_modules/.bin`; it omits `~/.grok/bin` and `~/.local/bin`.
- A login zsh PATH includes `~/.grok/bin` and `~/.local/bin`, so terminal use succeeds while OS discovery fails.
- `packages/os/scripts/lib/subagent/runtime.ts` resolves every provider through `findExecutable`, which searches only PATH.
- The same helper also mishandles an absolute `WORKSPACE_SUBAGENT_GROK_BIN` because it joins the configured value to each PATH directory.
- Exact `fs.search` confirmed the owner. Semantic `explore` returned irrelevant path utilities because its index is stale for this new subagent code; those results were rejected.
- Workspace has broader subagent facade tests; OS currently has no corresponding executable-discovery coverage.

## Test-first contract

### Behavior under test

- With `PATH` empty and `HOME/.grok/bin/grok` executable, the Grok subagent runs and reports `completed`.
- With `PATH` empty and only `HOME/.local/bin/agent` executable, the default Grok provider uses the alias and runs.
- With `PATH` empty and `WORKSPACE_SUBAGENT_GROK_BIN` set to an absolute executable, that exact path runs.
- A non-default configured binary does not silently fall back to `grok` or `agent`.

### Existing pattern

- Provider execution: `packages/os/scripts/lib/subagent/runtime.ts`.
- Facade/runtime tests: `packages/os/tests/facade/facade.test.ts`.
- Workspace parity reference: `packages/workspace/tests/facade/facade.test.ts`.

### Intended tests

- Add focused Grok executable-discovery cases to `packages/os/tests/subagent-executable-discovery.test.ts` using temporary fake executables and instruction files.

### Focused red command

`bun --cwd packages/os test tests/subagent-executable-discovery.test.ts`

### Expected red failure

- PATH-only lookup returns `not_configured` for canonical user installs and absolute configured executable paths.

## current status

- Implementation, focused validation, strict review, and publish verification pass.
- Ready to push and promote to `stream/os`.

## files changed

- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`


## workspace-owned: files changed

- `.task/os/fix-grok-subagent-executable-discovery/workpad.md`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`

## workspace-owned: validation evidence

- Manual Grok prompt-file smoke: passed through both `grok` and `agent`.
- Focused red: 3 expected failures for canonical user-bin discovery, `agent` fallback, and absolute configured paths; explicit missing override remained authoritative.
- Focused green: `packages/os/tests/subagent-executable-discovery.test.ts` passed, 4 tests.
- OS syntax/typecheck: `bun run --cwd packages/os typecheck` passed.
- Live task-branch smoke with a deliberately restricted facade `PATH` completed through `/Users/kokayi/.grok/bin/grok`; provider trace `trc_c1f284125578`.
- Strict review passed with 0 issues; trace `trc_f27eef9a93ce`.
- Full verify passed and produced a publish-valid stamp; trace `trc_bb94b0f55ecc`.
- 2026-07-20 17:42:42 `review.run`: passed — OK
- 2026-07-20 17:42:50 `review.run`: passed — OK
- 2026-07-20 17:43:00 `verify`: passed — OK

## key decisions

- Do not source `.zshrc` or invoke a login shell from the OS runtime.
- Use deterministic executable discovery with explicit configuration first.
- Support `agent` as a Grok-specific fallback only when the default binary name is in use.

## notes for ko

- The failure is environment lookup, not Grok authentication or the CLI itself.

## improvements noticed

- OS and workspace have parallel subagent runtimes. This task fixes OS first as requested; parity pressure will be evaluated from the final diff.
- Documentation source changes are unnecessary because no public tool schema, CLI flags, or script contract changed.

## issues and recovery

- `fs.list` was initially given a glob where it expects a regex. Retried with a valid fixed pattern.
- `explore` produced irrelevant stale-index results; exact source search and file reads established the owner.
- A task-scoped `batch` failed to propagate `taskSession` to child `code.call` steps and accidentally ran against the main checkout. Re-ran both checks as direct task-scoped calls.
- The first typecheck argv order printed Bun help with exit code 0. Re-ran the actual package script as `bun run --cwd packages/os typecheck` and confirmed the syntax checker passed.
- The live smoke completed successfully but `code.call` verify mode correctly reported that the subagent runtime persisted trace artifacts under `.task/subagent-runs`; the provider result itself was `completed`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): discover user-installed grok subagents" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-20 17:38:13 write: `.task/os/fix-grok-subagent-executable-discovery/workpad.md`

## workspace-owned: activity log

- 2026-07-20 17:38:13 fs.write: `.task/os/fix-grok-subagent-executable-discovery/workpad.md`
- 2026-07-20 17:38:36 write: `packages/os/tests/subagent-executable-discovery.test.ts`
- 2026-07-20 17:38:36 fs.write: `packages/os/tests/subagent-executable-discovery.test.ts`
- 2026-07-20 17:39:30 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-07-20 17:40:22 fs.write: `.task/os/fix-grok-subagent-executable-discovery/grok-live-smoke.md`

## workspace-owned: files read

- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/subagent.ts`
- `packages/os/scripts/task-push.js`
