# repair tracing site refresh and live history

branch: `task/os/repair-tracing-site-refresh-and-live-history`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2245/repair-tracing-site-refresh-and-live-history
github pr: https://github.com/consuelohq/opensaas/pull/2245
started: 2026-08-28

## acceptance criteria

- [x] Diagnose whether Consuelo OS and authenticated trace ingestion are healthy.
- [x] Recover the currently published Tracing surface without destructive restart or reinstall.
- [x] Prove the light/dark design and owner-only Admin route landed in the selected runtime.
- [x] Add a focused regression test before changing lifecycle behavior.
- [x] Refresh managed Sites from the selected active runtime after successful rolling reload, reload, and restart transitions.
- [x] Keep Sites refresh best-effort so presentation materialization cannot make the OS availability transition fail.
- [ ] Publish the verified change to the OS stream and complete review.

## plan

1. Verify local facade, worker pool, gateway, trace persistence, selected runtime, and generated Tracing artifact.
2. Regenerate the current Sites snapshot from runtime/current.
3. Add a failing lifecycle contract for post-transition Sites convergence.
4. Implement bounded best-effort Sites refresh in the canonical reload adapter.
5. Run focused and adjacent tests, review the diff, and publish.

## current status

- Local OS is healthy on v0.1.85 with both workers and Caddy listening.
- Trace ingestion remained live; the generated Tracing snapshot was stale, not the SQLite history.
- Current Sites refresh restored live history and regenerated light/dark/menu/admin markup.
- Persistent lifecycle fix is implemented and relevant tests are green.
- Awaiting formal review, verification, and publish.

## files changed

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- task metadata and this workpad

## workspace-owned: files changed

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## workspace-owned: validation evidence

- RED: `bun test packages/os/tests/lifecycle-restart-contract.test.ts` — new managed-Sites convergence contract failed because the helper and invocations did not exist.
- GREEN: `node --check packages/os/scripts/consuelo-reload.js && bun test packages/os/tests/lifecycle-restart-contract.test.ts` — 23 pass, 0 fail.
- GREEN: daemon Bun path, Observability Tracing site, workspace chrome, and lifecycle contract suites — 43 relevant passes.
- GREEN: `cd packages/os && bun test tests/sites-cli.test.ts` — 9 pass, 0 fail.
- The first root-level invocation of `sites-cli.test.ts` failed because that test owns a package-relative cwd contract; rerunning from `packages/os` passed completely.
- 2026-08-28 22:49:55 `review.run`: passed — OK
- 2026-08-28 22:50:04 `review.run`: passed — OK
- 2026-08-28 22:50:58 `verify`: passed — OK
- 2026-08-28 22:51:21 `verify`: passed — OK

## key decisions

- Keep Sites refresh best-effort and bounded at the existing `WORKSPACE_DAEMON_SITES_REFRESH_TIMEOUT_SECONDS` value.
- Execute `scripts/os.ts sites refresh --json` through `process.execPath` so the selected immutable runtime and renamed Consuelo Bun executable own materialization.
- Invoke refresh only after a successful service transition; do not weaken HA/health gates.
- Do not change the already-landed Tracing palette or Admin-route implementation: the browser screenshot was a stale in-memory document while the regenerated file already contained both.

## notes for ko

- A hard reload of `internal.consuelohq.com/tracing` is required because live trace polling can repopulate rows without reloading the document CSS or menu.
- The configured owner route is `Internal → Users & installs`; it is present in regenerated Tracing, Overview, Nodes, and Secrets HTML.
- The selected runtime contains the light-first palette and a dark `prefers-color-scheme` override.

## improvements noticed

- Public `consuelo sites ...` routing is not exposed even though the runtime command exists. This is adjacent and was not included in this focused lifecycle fix.

## issues and recovery

- Root-level Sites CLI test invocation used the wrong cwd and produced path-resolution failures; the unchanged suite passed from its documented package cwd.
- Historical stale generated HTML came from rolling reload preserving the supervisor, which skipped the daemon-start Sites refresh hook.

---

## Test-first contract

behavior under test: successful canonical rolling reloads regenerate managed Sites from the selected runtime so Tracing HTML cannot remain on an older theme or history client after an OS update
existing local pattern: packages/os/tests/lifecycle-restart-contract.test.ts source-contract assertions plus packages/os/tests/daemon-bun-path.test.ts managed Sites startup coverage
new or changed tests: focused lifecycle restart contract asserting the active runtime Sites refresh command exists and is invoked after successful rolling reload/reload paths without replacing the HA reload gate
focused red command: bun test packages/os/tests/lifecycle-restart-contract.test.ts
expected red failure: the canonical reload script does not yet define or invoke the active-runtime managed Sites refresh after rolling reload
no-test waiver: not applicable
