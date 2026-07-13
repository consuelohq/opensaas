# fix installer dependency UX and hook materialization

branch: `task/os/fix-installer-dependency-ux-and-hook-materialization`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/984/fix-installer-dependency-ux-and-hook-materialization
github pr: https://github.com/consuelohq/opensaas/pull/984
started: 2026-06-12

## acceptance criteria

- [ ] Include `packages/os/hooks/**` in installed OS materialization so installed `bun run intent` and `bun run task:hook` can resolve their runtime modules.
- [ ] Add installer and doctor validation that the installed OS has the required intent/task hook runtime modules.
- [ ] Collapse Bun/source/runtime dependency setup into one dependency gate with locked copy: `Consuelo OS needs its dependencies to continue.`
- [ ] Render dependency setup as the first vertical install step while preserving internal loading states.
- [ ] Preserve existing install behavior: Bun install if missing, source download/refresh, dependency install, then normal onboarding.
- [ ] Validate with focused red/green tests, installer smoke, review, verify, push, and promote into `stream/os`.

## plan

1. Explore bootstrap, install-state materialization, doctor checks, existing tests, and generated/runtime hook files. Done.
2. Add failing tests for hook materialization, doctor runtime checks, and dependency prompt/vertical UX. In progress.
3. Implement `hooks` as a product package directory and add runtime module validation.
4. Refactor bootstrap dependency setup into a single prompt/vertical step while preserving loading states.
5. Run focused tests and installed-package smoke for `intent` / `task:hook`.
6. Run review, verify, task.push, task.pr, and task.finish.

## Test-first contract

behavior under test:
- Provisioned local OS installs include the runtime `hooks/**` tree needed by `scripts/intent.js`, `scripts/task-hook.js`, and `scripts/task-start.js`.
- Doctor reports explicit health checks for `intent` and `task:hook` runtime modules instead of letting missing hooks surface later as module-resolution failures.
- Hosted bootstrap asks once for dependencies using exact copy, then executes Bun/source/runtime dependency setup under one vertical dependency step with loading states.

existing local pattern:
- `packages/os/tests/install-state.test.ts` already verifies installed home shape and materialized package directories/files.
- `packages/os/tests/bootstrap-source.test.ts` currently string-tests bootstrap source refresh behavior.
- `runDoctor()` in `packages/os/scripts/lib/install-state.ts` owns installed runtime health checks.
- `materializeProductPackageRoot()` in `install-state.ts` copies product package dirs listed in `PRODUCT_PACKAGE_DIRS`.

new or changed tests:
- Update `packages/os/tests/install-state.test.ts` to expect installed `hooks/intent.js`, `hooks/dispatcher.js`, `hooks/task/workflow.js`, and `hooks/task/guidance.js`; add doctor checks for `intent` and `task:hook` runtime modules.
- Update `packages/os/tests/bootstrap-source.test.ts` to lock the one dependency prompt, remove old source/dependency prompt text, and assert vertical dependency setup text/functions.

focused red command:
- `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts`

expected red failure:
- Installed home lacks `hooks/**`; doctor lacks intent/task-hook checks; bootstrap still has separate source/dependency prompts and old copy.

no-test waiver: not applicable.

## exploration notes

- `stream.context` confirmed `stream/os` is current and has recent OS/security merges.
- Existing PR #983 was open but `github pr.files` showed no changed files, so this task uses a new focused branch.
- Installed local E2E showed manifests/scripts present but `/Users/kokayi/.consuelo/os/hooks` absent; `bun run intent -- --workflow task --json` failed with `Cannot find module '../hooks/intent.js'`.
- Repo source has `packages/os/hooks/dispatcher.js`, `packages/os/hooks/intent.js`, `packages/os/hooks/task/workflow.js`, and `packages/os/hooks/task/guidance.js`.
- `bootstrap.sh` currently prompts separately for source download and runtime dependency install, with the old `We can download/setup this now.` / `We can install/setup this now.` copy.
- `bootstrap.sh` currently prompts separately for Bun install when Bun is missing.
- `install-state.ts` copies product dirs from `PRODUCT_PACKAGE_DIRS`; current list includes `scripts`, `src`, `tooling`, `manifests` and omits `hooks`.
- `runDoctor()` checks required directories and generated security files but has no explicit intent/task-hook runtime check.

## current status

- Implementation complete. Focused red and green tests captured. Installed-package smoke passes for doctor runtime checks, `bun run intent`, and `bun run task:hook`. Review and verify passed; task is ready to publish.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`

## validation evidence

- red: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts` failed with three expected failures: missing single dependency gate, missing installed `hooks/intent.js`, missing `runtime:intent` / `runtime:task-hook` doctor checks.
- green: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts` passed: 2 files, 15 tests.
- syntax/dry run: `bash -n packages/os/scripts/bootstrap.sh && bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json` passed.
- installed package smoke: provisioned temp OS home, `runDoctor()` reported `runtime:intent:connected,runtime:task-hook:connected`, installed `bun run intent -- --workflow task --task-session tsk_smoke --json` returned task workflow bundle with 12 tools, and installed `bun run task:hook -- --event-json <task.start preInvoke> --json` required `stream.context`.
- adjacent hook tests: `bun --cwd packages/os test tests/workflow-intent.test.ts tests/task-hook-dispatcher.test.ts` passed: 10 tests.
- legacy/contract hook tests: `bun --cwd packages/os test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts` passed: 9 tests.
- bootstrap dry-run smoke showed vertical dependency step and no old source/setup copy.
- review: `review.run --base origin/stream/os --scope changed` passed with 0 issues.
- verify: `verify --base origin/stream/os` passed and wrote a publish-valid stamp.

## key decisions

- `hooks/` remains a top-level runtime directory. `tooling/` remains source metadata/generator input; `manifests/` remains generated contracts; `hooks/` is executable workflow runtime.
- Dependency prompt is one gate. Internal setup steps remain distinct for reliability and progress visibility.
- The shell bootstrap renders the dependency row in the same vertical grammar, but the full Bun/Clack onboarding still begins after dependencies are present.
- Doctor now treats missing runtime hook modules as `unhealthy` so this packaging bug is caught before agents hit module-resolution errors.

## notes for ko

- This PR is intentionally installer/runtime packaging plus bootstrap UX. It does not rename hook/tooling architecture.

## issues and recovery

- `explore` returned unrelated command-menu hook results for the broad query. Current file evidence came from direct reads/listing after that retrieval miss.

- 2026-06-12 19:48:52 write: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: activity log

- 2026-06-12 19:48:52 fs.write: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`
- 2026-06-12 19:49:44 fs.write: `packages/os/tests/bootstrap-source.test.ts`
- 2026-06-12 19:51:09 fs.patch: `packages/os/tests/install-state.test.ts`
- 2026-06-12 19:51:42 fs.write: `packages/os/tests/install-state.test.ts`
- 2026-06-12 19:54:15 fs.write: `packages/os/scripts/bootstrap.sh`
- 2026-06-12 19:54:15 fs.write: `packages/os/scripts/lib/install-state.ts`
- 2026-06-12 19:59:55 fs.write: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`
- 2026-06-12 20:02:46 fs.patch: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`
- 2026-06-12 20:03:44 fs.patch: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`
- 2026-06-12 20:04:39 fs.patch: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-12 19:52:50 `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts`: failed exit 1 trace: `trc_b99752d1ab49`
  - output: [34mexpect[39m(intentCheck)[33m.[39m[34mtoMatchObject[39m({ status[33m:[39m [32m'connected'[39m })[33m;[39m [90m | [39m [31m^[39m [90m425| [39m [34mexpect[39m(intentCheck[33m?.[39mmessage)[33m.[39m[34mtoContain[39m([32m'hooks/intent.js'[39m)[33m;[39m [90m426| [39m [34mexpect[39m(taskHookCheck)[33m.[39m[34mtoMatchObject[39m({ status[33m:[39m [32m'connected'[39m })[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-12 19:54:15 write: `packages/os/scripts/bootstrap.sh`

- 2026-06-12 19:54:15 write: `packages/os/scripts/lib/install-state.ts`

## workspace-owned: TDD green evidence

- 2026-06-12 19:54:36 `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts`: passed exit 0 trace: `trc_a0b43aef2d8c`
  - output: → tmux: opensaas-os-fix-installer-dependency-ux-and-hook-materializa-474b10c6 $ vitest run tests/bootstrap-source.test.ts tests/install-state.test.ts


- 2026-06-12 19:59:55 write: `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`

## workspace-owned: validation evidence

- red: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts` failed with three expected failures: missing single dependency gate, missing installed `hooks/intent.js`, missing `runtime:intent` / `runtime:task-hook` doctor checks.
- green: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts` passed: 2 files, 15 tests.
- syntax/dry run: `bash -n packages/os/scripts/bootstrap.sh && bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json` passed.
- installed package smoke: provisioned temp OS home, `runDoctor()` reported `runtime:intent:connected,runtime:task-hook:connected`, installed `bun run intent -- --workflow task --task-session tsk_smoke --json` returned task workflow bundle with 12 tools, and installed `bun run task:hook -- --event-json <task.start preInvoke> --json` required `stream.context`.
- adjacent hook tests: `bun --cwd packages/os test tests/workflow-intent.test.ts tests/task-hook-dispatcher.test.ts` passed: 10 tests.
- legacy/contract hook tests: `bun --cwd packages/os test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts` passed: 9 tests.
- bootstrap dry-run smoke showed vertical dependency step and no old source/setup copy.
- 2026-06-12 20:00:43 `review.run`: passed — OK
- 2026-06-12 20:01:16 `verify`: passed — OK
- 2026-06-12 20:05:01 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-installer-dependency-ux-and-hook-materialization/current.json`, `.task/os/fix-installer-dependency-ux-and-hook-materialization/evidence-log.json`, `.task/os/fix-installer-dependency-ux-and-hook-materialization/explore-state.json`, `.task/os/fix-installer-dependency-ux-and-hook-materialization/read-log.json`, `.task/os/fix-installer-dependency-ux-and-hook-materialization/session.json`, `.task/os/fix-installer-dependency-ux-and-hook-materialization/verify.json`, `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`, `.task/tasks/os/fix-installer-dependency-ux-and-hook-materialization.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/lib/install-state.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/install-state.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
