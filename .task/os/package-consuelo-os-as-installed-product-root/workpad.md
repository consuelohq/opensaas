# package consuelo os as installed product root

branch: `task/os/package-consuelo-os-as-installed-product-root`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/776/package-consuelo-os-as-installed-product-root
github pr: https://github.com/consuelohq/opensaas/pull/776
started: 2026-06-05
start point: `stream/os`
taskSession: `tsk_e33ae4a1d7de`

## acceptance criteria

- [x] Read repo steering, current task workflow, senior-engineer skill, and OS-local task/senior-engineer skills before production edits.
- [x] Investigate the current installer/bootstrap/package-root implementation before coding.
- [x] Fresh install/provision into a disposable home creates `~/.consuelo/os` as the package root, including `package.json`, `scripts`, `src`, `tooling`, `manifests`, `bin`, `tools`, `skills`, `runtime`, `cache`, `logs`, `runs`, `config.json`, and `consuelo.db`.
- [x] Installed root has no required `source/` layer and no duplicate `source/tools` or `source/skills` registries.
- [x] Generated wrappers in `~/.consuelo/os/bin` execute from `~/.consuelo/os` and do not point at the repo checkout, `~/.consuelo/source/opensaas`, or `~/.consuelo/os/source`.
- [x] Bun server/runtime entrypoint can be resolved from the installed OS package root.
- [x] All bundled tools from the full manifest still materialize under `tools/`; selected/default skills still materialize under `skills/`.
- [x] Focused tests prove the final installed filesystem layout and wrapper resolution.
- [x] Disposable install smoke runs wrapper help for `status` and `get_raw_steering`; `get_raw_steering '{}'` runs from installed root. `status '{}'` is bounded unsupported because the existing `status` facade still delegates to `bun run status -- --json`, which is not an installed `@consuelo/os` package script.
- [x] Validate with focused tests and review/verify gates matched to the change.
- [ ] Publish through task workflow and report the stream review PR.

## Test-first contract

Behavior under test:
- Installing/provisioning Consuelo OS into a disposable home produces `~/.consuelo/os` as the flat product package root.
- The install tree contains runtime implementation directories and installed registries directly under OS root.
- Generated wrappers run from OS root and avoid repo/source-layer fallback paths.
- The local server/runtime entrypoint is present and resolvable from OS root.

Focused red command:
- `bun --cwd packages/os test tests/install-state.test.ts`

Red result:
- `trc_aa4d428f1584`: failed with 1 test failure at the new product-root directory assertion; 9 existing install tests passed.

## implementation summary

- `provisionLocalOs()` now materializes the OS package root files/directories directly into the target home: `package.json`, `bun.lock`, `scripts`, `src`, `tooling`, and `manifests`.
- Required local home dirs now include `src`, `tooling`, and `manifests`; tests assert `scripts/server.ts` and `scripts/server.js` exist in the installed root.
- Bundled skill/tool metadata source paths are package-root relative, e.g. `manifests/tool.manifest.json` instead of repo-root paths.
- Generated `bin/*` wrappers resolve `OS_HOME` from `CONSUELO_OS_HOME`, `CONSUELO_HOME`, or the wrapper location, then `cd "$OS_HOME"` and execute `bun ./scripts/...`.
- Wrapper input handling now avoids Bash `${1:-{}}` brace parsing and uses an explicit default JSON branch.
- Hosted bootstrap keeps source/download staging outside `~/.consuelo/source/opensaas` by default and uses `OS_HOME` for post-install daemon and doctor commands.
- `install.ts` final next-step command now points `bun --cwd` at the installed OS root.

## files changed

- `.task/os/package-consuelo-os-as-installed-product-root/workpad.md`
- `.task/tasks/os/package-consuelo-os-as-installed-product-root.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/install-state.test.ts`

## validation evidence

- RED: `trc_aa4d428f1584` — `bun --cwd packages/os test tests/install-state.test.ts` failed on the new product-root shape assertion.
- GREEN: `trc_6c0fb5368a31` — `bun --cwd packages/os test tests/install-state.test.ts` passed 10 tests after package-root implementation.
- GREEN: `trc_face02a253db` — `bun test packages/os/scripts/onboarding-flow.test.ts packages/os/scripts/install-tty.test.ts packages/os/scripts/compact-daemon-output.test.ts` passed 21 tests.
- GREEN: `trc_67c4ef1e510e` — `bun run --cwd packages/os typecheck` passed.
- GREEN: `trc_db686bec56c2` — manifest/registry tests passed 16 tests.
- SMOKE: `trc_9cf1a543d43b` — disposable install created package root; `status --help` and `get_raw_steering --help` worked; `get_raw_steering '{}'` worked from installed root; `status '{}'` returned exit 1 due existing `workspace status` script dependency.
- FINAL GREEN: `trc_29306f792fb3` — syntax passed, install-state/tool-manifest/skills-registry/onboarding-skills passed 26 tests, script tests passed 21 tests.

## current status

- Implementation and focused validation are complete.
- Temporary patch helper files were removed from the task workpad directory.
- Diff inspected: `trc_61653ca2502f`.
- Review passed: `trc_b26e357f722c` with zero issues.
- Verify passed/publish-valid: `trc_6d7e42a47c86`; verify selected zero suites, but explicit focused test evidence is recorded above.
- Rebased onto current `origin/stream/os` after `task.pr` hit non-metadata conflicts: conflict was limited to `packages/os/tests/install-state.test.ts`; resolved by keeping the expanded package-root directory assertions.
- REBASE GREEN: `trc_222334bc2814` — syntax passed, install-state/tool-manifest/skills-registry/onboarding-skills passed 26 tests, script tests passed 21 tests.
- REBASE SMOKE: `trc_e7ddc36ad172` — disposable install wrapper help and `get_raw_steering` run passed; bounded `status` behavior unchanged.
- REBASE REVIEW: `trc_1bb3b7d9f935` passed zero issues.
- REBASE VERIFY: `trc_34e3cf88e3b9` publish-valid.
- Next: force/update push and promote/report the stream review PR.

## key decisions

- Treat `~/.consuelo/os` as the canonical installed product package root.
- Keep hosted source archive staging as an install-time mechanism only; post-install user-facing commands use the installed OS root.
- Preserve bundled tool/skill materialization behavior while switching installed metadata to package-root-relative paths.

## issues and recovery

- `code.run` is unavailable in this task worktree due `Cannot find module './lib/codemode/tools/index'`; used typed fs/search calls and focused `task.call` validation.
- Early line-based patches mangled `install-state.ts`; recovered by resetting that file and applying a deterministic rewrite.
- Bun script tests import `bun:test`, so they must run under `bun test` rather than the package Vitest script.
- `status '{}'` wrapper is bounded unsupported because the existing facade command delegates to a repo-root `status` script that is not present in the installed package.

---

## publish checklist

- [x] focused tests red recorded
- [x] focused tests green recorded
- [x] disposable install smoke recorded
- [x] `git.diff` inspected
- [x] `review.run` completed
- [x] `verify` completed or bounded waiver recorded
- [ ] `task.push` completed
- [ ] `task.pr` returned the stream review PR

- 2026-06-05 05:54:21 write: `.task/os/package-consuelo-os-as-installed-product-root/workpad.md`

## workspace-owned: files changed

- `.task/os/package-consuelo-os-as-installed-product-root/workpad.md`
- `.task/tasks/os/package-consuelo-os-as-installed-product-root.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: activity log

- 2026-06-05 05:54:21 fs.write: `.task/os/package-consuelo-os-as-installed-product-root/workpad.md`

## workspace-owned: validation evidence

- RED: `trc_aa4d428f1584` — `bun --cwd packages/os test tests/install-state.test.ts` failed on the new product-root shape assertion.
- GREEN: `trc_6c0fb5368a31` — `bun --cwd packages/os test tests/install-state.test.ts` passed 10 tests after package-root implementation.
- GREEN: `trc_face02a253db` — `bun test packages/os/scripts/onboarding-flow.test.ts packages/os/scripts/install-tty.test.ts packages/os/scripts/compact-daemon-output.test.ts` passed 21 tests.
- GREEN: `trc_67c4ef1e510e` — `bun run --cwd packages/os typecheck` passed.
- GREEN: `trc_db686bec56c2` — manifest/registry tests passed 16 tests.
- SMOKE: `trc_9cf1a543d43b` — disposable install created package root; `status --help` and `get_raw_steering --help` worked; `get_raw_steering '{}'` worked from installed root; `status '{}'` returned exit 1 due existing `workspace status` script dependency.
- FINAL GREEN: `trc_29306f792fb3` — syntax passed, install-state/tool-manifest/skills-registry/onboarding-skills passed 26 tests, script tests passed 21 tests.
- 2026-06-05 05:55:12 `review.run`: passed — OK
- 2026-06-05 05:55:32 `verify`: passed — OK
- 2026-06-05 06:06:34 `review.run`: passed — OK
- 2026-06-05 06:06:48 `verify`: passed — OK
- 2026-06-05 06:09:12 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/package-consuelo-os-as-installed-product-root/current.json`, `.task/os/package-consuelo-os-as-installed-product-root/evidence-log.json`, `.task/os/package-consuelo-os-as-installed-product-root/read-log.json`, `.task/os/package-consuelo-os-as-installed-product-root/session.json`, `.task/os/package-consuelo-os-as-installed-product-root/verify.json`, `.task/os/package-consuelo-os-as-installed-product-root/workpad.md`, `.task/tasks/os/package-consuelo-os-as-installed-product-root.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/install-state.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
