# implement windows platform support

branch: `task/os-native/implement-windows-platform-support`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1646/implement-windows-platform-support
github pr: https://github.com/consuelohq/opensaas/pull/1646
started: 2026-07-24

## acceptance criteria

- [x] Reject unsupported Windows editions, versions, and CPU architectures before mutating service or runtime state.
- [x] Provide a native PowerShell bootstrap that verifies downloaded bytes before execution and gives actionable execution-policy guidance.
- [x] Install or reuse Bun through the approved Bun-owned path and persist the resolved executable for service startup independent of interactive PATH.
- [x] Manage the Consuelo runtime as a least-privilege per-user Windows service boundary approved by the native architecture spike, with boot/logon persistence and bounded start/restart/status/uninstall behavior.
- [x] Map the logical `~/.consuelo/` layout onto the Windows user profile, support spaces/non-default profiles, and apply user-only ACLs to sensitive Consuelo-owned state.
- [x] Compose with the shared lifecycle engine for status, update, rollback, repair, diagnostics, and ownership-safe uninstall; do not fork release or channel logic.
- [x] Preserve workspace membership, node identity, provider credentials, and user-modified managed components during default uninstall.
- [x] Provide browser-first device authorization with a deterministic URL/code handoff when browser launch is unavailable.
- [ ] Prove native behavior on the registered `windows-2025` GitHub lane, including clean/no-Bun and existing-Bun paths, service persistence, ACLs, lifecycle integration, health, uninstall, and reinstall.
- [ ] Preserve existing distribution/lifecycle regressions, complete CodeRabbit and Grok review, record dispositions on PR #1646, and merge only into `stream/os-native`.

## plan

1. Read Workers 04, 05, and 18 plus the current lifecycle, native-client, installer, workflow, and test contracts on `main`.
2. Add behavior-first Windows tests and run the focused suite red before production code.
3. Implement a typed Windows platform adapter and minimal PowerShell bootstrap, reusing the shared lifecycle engine and native client contract.
4. Add only the registered `windows-2025` CI assertions and concise Windows support/security documentation required by the brief.
5. Run focused green tests, lifecycle/distribution regressions, type/static checks, review, verify, and the native Windows CI lane.
6. Push the task PR, request CodeRabbit, run the mandated Grok 4.5 wrapper, post every finding/disposition, and merge PR #1646 into `stream/os-native` only.

## Test-first contract

- Behavior under test: a native Windows user can bootstrap, authenticate, install/start/restart/diagnose/update/rollback/repair/uninstall/reinstall Consuelo OS without WSL, while unsupported hosts and integrity failures stop before mutation and service startup does not depend on interactive PATH.
- Existing local patterns: injected runners and stable results in `scripts/lib/lifecycle/service.ts`; immutable activation/rollback/uninstall tests under `tests/lifecycle-*`; typed native lifecycle client and architecture-spike tests; source-contract assertions in `tests/bootstrap-source.test.ts`; the registered distribution workflow matrix.
- New or changed tests: `packages/os/tests/windows-platform.test.ts`, focused PowerShell/bootstrap source assertions, and the existing workflow contract where required.
- Focused red command: `bun x vitest run tests/windows-platform.test.ts` from `packages/os`.
- Expected red failure: the Windows platform adapter and PowerShell bootstrap contracts do not exist.
- Native proof: the exact Windows-only behavior is accepted only from `.github/workflows/consuelo-os-distribution-environments.yaml` on `windows-2025`; macOS or Linux simulation is not a substitute.

## initial assumptions

- The task starts from `main`; review and verify use `origin/main`.
- Worker 20 is active in parallel. This task will not import or depend on its unmerged Linux implementation and will minimize overlap in shared files.
- Windows service scope is per-user and least privilege; machine-wide administration, MSIX/store packaging, and GUI work remain out of scope.

## current status

- The first native Windows run passed all TypeScript contracts, then exposed an MSBuild discovery issue on the VS2026 runner image. That route is repaired through `vswhere`. Interim Grok review independently found the same build issue plus a valid LocalService/Bun access defect; both are fixed and locally green. Refreshing verification and republishing before the authoritative Windows rerun and final current-head reviews.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/docs/windows-platform.md`
- `packages/os/native/windows-service/Consuelo.Windows.Service.csproj`
- `packages/os/native/windows-service/Program.cs`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.ps1`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/lifecycle/runtime-links.ts`
- `packages/os/scripts/lib/lifecycle/runtime-release-path.ts`
- `packages/os/scripts/lib/windows-platform.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/testing/windows-platform-acceptance.ps1`
- `packages/os/scripts/windows-platform.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/windows-bootstrap-source.test.ts`
- `packages/os/tests/windows-platform.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- RED: focused Windows suite failed on intentionally missing adapter/bootstrap/host/workflow/browser contracts (`trc_07aa9a9f01c3`).
- GREEN: Windows and workflow contract suite, 16 tests (`trc_345424ee2065`).
- GREEN: syntax checks plus 141 targeted lifecycle/distribution/installer regressions and formatting (`trc_1d344c41f8b3`). Existing corruption-contract stderr is intentional; Vitest exited 0 with all 141 tests passing.
- GREEN: focused Windows suite after contextual error handling, 15 tests (`trc_ad96fe876e1e`).
- GREEN: strict repository review against `origin/main`, zero findings after fixing all 12 initial contextual error-handling findings (`trc_be4491bc19e1`).
- RED: workflow contract failed until the Windows runner resolved MSBuild through Visual Studio Installer discovery (`trc_0779c10ba809`).
- GREEN: updated Windows/bootstrap/workflow contracts, 16 tests (`trc_a8d3612f363a`); supported-format Prettier check passed (`trc_5831e8d4e1e9`).
- RED: Grok CR-002 was reproduced by tests proving an external `.bun` path was not rejected and service-owned executables were retained on uninstall (`trc_f1ced0e904ed`).
- GREEN: protected service Bun copy, path-containment, and owned-artifact cleanup contracts, 16 tests (`trc_8f1929e6ba1a`).
- GREEN: post-finding strict review zero issues (`trc_cbb124fb4c24`), syntax (`trc_168fed5b4471`), and 142 lifecycle/distribution/installer regressions (`trc_c389ee5b46f0`). Existing corruption-contract stderr is intentional; Vitest exited 0.
- 2026-07-24 18:44:22 `review.run`: passed — OK
- 2026-07-24 18:45:29 `review.run`: passed — OK
- 2026-07-24 19:00:19 `review.run`: passed — OK
- 2026-07-24 19:04:16 `review.run`: passed — OK
- 2026-07-25 00:54:18 `verify`: passed — OK

## key decisions

- Keep one release/channel authority: Windows delegates immutable bundle verification, activation, health acceptance, rollback, repair, retention, and uninstall policy to the shared lifecycle engine.
- Use the Windows Service Control Manager with a non-interactive service, matching the accepted native-platform ADR. Require elevation only for service registration/removal, run under a least-privilege service identity, and keep secrets out of service arguments, environment registration, and the registry. Do not use Task Scheduler as a fallback.
- Treat `windows-2025` CI as the authoritative native host for service, ACL, PowerShell, and path behavior.
- Preserve signed bundle IDs as `sha256:<digest>` while mapping only the Windows release directory name to `sha256-<digest>`; activation uses directory junctions rather than privileged symbolic links.
- Keep public signing and reputation outside this worker: CI builds an unsigned service host for behavioral proof, while Worker 22 remains the Authenticode/release-artifact gate.
- Use Bun's approved installer or an existing Bun only as the source binary. Copy it into `%USERPROFILE%\\.consuelo\\bin\\bun.exe`, verify source/destination SHA-256 parity, and persist only that ACL-protected service path. Default service uninstall removes the protected Bun copy, service host, and service configuration without touching the user's Bun installation.

## notes for ko

- No Consuelo install/update/reset/restart/uninstall will be performed on the Mac Mini or MacBook Air. Any real-device validation remains an explicit human checkpoint.

## improvements noticed

- none yet

## issues and recovery

- Bootstrap `fs.read` was ambiguous with multiple active worktrees (`trc_cacf897549de`); explicitly selecting `main` still had no active task route (`trc_68086a5f0234`). Recovered through OS-scoped read-only `mac.read` against the canonical main checkout, then created the exact task session before any product edit.
- The first task-scoped `batch` did not propagate the outer task session to child file reads (`trc_b077fde50171`). A direct call with matching top-level and compatibility input session succeeded (`trc_53148cf45feb`), and subsequent batches use the same explicit child routing (`trc_16ee1eeaa29c`).
- Semantic explore results for the Windows adapter were stale/noisy (`trc_98f9d16be096`, `trc_26297aa518d5`). The recovery path is exact package-scoped search and direct reads of the lifecycle/native contracts, not guessing from retrieval.
- The first exact directory probe expected `packages/os/scripts/lib/platforms` and failed because no platform-adapter directory exists on `main` (`trc_549db41dbcfe`). Exact repository search then located the accepted ADR, native lifecycle contract, lifecycle controller, and Windows CI matrix; the Windows platform boundary will therefore be introduced as new code rather than inferred from a nonexistent directory.
- A follow-up batch probed nonexistent `packages/os/tsconfig.json` and `packages/os/native` paths (`trc_3e4a130f871d`, `trc_f26fc7a22b59`). Exact search confirmed no .NET/service host precedent in the package (`trc_55629329f27c`); the root TypeScript configuration remains authoritative and the native Windows service directory is new task-owned scope.
- The first focused green rerun had two remaining failures (`trc_b97be5de3ef4`): one source assertion incorrectly rejected an explanatory WSL message, and the native workflow step had not been added. The assertion was narrowed to reject only a `wsl.exe` dependency and the registered Windows acceptance lane was implemented; the next run passed (`trc_345424ee2065`).
- The first formatter invocation used unsupported `code.call` mode `write` and was rejected (`trc_f71a9d823ee8`). Retried with the typed `edit` mode and formatted all changed TypeScript files successfully (`trc_f48c458fd334`).
- Strict repository review initially reported 12 `ERROR_HANDLING` findings in the Windows controller/CLI (`trc_606ac65ffe5c`). Added local contextual wrapping at every async process/service boundary, reran focused tests and syntax, and received zero strict-review findings (`trc_be4491bc19e1`).
- A large workpad refresh patch missed a stale hunk after review automation had appended evidence (`trc_e11db7ddc252`). Re-read the current workpad and recovered with smaller anchored patches (`trc_372ca6f400cd`).
- The first publish attempt failed closed because the mandatory verify stamp was absent (`trc_ee0ff4dacbe3`). The advertised `task.call` route was unavailable in the live manifest, so the repository `bun run verify` workflow was run through task-scoped `code.call`; the first read-only invocation correctly rejected its stamp mutation (`trc_9bd754d9622d`), and the explicit edit-mode retry passed and wrote the publish-valid stamp (`trc_6c96f9074d28`).
- PR #1646 initially showed 300 unrelated files because `stream/os-native` was 98 commits behind the fresh-main task branch (`trc_7567bb88bb76`). `task.ensureSynced` confirmed drift (`trc_0ee80ff8c73c`). The first stream context fetch hit a remote-ref race (`trc_c8dd6de932c5`), and the first `stream.sync` call exposed an unsupported advertised `--repo` flag (`trc_2d9a6a01c27d`). Retrying the typed stream sync without that flag merged current main into `stream/os-native` with no conflicts and passing checks (`trc_3f89615ed036`), reducing the true task diff to 27 files (`trc_95a0496510fc`).
- The GitHub PR diff facade used unsupported `gh pr diff --stat` (`trc_32187df0b218`), then the PR diff endpoint retained a stale pre-sync 300-file cache and returned HTTP 406 (`trc_a8c80897841c`). Recovered by rendering the exact 27-file diff from the GitHub compare API (`trc_4d39974ba72d`).
- The first Grok wrapper transport timed out while the bounded subprocess continued. Process inspection confirmed the wrapper and Grok child were still active but their output remained attached to the dead transport (`trc_290bfc4d478f`, `trc_312e0088f15f`). The same mandated wrapper was restarted with task-local redirected output and bounded polling. It completed with exit `0`, a non-empty structured review, and two high findings: CR-001, bare `msbuild` discovery; and CR-002, LocalService executing Bun from the installing user's `.bun` directory. Both were accepted, reproduced, and fixed. Because the head changed, the result is interim and must be rerun on the published current head.
- The first `windows-2025` CI run passed all 15 Windows TypeScript tests, then failed because the VS2026 image no longer exposes `msbuild` on `PATH` (`trc_9253f8f0bc08`). Added a failing workflow contract (`trc_0779c10ba809`), changed the build step to resolve MSBuild through `vswhere.exe -requires Microsoft.Component.MSBuild`, and passed the focused contracts (`trc_a8d3612f363a`).
- The first combined CR-002 implementation patch missed a formatted TypeScript hunk (`trc_ed9e9537d2f2`). Re-read exact file ranges and recovered with smaller anchored patches (`trc_4f054e1a51dc`, `trc_a8eef29ed606`, `trc_9acd303cf36b`, `trc_02db22fbaba2`).
- A formatting check incorrectly included `.ps1` files, for which repository Prettier has no parser (`trc_2fd081b2d4c2`). TypeScript/YAML/Markdown formatting remains green; PowerShell parsing and execution stay delegated to the authoritative Windows runner.
- After resuming, `task.push` failed because the server-side active-task registry no longer recognized the existing session (`trc_38254c9c4f1a`). `task.init` restored branch/worktree metadata but did not restore the active registry (`trc_c7e05a7cbeb6`). Re-running the original `task.start` identity recovered the same branch, worktree, PR #1646, and exact session `tsk_54add4ed7243` without creating anything new (`trc_03de3fe06454`). That recovery reset the local workpad template; the complete published workpad was restored from GitHub through the task-scoped GitHub route (`trc_f99111ff57d0`, `trc_8cfd603d408f`) before reapplying unpushed evidence.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-native): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `AGENTS.md`
- `CODING-STANDARDS.md`
- `package.json`
- `packages/os/AGENTS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/docs/architecture/native-platform-spike.md`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/workers/04-lifecycle-engine.md`
- `packages/os/plans/consuelo-os-foundation/workers/05-retention-rollback-uninstall.md`
- `packages/os/plans/consuelo-os-foundation/workers/18-native-platform-spike.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/lifecycle/uninstall.ts`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`
- `packages/os/tsconfig.json`
- `packages/workspace/scripts/task-push.js`
