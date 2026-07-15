# lock Bun as the only OS product server

branch: `task/security/lock-bun-as-the-only-os-product-server`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1401/lock-bun-as-the-only-os-product-server
github pr: https://github.com/consuelohq/opensaas/pull/1401
started: 2026-07-11

## acceptance criteria

- [x] Remove the obsolete `packages/os/server.py` product server and its Python-only tests.
- [x] Remove the unreferenced root `packages/os/requirements.txt` without removing optional media Python tooling.
- [x] Add a contract proving supported OS server entrypoints use Bun/TypeScript and never invoke `server.py`.
- [x] Keep the local server bound to loopback and preserve current HTTP behavior.
- [x] Correct active runtime docs, status/doctor health probing, and Docker metadata to the current port `8960` and Bun-only product path.
- [x] Leave the Hono local-server refactor and prelaunch port cutover for the approved follow-up PRs.
- [x] Strict review and repository verification pass.
- [ ] Push and promote through `stream/security` for Ko's review.

## plan

1. Add a Bun product-server architecture contract before deleting legacy files.
2. Prove the contract is red because Python server surfaces still exist and active docs advertise compatibility/port `8850`.
3. Delete only the obsolete Python product-server files and tests.
4. Update active docs and Docker metadata without changing server HTTP behavior.
5. Correct the existing status/doctor probe to use the configured Bun port on loopback.
6. Run focused server/security and installer/state regressions, then review and verify.
7. Push and promote through `stream/security`; stop at the stream review PR for Ko.

## test-first contract

- Behavior under test: every supported Consuelo OS product-server entrypoint is Bun/TypeScript, the obsolete Python transport is absent, active docs/config agree on port `8960`, and status/doctor probe the configured port on loopback.
- Existing pattern: `os-device-authority-architecture.test.ts` uses filesystem contracts for canonical entrypoints and deletion of legacy monoliths.
- New test: `packages/os/tests/bun-product-server-contract.test.ts`.
- Focused command: `bun --cwd packages/os vitest run tests/bun-product-server-contract.test.ts`.
- Initial red result: 2 expected failures and 1 pass. `server.py` still existed and active docs still advertised Python compatibility/port `8850`.
- Incremental red result: after removal/docs cleanup, the contract failed only because `workspace-state.js` still probed `localhost:8850`.
- Final green result: 4/4 pass, including a real loopback HTTP probe on an injected configured port.
- Scope note: Python remains allowed for specialized optional utilities such as media vision/SVG workflows; this contract removes Python only as an OS product server.

## implementation

- Deleted the obsolete 461-line Python HTTP server and its unreferenced dependency bundle.
- Deleted two Python tests: one targeted the dead OS server, and one incorrectly imported `packages/workspace/server.py` from the OS package.
- Preserved optional Python utilities such as `scripts/media-svg.py` and `tools/brain.py`.
- Locked package scripts, setup, daemon startup, server manager, Docker command, and local bind behavior to Bun/TypeScript.
- Corrected active port documentation and Docker exposure from `8850` to current runtime port `8960`.
- Corrected `status`/`doctor` health probing to honor `CONSUELO_OS_PORT`, then `PORT`, then `8960`, using `127.0.0.1`.
- Updated a stale raw-steering test to the already-deployed three-tool surface: `get_steering`, `call`, and `mcp`. `origin/main` already reports those three tools.

## files changed

- `packages/os/CONTRIBUTING.md`
- `packages/os/Dockerfile`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/README.md`
- `packages/os/requirements.txt` (deleted)
- `packages/os/scripts/lib/workspace-state.js`
- `packages/os/server.py` (deleted)
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/os_server_steering_test.py` (deleted)
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/server_call_test.py` (deleted)

## validation evidence

- TDD red: 2 expected failures, 1 pass before removing Python/docs drift.
- Incremental TDD red: 1 expected failure after exposing the stale `localhost:8850` health probe.
- Focused Bun product-server contract: 4 passed.
- Local server/security regressions: 49 passed across Bun product server, MCP gateway, security gateway, dangerous-material policy, raw steering, steering traces, and runtime state.
- Installer/state regressions: 32 passed across installer runtime dependencies, install state, and repository defaults.
- `bun run --cwd packages/os typecheck`: passed (`workspace script syntax checks passed`).
- `bash -n packages/os/setup.sh` and `bash -n packages/os/scripts/start-consuelo-daemon.sh`: passed.
- Active runtime/doc search found no remaining `8850`, `8851`, `server.py`, or `requirements.txt` references in supported scripts/config/docs.
- `git diff --check`: passed.
- `review.run --base origin/main --no-tests`: passed with 0 findings.
- `verify --base origin/main`: passed with a publish-valid stamp; database guard reported 0 risks and 0 findings.
- The repository test selector selected zero suites for this surface, so the explicit 49 server/security and 32 installer/state assertions are retained as the behavioral evidence.
- Full package suite was attempted but is not a valid baseline gate: unrelated existing failures remain in TTY, task-hook/manifest, script-parity, media-boundary, trace, and facade suites. A facade snapshot generated during that failed run was restored immediately; no unrelated generated changes remain.

## key decisions

- Keep PR 1 behavior-preserving: no Hono local-server move and no prelaunch port hard cutover yet.
- Preserve specialized Python utilities; remove only the obsolete product-server path and its root dependency bundle.
- Historical review packets may continue to mention removed files as historical evidence; active docs must not.
- Treat the stale `os-raw-steering` two-tool assertion as test debt because current `origin/main` explicitly reports MCP as the third tool.

## issues and recovery

- `context.search` is unavailable in the current workspace manifest, so repository evidence came from `explore`, scoped reads, and targeted searches.
- Initial `fs.write` omitted the required overwrite flag; retried with `force: true`.
- Initial typecheck command used Bun arguments in the wrong order and printed help; reran as `bun run --cwd packages/os typecheck`, which passed.
- Generic `git.status` ignored task scoping and reported the main checkout; task-local status/diff were inspected through `code.call` in the task session.
- The all-package test run changed a facade snapshot before failing on unrelated baseline issues; the snapshot was restored and confirmed absent from the task diff.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(os): remove legacy Python product server" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-11 03:25:56 write: `.task/security/lock-bun-as-the-only-os-product-server/workpad.md`

## workspace-owned: files changed

- `packages/os/CONTRIBUTING.md`
- `packages/os/Dockerfile`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/README.md`
- `packages/os/requirements.txt` (deleted)
- `packages/os/scripts/lib/workspace-state.js`
- `packages/os/server.py` (deleted)
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/os_server_steering_test.py` (deleted)
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/server_call_test.py` (deleted)

## workspace-owned: activity log

- 2026-07-11 03:25:56 fs.write: `.task/security/lock-bun-as-the-only-os-product-server/workpad.md`

## workspace-owned: validation evidence

- TDD red: 2 expected failures, 1 pass before removing Python/docs drift.
- Incremental TDD red: 1 expected failure after exposing the stale `localhost:8850` health probe.
- Focused Bun product-server contract: 4 passed.
- Local server/security regressions: 49 passed across Bun product server, MCP gateway, security gateway, dangerous-material policy, raw steering, steering traces, and runtime state.
- Installer/state regressions: 32 passed across installer runtime dependencies, install state, and repository defaults.
- `bun run --cwd packages/os typecheck`: passed (`workspace script syntax checks passed`).
- `bash -n packages/os/setup.sh` and `bash -n packages/os/scripts/start-consuelo-daemon.sh`: passed.
- Active runtime/doc search found no remaining `8850`, `8851`, `server.py`, or `requirements.txt` references in supported scripts/config/docs.
- `git diff --check`: passed.
- Full package suite was attempted but is not a valid baseline gate: unrelated existing failures remain in TTY, task-hook/manifest, script-parity, media-boundary, trace, and facade suites. A facade snapshot generated during that failed run was restored immediately; no unrelated generated changes remain.
- 2026-07-11 03:26:22 `review.run`: passed — OK
- 2026-07-11 03:26:34 `verify`: passed — OK
- 2026-07-11 03:26:46 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/lock-bun-as-the-only-os-product-server/current.json`, `.task/security/lock-bun-as-the-only-os-product-server/evidence-log.json`, `.task/security/lock-bun-as-the-only-os-product-server/read-log.json`, `.task/security/lock-bun-as-the-only-os-product-server/session.json`, `.task/security/lock-bun-as-the-only-os-product-server/verify.json`, `.task/security/lock-bun-as-the-only-os-product-server/workpad.md`, `.task/tasks/security/lock-bun-as-the-only-os-product-server.json`, `packages/os/CONTRIBUTING.md`, `packages/os/Dockerfile`, `packages/os/README.md`, `packages/os/docs/runtime-surfaces.md`, `packages/os/requirements.txt`, `packages/os/scripts/lib/workspace-state.js`, `packages/os/server.py`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tests/os-raw-steering.test.ts`, `packages/os/tests/os_server_steering_test.py`, `packages/os/tests/server_call_test.py`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
