# rematerialize managed sites after runtime update

branch: `task/os/rematerialize-managed-sites-after-runtime-update`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1885/rematerialize-managed-sites-after-runtime-update
github pr: https://github.com/consuelohq/opensaas/pull/1885
started: 2026-08-12

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

- none yet

## workspace-owned: validation evidence

- 2026-08-12 04:57:57 `review.run`: passed — OK
- 2026-08-12 04:58:12 `review.run`: passed — OK
- 2026-08-12 04:58:25 `verify`: passed — OK

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

## discovery — managed Sites freshness after runtime update

- Reproduction from the just-shipped 0.1.26 -> 0.1.27 update: runtime activation succeeded, but `~/.consuelo/sites/traces/index.html` remained bytes from the previous runtime until the new runtime's official `materializeSites` path was invoked.
- Goal: make a newly activated runtime self-reconcile managed Sites so updates from an older updater still refresh managed site bytes.
- Candidate boundary: new runtime daemon startup, after `CONSUELO_HOME` and Bun are resolved but before the supervisor exec. This uses code from the activated runtime, so it works even when the updater process itself is the previous version.
- Safety requirement: reconciliation must be idempotent and best-effort; a Sites rendering problem must not prevent the OS daemon from starting.
- Preserve user-authored Sites page/version content; regenerate only managed surfaces through the existing `sites refresh` / `materializeSites` implementation.

## Test-first contract

- Given an activated runtime startup script, it must run the activated runtime's managed Sites refresh before the supervisor starts.
- It must pass the active `CONSUELO_HOME`, use the activated runtime's own `scripts/os.ts`, and log/continue rather than fail daemon startup if Sites refresh errors.
- Existing secret scrub, Bun resolution, and final supervisor `exec` contracts must remain intact.
- Focused red test: extend the lifecycle/daemon contract to require a pre-supervisor `sites refresh` invocation and best-effort failure handling; prove it fails before changing the startup script.

## workspace-owned: files read

- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/daemon-bun-path.test.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## implementation + verification

- Product red: the new daemon-start regression expected an activated-runtime `sites refresh --json` call before the supervisor and got only the supervisor call.
- Product fix: `start-consuelo-daemon.sh` now runs `"$bun_bin" "$root_dir/scripts/os.ts" sites refresh --json` before supervisor exec. Refresh failure is logged and daemon startup continues. This ensures the newly activated runtime, not the previous updater, owns managed Sites reconciliation.
- Product green: `daemon-bun-path.test.ts` 3/3, `finish-line-lifecycle-contract.test.ts` 10/10, startup shell syntax, and `git diff --check` all pass.
- Test-selection red: daemon shell changes initially selected only the broad `@consuelo/os package test`; after adding the explicit lifecycle rule, the broad suite still remained because `sourceCodeFiles()` did not classify shell scripts as source code.
- Test-selection fix: lifecycle focused coverage now owns `start-consuelo-daemon.sh` + `daemon-bun-path.test.ts`, its suite runs both focused lifecycle files, and shell extensions (`.sh`, `.bash`, `.zsh`) participate in explicit-critical broad-suite suppression.
- Test-selection green: the focused regression passes; the full workspace selection suite passes 14/14; lifecycle suite passes 13/13; direct selection for `start-consuelo-daemon.sh` reports the explicit lifecycle rule plus the matched auto rule but executes only the focused lifecycle suite.
