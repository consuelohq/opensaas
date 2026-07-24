# Worker 30 workpad: split Consuelo OS and Consuelo Dialer CLI products

## Task identity

- Assigned stream: `stream/os-distribution`
- Task branch: `task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products`
- Task session: `tsk_9dbc06d95dc7`
- Task PR: https://github.com/consuelohq/opensaas/pull/1647
- Graphite PR: https://app.graphite.com/github/pr/consuelohq/opensaas/1647/split-consuelo-and-consuelo-dialer-cli-products
- Synchronized stream base SHA: `ef4b0f0352c4eb8bcc5248be7c7962c7fb2968b1`
- Environment lane: task worktree plus registered GitHub clean-host/native CI matrix. No install, update, reset, restart, uninstall, global install, or publish on Ko's Mac Mini or MacBook Air.

## Acceptance criteria

- [ ] `consuelo` is a thin OS lifecycle CLI exposing the Worker 04 lifecycle contract: install, status, restart, update, channel, repair, rollback, node, uninstall, and dev reset, with existing structured JSON/quiet/error behavior preserved where applicable.
- [ ] `consuelo-dialer` preserves the existing sales/GTM command surface, including contacts, calls, queues, coaching, analytics, GTM deployment, and Twenty-connected commands.
- [ ] The OS CLI runtime dependency graph excludes dialer, Twilio, coaching, analytics, contacts, GTM deployment, and Twenty SDK/runtime dependencies.
- [ ] OS configuration remains `~/.consuelo/consuelo.yaml`; the dialer continues to use its existing config loader and is moved to a clearly dialer-owned namespace without discarding or reinterpreting existing settings.
- [ ] `consuelo restart` delegates to the one Worker 04 lifecycle engine and retains healthy, stopped, failed, and timeout behavior.
- [ ] The old mixed `consuelo os ...` registration path and all internal/docs/installer references are removed in the same cutover; no compatibility shim or duplicate authority remains.
- [ ] Runtime-bundle allowlists include the OS CLI and exclude the dialer product graph.
- [ ] Existing dialer commands are not deleted or functionally weakened.
- [ ] Focused tests, package checks, required distribution/clean-host CI, workspace review, full verify, CodeRabbit, and Grok 4.5 review are green or have explicit verified dispositions.
- [ ] Task PR is merged only into `stream/os-distribution`; the stream is not promoted to `main` and no downstream worker is started.

## Plan

1. Search project memory and Worker 28 durable findings, then map current CLI package ownership, command registration, config, telemetry/errors, package names, lifecycle entrypoints, and runtime-bundle allowlists.
2. Add characterization and new behavioral tests first for binary ownership, command preservation, dependency isolation, config separation, lifecycle delegation, old-reference removal, and bundle inclusion/exclusion.
3. Run the focused tests red and record the expected failures.
4. Implement the smallest clean pre-launch cutover with explicit OS and dialer package/bin boundaries, preserving the sales implementation and reusing Worker 04 lifecycle adapters.
5. Run focused green tests, package type/build/test checks, distribution tests, registered CI, `review.run`, and `verify` against `origin/stream/os-distribution`.
6. Push the independently reviewable task PR, request CodeRabbit, render/run the mandated Grok 4.5 review, post all review evidence and dispositions, clean temporary review artifacts, and merge the task PR into the assigned stream only.

## Test-first contract

- Behavior under test: the `consuelo` executable resolves only to the OS lifecycle product; `consuelo-dialer` retains every existing sales command; the two binaries use separate dependency/config boundaries; lifecycle output and restart semantics remain stable; bundle construction includes only the OS CLI.
- Existing local patterns to follow: `packages/cli` command-registration and CLI test helpers; Worker 04 lifecycle CLI/process tests in `packages/os/tests`; runtime-bundle allowlist/inventory tests under `packages/os/tests/distribution` and related bundle scripts.
- New or changed tests: `packages/os/tests/cli-product-split.test.ts` for package/bin ownership, dependency isolation, dialer command preservation, config migration, lifecycle CLI dispatch/structured output/node redaction, and stale-reference removal; `packages/os/tests/distribution/runtime-bundle.test.ts` for required OS lifecycle CLI inclusion and dialer CLI exclusion; existing restart regression files remain part of the focused lane.
- Focused red command: `bun run --cwd packages/os test -- tests/cli-product-split.test.ts tests/distribution/runtime-bundle.test.ts tests/lifecycle-restart-contract.test.ts tests/consuelo-reload.test.ts`.
- Expected red failure: current `packages/cli` still owns the `consuelo` binary and registers both sales and OS commands; its runtime dependencies include dialer/Twilio/Twenty/coaching/GTM packages; the runtime bundle does not yet own a final standalone OS binary contract.
- No-test waiver: none. This is a product-boundary and executable-contract change and requires behavioral tests first.

## Key decisions

- The binary names are fixed by the approved plan: `consuelo` for OS lifecycle and `consuelo-dialer` for sales/GTM. Registry reads on 2026-07-24 returned 404 for `@consuelo/os-cli`, `@consuelo/dialer-cli`, `@consuelo/os`, and `@consuelo/cli` (`trc_f8c2bd2e9617`). The implementation will keep the existing OS runtime package name `@consuelo/os` as the lifecycle-binary owner and rename the existing mixed CLI package to `@consuelo/dialer-cli`; this avoids a new cross-package runtime dependency while establishing explicit product ownership. No package is published or globally installed.
- The public curl bootstrap remains a thin installation entrypoint. It must not become a second lifecycle implementation.
- The split is a clean pre-launch cutover. No `consuelo os ...` alias or path shim will be retained after references and tests are migrated.
- The read-only `consuelo node` command will read the existing typed `consuelo.yaml` and `node/node.yaml` stores and emit only safe node metadata. Mutating commands continue to route exclusively through Worker 04's lifecycle engine.
- Dialer config values will be preserved through the existing loader; only ownership/path naming may change after current migration behavior is characterized.

## Current status

- Governance, Worker 30 brief, Worker 04 lifecycle contract, Worker 28 brief, environment registry, repository standards, OS task/senior skills, and review template are fully read.
- Stream synchronized to current main and isolated task session/PR created.
- Current-code mapping and Worker 28 evidence are complete.
- Focused red is durable at `trc_73f30364af0e`: 8 expected failures and 28 passes across 4 files. The missing contracts are OS package bin ownership, dialer package/bin/help ownership, removal of the mixed OS command, dialer config migration/path ownership, dialer-specific globals, OS help/node dispatch, and lifecycle CLI bundle-required input.
- Existing regression evidence stayed green in red phase: all 6 lifecycle restart contract tests, both canonical `consuelo-reload` tests, and 18 existing runtime-bundle tests passed.
- Focused green is durable at `trc_c1427b5ad39c`: 4 files and all 36 tests passed, including the new split/config/node/bundle contracts, all 6 lifecycle restart tests, both canonical reload tests, and the real customer runtime closure parity test.
- An intermediate green run had only the process-level dialer help test failing because Vitest's `process.execPath` was not the Bun executable in that environment (`trc_43ccaeaf4d95`); direct evidence showed the product command itself was healthy (`trc_ebb0c440f2b2`). The test now invokes the registered Bun runtime explicitly.
- OS syntax/type validation and the final focused suite are green at `trc_15ef8b50dae5` and `trc_a74c1b335b00` (36/36). The latter also asserts that Twenty `ConfigService` and `registerCommands` integration remains in the dialer entrypoint.
- Nx recognizes the renamed package as project `@consuelo/dialer-cli` rooted at `packages/cli`, with build/dev/clean/typecheck/release targets (`trc_d299ea3f061d`). The same diagnostic initially guessed incorrect Twenty function names; direct source inspection at `trc_31304819c91e` established the actual preserved `registerCommands` contract.
- The live operational-reference audit found zero stale `@consuelo/cli`, old mixed lifecycle invocations, old dialer invocations, old binary paths, or old global-state names (`trc_f0949aef2676`). Historical plans/review evidence remain unchanged.
- Full distribution validation is green at `trc_bfe5e93f3843`: 11 files passed, 1 file skipped by its existing TODO contract, 77 tests passed, 7 TODOs. The first run exposed a valid synthetic release-publication fixture gap (`trc_4ace14bcc718`); adding `scripts/lifecycle.ts` to that fixture closed it.
- The full verify initially surfaced 12 mechanical related-pre-existing findings in touched dialer files: 10 namespace imports and 2 unnecessary async Commander actions (`trc_84fe92305e66`, detailed at `trc_a024f4043412`). All were repaired without behavior changes; a residual scan is clean (`trc_893f675ee9e7`) and the focused gate remains green with 37/37 at `trc_babae2f1a99a`.
- Post-repair strict review is clean for this change at `trc_99faeec3486b`: 0 owned issues, 0 blockers, 0 failed test suites in review-only mode. Three shared-worktree typecheck issues remain classified pre-existing: two unresolved `twenty-sdk/cli` declarations and Twenty-front dependency-chain resolution.
- Post-repair full verify at `trc_fe95234312cf` reports 0 owned issues, 0 related issues, 0 database risks, and no must-fix findings. It still fails closed on the same three pre-existing typecheck issues plus Twenty-front's unrelated broad test suite (170 failures) because the shared worktree lacks its generated ESLint/dependency artifacts. The registered clean-host GitHub matrix is the authoritative completion gate.
- First reviewable commit `2041cd12143dc70a54793ded529d2657dfb52387` was pushed to PR #1647 (`trc_7bc915b4978a`). The implementation/recovery record and CodeRabbit request are durable at https://github.com/consuelohq/opensaas/pull/1647#issuecomment-5073702577 (`trc_83dd163b5836`).
- The first GitHub matrix exposed one task-owned failure: `danger-js` rejected the manually edited `yarn.lock` because Yarn needed to regenerate the workspace descriptor ordering/consolidation after the package rename (`trc_207444b996a2`, log evidence `trc_5e8c05620aa2`).
- `yarn install --mode=update-lockfile` regenerated only `yarn.lock` (`trc_b3f7cd36ba47`); the exact diff cleanly replaces the old `@consuelo/cli` workspace block with `@consuelo/dialer-cli` and its new bin (`trc_35c69478ec89`). A clean `yarn install --immutable` now succeeds with no net tracked mutation at `trc_55cbfc6230c9`.
- The post-lock corrective gate is green at `trc_89a76ad47ee0`: the correct Nx dependency order builds `twenty-sdk`, then `@consuelo/dialer-cli` typecheck and build pass, followed by all 37 focused tests. A temporary ignored package-local SDK link was created only for validation because the task worktree root `node_modules/twenty-sdk` remains physically anchored to the base checkout; the link was removed automatically and no files changed.
- Next: push the lockfile correction, rerun the registered GitHub matrix, collect CodeRabbit, then run/post/dispose the mandated Grok review.

## Files changed

- `packages/cli/bin/consuelo-dialer.js`
- `packages/cli/bin/consuelo.js` (deleted)
- `packages/cli/package.json`
- `packages/cli/src/api-client.ts`
- `packages/cli/src/commands/analytics.ts`
- `packages/cli/src/commands/call.ts`
- `packages/cli/src/commands/coach.ts`
- `packages/cli/src/commands/contacts.ts`
- `packages/cli/src/commands/deploy.ts`
- `packages/cli/src/commands/files.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/kb.ts`
- `packages/cli/src/commands/os.ts` (deleted)
- `packages/cli/src/commands/update.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/output.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/cli-product-split.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts`
- `yarn.lock`

## Notes for Ko

- No real-machine lifecycle command, global install, npm publish, or package-name reservation has been attempted.

## Improvements noticed

- None yet.

## Issues and recovery

1. The initial unscoped parallel `fs.read` could not choose among many active worktrees (`trc_d5c592b3c7d0` and child traces). An explicit `branch: main` retry also failed because task-scoped file reads require an active task (`trc_5c83588e7988`). Recovery: used bounded OS `code.call` read mode against local main only to load governance files, then synchronized the assigned stream and created the exact task session before all product work. No native Git, unscoped shell, another computer, provider substitution, or legacy workspace connector was used.
2. A combined governance read exceeded the response display budget and was truncated (`trc_d3f1fbf4dd9a`, `trc_2a23dc151c20`). Recovery: reread every required document in bounded line ranges and verified the two senior-engineer copies differ only in five OS/workspace wording lines (`trc_546fc4e8c19a`, `trc_cf10124d185c`, `trc_0e3f855413fb`, `trc_6c47b5d9903c`, `trc_e9f931dbd2b4`, `trc_4f69c6f8c80b`, `trc_315875c73fe4`).
3. `decideNext` treated an inline context string as a file path and failed (`trc_b48bae34d9c0`). Recovery: retried with the typed empty input (`trc_96ed2f922f9b`). Its global evidence index recommended unrelated work and scored confidence 0.30 (`trc_8cd06e11f187`), so repository-local Worker 28, lifecycle, package, help-output, and runtime-bundle evidence remained authoritative.
4. `exploit` failed twice with an opaque `unknown error`, first with an explicit target and then with query-only corrected input (`trc_e0e8d7124ef7`, `trc_30c6f71a0f00`). The prescribed retry path was exhausted; implementation remains in scope because direct typed reads, process-level help output, package manifests, and existing tests identify the editing targets unambiguously.
5. A workpad patch missed because task tooling had appended workspace-owned sections after the earlier snapshot (`trc_c04a9c81799b`). Recovery: reread the current file and applied a narrower patch against exact current text.
6. The steering/task documentation advertised a scoped `task.call` route, but the live OS manifest rejected that tool as unavailable during the red run. Recovery: searched the live manifest for a typed test runner, then executed the exact locked command through task-scoped `code.call` in verify mode. This preserved the task worktree boundary and produced red evidence at `trc_73f30364af0e`; no native shell or unscoped fallback was used.
7. A parent-scoped `batch` call did not propagate `taskSession` into its nested `fs.read` steps and failed every child with ambiguous task selection (`trc_c3518461e5d6`; child traces `trc_20082e4568d9`, `trc_3d91f63a7a8c`, `trc_7517f3af3f3c`, `trc_4c06309f07c5`, `trc_a4e3b14461d6`). Recovery: stopped using nested batch reads and passed `taskSession` explicitly on each direct OS call.
8. The first deploy-source patch missed because the source contains escaped backticks (`trc_c6b874005e23`). Recovery: reread the exact source range (`trc_aab7177d9a11`) and applied an anchored patch with the literal escaping (`trc_99af393fd77a`).
9. Direct dialer typecheck/build initially failed because the task worktree's shared root `node_modules/twenty-sdk` resolves to the base checkout rather than this worktree (`trc_2522f3f8e4f7`, `trc_a7afbb7e744e`). A direct SDK package build was also the wrong lane because its package script invokes Vite without the Nx library configuration (`trc_cda69460e684`). Recovery: `yarn nx build twenty-sdk` succeeded; a temporary worktree-local path override then showed unrelated pre-existing Bun `child_process` typing errors (`trc_e38fa97dc958`, `trc_42015d8fa255`, `trc_f0f7eab72741`). The experimental dev-command annotation was reverted (`trc_54fc3df9617c`). The clean-host GitHub matrix, where workspace links are created from the checked-out commit, remains the authoritative dialer build/type lane.
10. A repository status call ignored the provided task session and reported the base checkout (`trc_66729831059e`). Recovery: used task-scoped `git.diff` working-tree mode, which resolved the correct task branch/worktree and returned the complete 31-file diff (`trc_bea6c83cf614`). The initial revision-mode diff was correctly empty because changes were uncommitted (`trc_cd0a526e172e`).
11. The first complete distribution run failed one release-publication test because its synthetic runtime fixture lacked the newly required `scripts/lifecycle.ts` (`trc_4ace14bcc718`). Recovery: updated the fixture and reran the exact registered command successfully (`trc_bfe5e93f3843`).
12. The first strict workspace review exceeded the facade timeout without returning a result. Recovery: reran the same strict review without duplicate tests; it completed at `trc_a6c45f1264cc`, and tests remained separately durable.
13. Full verify identified 12 mechanical related-pre-existing findings in files already touched: namespace Node imports and unnecessary async wrappers (`trc_84fe92305e66`). Recovery: converted only the referenced imports to named imports and returned existing promises directly. Two source-guess patches missed and were corrected after exact reads (`trc_8f5567f1c39f` → `trc_259dadd823aa`/`trc_e56cec47a003`; `trc_aa85b9cffd11` → `trc_9d83f3a5fbfd`/`trc_a8424592cc9f`). Review is now clean (`trc_99faeec3486b`).
14. The raw-review extraction command used a heredoc and was rejected by the typed runner (`trc_4d8a48c1bd53`). Recovery: wrote the review JSON with a plain scoped command (`trc_eade7d73963b`) and parsed it through a separate Bun read (`trc_a024f4043412`).
15. Post-repair full verify still fails closed only on shared-worktree pre-existing infrastructure: unresolved `twenty-sdk/cli` declarations, missing Twenty ESLint generated config, and the resulting unrelated Twenty-front suite (`trc_fe95234312cf`). No task-owned or related findings remain. Completion requires the registered clean-host CI matrix rather than a provider or machine substitution.
16. After the first push, `task.current` could not recover the task from ambient state (`trc_de1355e86f24`). Recovery: read the committed task session metadata and recovered the exact task worktree path and session (`trc_5f5337959814`); all subsequent calls continue to carry `tsk_9dbc06d95dc7` explicitly.
17. The first raw GitHub PR-comment call was rejected because the raw facade requires a reason when no typed comment operation exists (`trc_b2b08f6edd40`). Recovery: retried with the required audit reason and posted the durable implementation/failure record plus `@coderabbitai review` (`trc_83dd163b5836`).
18. GitHub `danger-js` failed because the hand-edited lockfile was not Yarn's canonical result after renaming the workspace package (`trc_207444b996a2`, `trc_600590563ff5`, focused tail `trc_5e8c05620aa2`). Recovery: regenerated the lockfile in the task worktree with `yarn install --mode=update-lockfile` (`trc_b3f7cd36ba47`) and proved the resulting graph with `yarn install --immutable` (`trc_55cbfc6230c9`).
19. The first immutable verification completed successfully but Yarn's link step changed only the executable bit on `packages/twenty-sdk/bin/twenty.mjs`, causing the mutation-aware verify wrapper to fail (`trc_1c2cf09c1f9e`, `trc_0f8d914c28f4`). An attempted immutable lock-only combination was invalid (`trc_bba839bcc0f6`). Recovery: restored the committed mode and wrapped the immutable install with a final mode normalization; the command then exited 0 with zero net file changes (`trc_55cbfc6230c9`).
20. Direct dialer Nx typecheck after the immutable install still resolved `twenty-sdk/cli` through the base checkout's physical root `node_modules` path (`trc_aee99e6f5102`, diagnosis `trc_ef811eb0b9b9`). Recovery: built the SDK in the task worktree, created a temporary ignored `packages/cli/node_modules/twenty-sdk` link to the task-local package, ran the actual Nx typecheck/build dependency lane plus all 37 focused tests, and removed the link through a shell trap. The complete gate passed with no tracked changes (`trc_89a76ad47ee0`).

## Workspace-owned: files changed

- `packages/cli/bin/consuelo-dialer.js`
- `packages/cli/bin/consuelo.js` (deleted)
- `packages/cli/package.json`
- `packages/cli/src/api-client.ts`
- `packages/cli/src/commands/analytics.ts`
- `packages/cli/src/commands/call.ts`
- `packages/cli/src/commands/coach.ts`
- `packages/cli/src/commands/contacts.ts`
- `packages/cli/src/commands/deploy.ts`
- `packages/cli/src/commands/files.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/kb.ts`
- `packages/cli/src/commands/os.ts` (deleted)
- `packages/cli/src/commands/update.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/output.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/cli-product-split.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts`
- `yarn.lock`

## Workspace-owned: activity log

- 2026-07-24 19:12:24 fs.write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- 2026-07-24 19:17:21 fs.write: `packages/os/tests/cli-product-split.test.ts`
- 2026-07-24 19:22:19 fs.write: `packages/cli/bin/consuelo-dialer.js`
- 2026-07-24 19:22:22 fs.trash: `packages/cli/bin/consuelo.js`
- 2026-07-24 19:22:24 fs.trash: `packages/cli/src/commands/os.ts`
- 2026-07-24 19:56:34 fs.write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- 2026-07-24 20:00:46 fs.write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- 2026-07-24 20:00:58 fs.write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- 2026-07-24 20:11:19 fs.write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- 2026-07-24 20:13:08 fs.write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- Managed by task tooling below this line when present.

## Workspace-owned: validation evidence

- Managed by task tooling below this line when present.
- 2026-07-24 19:12:24 write: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
- 2026-07-24 19:34:01 `review.run`: passed — OK
- 2026-07-24 19:35:22 `verify`: failed — COMMAND_FAILED
- 2026-07-24 19:39:36 `review.run`: passed — OK
- 2026-07-24 19:40:36 `verify`: failed — COMMAND_FAILED
- 2026-07-24 20:12:02 `review.run`: passed — OK
- 2026-07-24 20:13:01 `verify`: failed — COMMAND_FAILED

## workspace-owned: files read

- `packages/cli/bin/consuelo.js`
- `packages/cli/package.json`
- `packages/cli/src/commands/deploy.ts`
- `packages/cli/src/commands/dev.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/output.ts`
- `packages/os/plans/consuelo-os-foundation/workers/30-cli-product-split.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/cli-product-split.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/twenty-sdk/package.json`
- `packages/twenty-sdk/project.json`

- 2026-07-24 20:10:05 apply-patch: `packages/cli/src/config.ts`
## Reviewer findings and dispositions

### CodeRabbit final review on head `00a8b93d`

1. `packages/cli/src/commands/kb.ts`: the FILE_NOT_FOUND recovery command omitted the required upload path. **Valid.** Added `consuelo-dialer files upload <path>` and a source-level regression.
2. `packages/os/scripts/lifecycle.ts`: the `consuelo` bin target was mode `100644`, so direct execution/package bin linking was not guaranteed. **Valid.** A temporary versioned package copy proved npm preserved the non-executable source mode in the tarball (`trc_285806442f38`). Changed the source mode to `100755` and added an executable-mode regression.
3. `packages/cli/src/config.ts`: concurrent first-run migration could throw `EEXIST` after the pre-check. **Valid.** Migration now treats only `EEXIST` as successful concurrent completion, still enforces mode `0600`, and rethrows all other filesystem errors. Added deterministic race and non-EEXIST regressions.
4. `packages/os/scripts/lifecycle.ts`: replace raw `Error` construction with the shared CLI helper. **Not valid for Worker 30.** The only repository CLI error helper is dialer-owned (`packages/cli/src/errors.ts`) and imports Sentry/dialer output globals. Importing it would violate the acceptance criterion that the OS lifecycle dependency graph exclude dialer/telemetry runtime dependencies. Worker 04's adapter already catches these errors and renders stable JSON/text envelopes with non-zero exit codes. No duplicate OS error framework is introduced in this split.

Review-fix TDD evidence:
- Red: exactly 3 new expected failures and 7 passes (`trc_836ee8c6bb9a`).
- Green: 5 files and all 38 focused tests pass (`trc_6b6405602e73`).
- Fix traces: KB command `trc_a62e102c12d7`; EEXIST-safe migration `trc_bccee2668c49`; executable mode `trc_17157f49a17b`.

### Grok 4.5 execution status

- The first mandated wrapper outlived the outer OS facade timeout, then exited with an empty output file. It was failed closed after a bounded poll (`trc_e1d1df3b3ff1`).
- The diagnostic rerun of the exact mandated wrapper completed with exit `0` and a non-empty 28,999-byte wrapper result (`trc_248e1378f905`; wrapper trace `trc_0a2aefc9ebcd`). The provider's nested text transport was truncated at 8,028 characters, so the structured review was not complete and has not been posted.
- The visible partial Grok review independently identified the valid EEXIST race and also proposed redesigning the public installer. The installer finding is outside this worker's approved boundary: the brief explicitly requires the public curl installer to remain unchanged and states this task is not an installer redesign.
- Required next action: after the CodeRabbit fixes are pushed, rerender against the final head and rerun Grok with the same mandated wrapper plus a compact structured-output limit so the complete review can be validated and posted.

- 2026-07-24 20:11:19 append: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`

### Post-review validation

- OS syntax/type and complete distribution suite are green: 77 passed with 7 existing TODOs (`trc_502190029e1f`). The first combined call accidentally supplied `packages/os` both as runner CWD and command path and failed before execution (`trc_6b9a5acc3ab1`); corrected typed input passed.
- Task-local dependency validation is green: `twenty-sdk` build, `@consuelo/dialer-cli` Nx typecheck, and dialer Nx build all pass (`trc_b9dce0e74117`). The temporary ignored package-local SDK link was removed automatically.
- Strict review after CodeRabbit fixes reports 0 owned issues and 0 blockers (`trc_e6a7d9ac9b96`). The sole pre-existing issue remains Twenty-front's missing generated ESLint/typecheck dependency in the shared worktree.
- Full verify after CodeRabbit fixes reports 0 owned issues, 0 related issues, 0 database risks, and no must-fix findings (`trc_015d4ca4ba33`). It fails closed only on the previously documented Twenty-front shared-worktree typecheck/test infrastructure (170 unrelated failures); GitHub clean-host CI remains authoritative.

- 2026-07-24 20:13:08 append: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`
