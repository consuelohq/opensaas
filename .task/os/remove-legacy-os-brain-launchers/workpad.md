# remove legacy OS brain launchers

branch: `task/os/remove-legacy-os-brain-launchers`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1407/remove-legacy-os-brain-launchers
github pr: https://github.com/consuelohq/opensaas/pull/1407
started: 2026-07-11

## acceptance criteria

- [x] Repoint `packages/os/scripts/consuelo-reload.js` to the canonical `start-consuelo-daemon.sh` entrypoint.
- [x] Delete the duplicate `packages/os/scripts/start-brain.sh` and `packages/os/scripts/start-brain-daemon.sh` files.
- [x] Reclassify the legacy launcher paths as intentionally deprecated workspace-only scripts.
- [x] Preserve the separate `packages/workspace` launcher scripts unchanged.
- [x] Add a regression contract proving the OS has one canonical daemon launcher.
- [x] Focused tests, shell/JS syntax, review, and verify pass before promotion.

## plan

1. Extend the Bun product-server contract to require `start-consuelo-daemon.sh`, reject legacy OS launcher files, and verify the reload fallback uses the canonical script.
2. Run the focused contract red against the current duplicate launchers.
3. Update `consuelo-reload.js`, delete the duplicate scripts, and reclassify the remaining workspace-only paths.
4. Run focused server/runtime tests plus syntax, diff, review, and verify gates.
5. Push and promote through `stream/os`; stop at the stream review PR.

## test-first contract

- Behavior under test: the OS package has exactly one maintained Bun daemon launcher, and direct reload fallback uses it.
- Existing pattern: `packages/os/tests/bun-product-server-contract.test.ts` owns product-server entrypoint and legacy-surface assertions.
- Changed test: assert `consuelo-reload.js` names `start-consuelo-daemon.sh`, assert both OS `start-brain*.sh` files are absent, and assert the parity file records the remaining workspace copies as intentionally deprecated.
- Focused red command: `bun --cwd packages/os vitest run tests/bun-product-server-contract.test.ts`.
- Expected red failure: reload still names `start-brain.sh`, both duplicate OS files still exist, and parity classifications still treat the paths as shared changed scripts.

## current status

- `consuelo-reload.js` now uses `start-consuelo-daemon.sh` for direct fallback.
- Both duplicate OS launcher files are deleted.
- `SCRIPTS.md` documents the canonical reload fallback.
- The surviving launcher started the Bun server successfully on isolated ephemeral port `59327` and returned a healthy Bun response.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/start-brain-daemon.sh` (deleted)
- `packages/os/scripts/start-brain.sh` (deleted)
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tooling/script-parity-classifications.json`

## workspace-owned: files changed

- `packages/os/scripts/start-brain-daemon.sh` (deleted)
- `packages/os/scripts/start-brain.sh` (deleted)

## workspace-owned: activity log

- 2026-07-11 04:10:03 fs.trash: `packages/os/scripts/start-brain.sh`
- 2026-07-11 04:10:08 fs.trash: `packages/os/scripts/start-brain-daemon.sh`

## workspace-owned: validation evidence

- 2026-07-11 04:14:14 `review.run`: passed — OK
- 2026-07-11 04:14:36 `verify`: passed — OK
- 2026-07-11 04:14:49 `verify`: passed — OK

## key decisions

- Remove rather than rename: `internal-brain` is obsolete product naming and would recreate ambiguity.
- Keep `packages/workspace/scripts/start-brain*.sh` out of scope because workspace still references them independently.
- The parity inventory is a union of workspace and OS scripts, so workspace-only legacy paths must remain classified after their OS copies are deleted.

## notes for ko

- This task intentionally does not touch the still-active `packages/workspace/scripts/start-brain*.sh` files.
- The runtime smoke reflects current `main` health metadata, including its pre-existing `mcp` tool-count issue; that behavior is outside this launcher cleanup.

## improvements noticed

- The script parity baseline is already missing 47 current script paths on `origin/main`; the broad parity audit fails before reaching status compatibility. This task preserves valid classifications for the two remaining workspace-only launcher paths instead of widening into a full parity-baseline refresh.

## issues and recovery

- Initial parity edit removed the two classifications. The audit clarified that its inventory is the union of OS and workspace scripts, so the entries were restored as `deprecated-intentional` for the remaining workspace-only paths.
- `tests/audit/script-parity-audit.test.ts` remains red because `origin/main` has 273 inventory paths but only 226 classifications. A direct `origin/main` inventory comparison confirmed the same 47 missing paths before this task.

## validation evidence

- TDD red: Bun product-server contract failed because reload still used `start-brain.sh`.
- TDD green: Bun product-server contract passed, 4/4.
- Adjacent installer/runtime tests passed, 32/32.
- `node --check packages/os/scripts/consuelo-reload.js`: passed.
- `bash -n packages/os/scripts/start-consuelo-daemon.sh`: passed.
- `bun run --cwd packages/os typecheck`: passed.
- Isolated canonical launcher smoke: healthy Bun server on `127.0.0.1:59327`, then targeted process shutdown.
- `git diff --check`: passed.
- Strict review against `origin/main`: passed with 0 findings.
- Full verify against `origin/main`: publish-valid; database guard reported 0 risks and 0 findings.
- The automatic test selector selected zero suites, so the explicit 4 product-server and 32 installer/runtime assertions remain the behavioral evidence.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/CONTRIBUTING.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tooling/script-parity-classifications.json`

- 2026-07-11 04:13:39 apply-patch: `.task/os/remove-legacy-os-brain-launchers/workpad.md`

- 2026-07-11 04:14:23 apply-patch: `.task/os/remove-legacy-os-brain-launchers/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/remove-legacy-os-brain-launchers/current.json`, `.task/os/remove-legacy-os-brain-launchers/evidence-log.json`, `.task/os/remove-legacy-os-brain-launchers/read-log.json`, `.task/os/remove-legacy-os-brain-launchers/session.json`, `.task/os/remove-legacy-os-brain-launchers/verify.json`, `.task/os/remove-legacy-os-brain-launchers/workpad.md`, `.task/tasks/os/remove-legacy-os-brain-launchers.json`, `packages/os/SCRIPTS.md`, `packages/os/scripts/consuelo-reload.js`, `packages/os/scripts/start-brain-daemon.sh`, `packages/os/scripts/start-brain.sh`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tooling/script-parity-classifications.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
