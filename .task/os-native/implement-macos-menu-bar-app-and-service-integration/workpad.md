# implement macos menu bar app and service integration

branch: `task/os-native/implement-macos-menu-bar-app-and-service-integration`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1666/implement-macos-menu-bar-app-and-service-integration
github pr: https://github.com/consuelohq/opensaas/pull/1666
started: 2026-07-26

## acceptance criteria

- [x] A SwiftUI `MenuBarExtra` target builds on the assigned `macos-26` arm64 lane without production signing credentials.
- [x] The app consumes the shared typed lifecycle snapshot/request contract and never calls `launchctl`, installers, shell commands, or CLI prose.
- [x] Stable presentation covers not installed, installing, healthy, degraded, update available, updating, rollback available, repair required, retained/offline state, and explicit destructive confirmations.
- [x] Update, repair/retry, rollback, restart, notification/channel preferences, diagnostics export, default-node selection, and uninstall map to allowlisted lifecycle requests.
- [x] Workspace/node rendering accepts only Worker 25 safe metadata and fails closed on secret-bearing fields.
- [x] Redacted diagnostics are support-safe and representative credentials are removed.
- [x] Closing the app only cancels its subscription and never emits a stop/unload request.
- [x] Swift unit/contract/presentation/process/redaction/node tests pass, existing TypeScript lifecycle tests pass, and a clean local alpha `.app` packaging smoke passes.
- [x] The distribution workflow runs Swift tests and alpha packaging only on the registered `macos-26` lane and uploads the development app artifact.
- [x] No install, restart, update, reset, or uninstall is performed on Ko's Mac Mini or MacBook Air; the final report supplies a human checkpoint only.

## plan

1. Extend the existing native lifecycle tagged-union contract only where Worker 19 requires additional menu actions and safe workspace/node state.
2. Add failing Swift behavioral tests and workflow/package contract tests before implementation.
3. Implement a Swift package with a testable core, framed owner-local Unix-socket transport, SwiftUI menu-bar shell, strict secret-field rejection, and diagnostics redaction.
4. Add macOS-only CI build/test/alpha-package steps without installation or production signing.
5. Run focused and regression validation, review the diff, publish PR evidence, request CodeRabbit, resolve findings, and merge only into `stream/os-native`.

## current status

- Governing plan, environment registry, Worker 19 brief, review template, Workers 04/05/18/24/25 outputs, repository standards, lifecycle client/types/tests, safe node projection, and distribution lane have been read.
- Architecture and test-first contract are defined.
- RED is complete: the zero-dependency Swift contract runner now compiles far enough to fail exclusively on the intentionally missing lifecycle models, command mapper, framed transport, safe-node decoder, diagnostics redactor, and lifecycle client (`trc_250b63e8199a`).
- The Swift core contract first turned green at `trc_9d920441c179`; the complete app and core compiled at `trc_732084837882`.
- Cross-language lifecycle and distribution contracts passed 16 focused tests at `trc_c0d94839baae`.
- The isolated alpha bundle smoke passed at `trc_55404d317372`: valid `Info.plist`, verified ad-hoc signature, executable arm64 Mach-O, and no launch/install action.
- The expanded suite now covers owner-only framed Unix-socket IPC, legacy snapshot decoding, failed-update retention, multi-node default/presence/revocation rendering, Cloudflare-token rejection, diagnostics redaction, shell-only cancellation, and CLI-originated snapshot refresh (`trc_48cc55aab47e`).
- The latest security and presentation pass, including endpoint ownership/mode validation and retained offline snapshots, compiled and passed at `trc_c85b0bc000e4`.
- Formatting and Worker 19-scoped lint are green. The clean native/distribution regression set passed 115 tests across 15 files with 7 pre-existing lifecycle TODOs (`trc_4167879813d3`).
- Full package typecheck passed (`trc_79500c6c6460`).
- Final Swift contracts, menu app build, isolated alpha packaging, `Info.plist` validation, ad-hoc signature verification, executable check, and arm64 Mach-O inspection passed (`trc_4ec13960255a`).
- Generated `.build` and `.tmp-macos-alpha` output has been removed after retaining validation evidence. No operator Mac lifecycle mutation has occurred.
- Final diff review identified one fail-open safety gap before publication: Codable would ignore unexpected secret-bearing fields in a full lifecycle response even though the standalone safe-workspace decoder rejected them. A new RED contract now requires complete framed responses to pass the secret-field guard before decoding, alongside request-JSON parity, install-progress, connector-degradation, operation-progress, and explicit uninstall-retention controls.
- The complete review-fix suite is green at `trc_d6d65f1110b6`: request JSON matches the shared tagged union; `installing` and connector degradation map correctly; full framed responses reject sensitive fields before Codable decoding; operation progress and explicit uninstall retention choices render; Swift contracts pass; the menu app builds; and the macOS source contract passes.
- Final clean formatting, scoped lint, package typecheck, and the complete native/distribution suite passed at `trc_6455424c27a1`: 115 tests across 15 files passed, with 7 pre-existing lifecycle TODOs.
- Final Swift contracts, menu app build, isolated alpha packaging, `Info.plist` validation, ad-hoc signature verification, executable validation, and arm64 Mach-O inspection passed at `trc_ed74f2f793a6`.
- Generated build/package output has been removed. PR publication, CI, CodeRabbit review, and merge into `stream/os-native` remain. No app was launched and no operator Mac lifecycle mutation occurred.
- The first new RED command used a repository-relative Swift package path while already inside `packages/os` and failed before compilation (`trc_073f6cb2c370`). Recovery: rerun from the worktree root.
- The corrected run then exposed a test-harness construction error: immutable mock-server socket fields were assigned from a helper (`trc_84cdc54921c8`). Recovery: initialize them through a designated initializer and static socket factory before evaluating product behavior.
- After the harness repair, the new suite reached the intended RED behavior: `install.state = installing` was presented as healthy (`trc_ca6f1206f873`). Recovery: implement install-state and connector degradation mapping, validate every complete framed response for sensitive fields before Codable decoding, expose operation progress, and separate uninstall retention choices explicitly.

## files changed

- `packages/os/.tmp-macos-alpha` (deleted)
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/.build` (deleted)
- `packages/os/native/macos/Package.swift`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/FramedJSONCodec.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Placeholder.swift` (deleted)
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/native/macos/Tests` (deleted)
- `packages/os/native/macos/Tests/ConsueloMacCoreTests/ConsueloMacCoreTests.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`

## workspace-owned: files changed

- `packages/os/.tmp-macos-alpha` (deleted)
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/.build` (deleted)
- `packages/os/native/macos/Package.swift`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/FramedJSONCodec.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Placeholder.swift` (deleted)
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/native/macos/Tests` (deleted)
- `packages/os/native/macos/Tests/ConsueloMacCoreTests/ConsueloMacCoreTests.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`

## workspace-owned: activity log

- 2026-07-26 23:34:07 fs.write: `packages/os/native/macos/Package.swift`
- 2026-07-26 23:34:08 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/Placeholder.swift`
- 2026-07-26 23:34:08 fs.write: `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- 2026-07-26 23:34:09 fs.write: `packages/os/native/macos/Tests/ConsueloMacCoreTests/ConsueloMacCoreTests.swift`
- 2026-07-26 23:35:13 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:36:17 fs.trash: `packages/os/native/macos/Tests`
- 2026-07-26 23:36:17 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:36:43 fs.write: `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- 2026-07-26 23:38:09 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:39:37 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`
- 2026-07-26 23:39:38 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- 2026-07-26 23:39:39 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/FramedJSONCodec.swift`
- 2026-07-26 23:39:39 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- 2026-07-26 23:39:40 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift`
- 2026-07-26 23:41:27 fs.write: `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- 2026-07-26 23:42:23 fs.trash: `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- 2026-07-26 23:42:38 fs.write: `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- 2026-07-26 23:42:50 fs.write: `packages/os/scripts/testing/macos-alpha-package.sh`
- 2026-07-26 23:42:51 fs.write: `packages/os/docs/macos-platform.md`
- 2026-07-26 23:42:51 fs.trash: `packages/os/native/macos/Sources/ConsueloMacCore/Placeholder.swift`
- 2026-07-26 23:45:46 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:45:46 fs.trash: `packages/os/.tmp-macos-alpha`
- 2026-07-26 23:49:13 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:52:01 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:52:02 fs.trash: `packages/os/.tmp-macos-alpha`
- 2026-07-26 23:55:14 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:57:18 fs.trash: `packages/os/native/macos/.build`
- 2026-07-26 23:57:19 fs.trash: `packages/os/.tmp-macos-alpha`

## workspace-owned: validation evidence

- TDD RED: unresolved Worker 19 implementation symbols at `trc_250b63e8199a`.
- Review RED: install-state progress exposed as healthy before the final presentation/safety fix at `trc_ca6f1206f873`.
- Review-fix GREEN: full framed-response secret rejection, tagged-union JSON parity, stable presentation, explicit retention controls, app build, and macOS source contract at `trc_d6d65f1110b6`.
- Final TypeScript/distribution gate: formatting, scoped lint, package typecheck, and 115 passing tests at `trc_6455424c27a1`.
- Final Swift/release gate: contract runner, menu app build, isolated alpha bundle, valid plist, verified ad-hoc signature, executable arm64 Mach-O at `trc_ed74f2f793a6`.

## key decisions

- `scripts/lib/native-lifecycle-client.ts` remains the cross-platform contract authority; the Swift model mirrors that contract and is parity-tested.
- The app owns presentation and confirmations only. Every state mutation is an allowlisted lifecycle request; service supervision and runtime activation remain engine-owned.
- The app uses a length-prefixed framed JSON Unix-domain-socket client under the Consuelo runtime boundary. Worker 21 remains responsible for the authoritative endpoint and service-manager adapter.
- Worker 25's safe node response is the only node shape accepted. Forbidden secret-bearing keys fail decoding rather than being silently retained.
- Development packaging uses an isolated alpha bundler and ad-hoc/local signing only; production Developer ID/notarization remains a downstream release gate.
- Ko explicitly deferred the Grok run because the provider is rate-limited for the week. The PR will record that independent review as a manual downstream step.

## notes for ko

- No command in this task may install, replace, restart, update, reset, or uninstall Consuelo OS or the app on either operator Mac.
- Human checkpoint only, not executed by this worker:

  ```bash
  packages/os/scripts/testing/macos-alpha-package.sh packages/os/.tmp-macos-alpha
  open packages/os/.tmp-macos-alpha/Consuelo.app
  ```

  Expected result: the Consuelo icon appears in the menu bar, the shell reads the owner-local lifecycle endpoint, and quitting the menu app leaves the background service unchanged.

## improvements noticed

- The semantic explore index was stale (last full index predates the foundation work) and returned unrelated files; exact task-scoped `fs.search` was used as repository evidence instead.

## issues and recovery

- Initial pre-task `fs.read` calls could not choose among parallel worktrees (`trc_90205fae63f7`, `trc_51aca5bea58a`, `trc_834ecb4f8f94`). Recovery: read dispatch metadata from `main` through typed GitHub access, identify `stream/os-native`, sync the stream, start the dedicated task, and repeat every mandatory read inside `tsk_3be06270a4c2`.
- The first `task.start` supplied the repository in the PR-only `github` field and failed (`trc_f0910e06c94a`). Recovery: retry the same task identity without that field; task session `tsk_3be06270a4c2` and PR #1666 were created from fresh `main` (`trc_2a478ad56e07`).
- Remote GitHub bootstrap reads truncated long documents. Recovery: after task creation, reread each governing document in full through task-scoped `fs.read`.
- The first workpad patch used `patch` instead of the typed `patchText` field and was rejected without mutation (`trc_8eaa32e807b9`). Recovery: resubmit the same patch with the correct field.
- The first Swift red run used `code.call` in `verify` mode even though SwiftPM creates `.build` intermediates, so Consuelo rejected the mutation (`trc_b0c3ef9a901f`). The same run also exposed malformed raw multiline test literals before reaching the intended missing-implementation failure. Recovery: correct only the test literals, remove generated `.build` state through `fs.trash`, and rerun the red phase in edit-capable test mode.
- The corrected red suite then failed because the assigned Mac exposes only `/Library/Developer/CommandLineTools`; its Swift 6.2 image contains neither `XCTest` nor the Swift Testing runtime (`trc_99c23a8ac46b`, diagnostics `trc_afdf50e49359`, `trc_12a72f2c9cad`, `trc_c20d0d1be615`). Recovery: preserve behavioral TDD with a zero-dependency Swift executable contract runner, use the same runner in `macos-26` CI, and avoid changing global developer-tool selection or installing Xcode on the operator machine.
- The first contract-runner migration used `fs.write` on the existing manifest, which correctly refused the overwrite and stopped the batch (`trc_e2f505d98c00`, `trc_fdaf2d2f59bc`). Recovery: patch the manifest explicitly, then perform the cleanup as separate typed steps.
- The executable contract runner produced the intended RED signal (`trc_250b63e8199a`): all failures are unresolved Worker 19 implementation symbols rather than harness or environment failures. This is the accepted TDD baseline for the green phase.
- The first green-phase Swift run compiled the complete core but failed the default-node action because the test fixture omitted `node-member` (`trc_658c4e8ed060`). Recovery: preserve the fail-closed node validation and add the selected node to the Worker 25-safe fixture; no production guard was relaxed.
- The production-shell batch stopped after `fs.write` correctly refused to overwrite the existing placeholder app (`trc_042605bfd143`, step `trc_fb1f19a32b1b`). The preceding backward-compatible snapshot decoder and owner-local Unix transport writes succeeded. Recovery: remove only the placeholder through typed `fs.trash`, write the real app as a new file, and complete the remaining package/docs/workflow steps separately.
- The first combined Swift contract/app build reached the new Unix transport but Swift could not infer a raw buffer type for the `sockaddr_un.sun_path` tuple (`trc_b09fd4ccc150`). Recovery: copy UTF-8 bytes through the explicit `sockaddr_un` path offset and retain the path-length guard; no socket connection or lifecycle mutation was attempted.
- The first typed `git.diff --stat` failed with `EISDIR` while disposable Swift/package output directories were present (`trc_d9e4358f5461`). Recovery: remove only `native/macos/.build` and `.tmp-macos-alpha` through task-scoped `fs.trash`, retain the successful test/package traces, and retry the same typed diff route.
- A later typed diff check encountered the same generated `.build` condition after Swift validation (`trc_d9ebb8bc7cdf`). Recovery remains deterministic: finish validation, remove generated build/package outputs through task-scoped `fs.trash`, then review the clean diff.
- The first broad validation chain used repository-root file paths while its working directory was already `packages/os`, so Prettier rejected the unresolved paths and stopped before lint/tests (`trc_57714b912767`). Recovery: run repository-level formatting checks from the worktree root, then run package-local lint and Vitest from `packages/os`.
- The corrected repository-root formatting check then found the workpad had changed after its previous format pass (`trc_8319558d1e91`). Recovery: reformat the updated workpad and rerun the read-only formatting check before continuing.
- The first package-local lint/test chain stopped before Vitest because the lifecycle client and its test transport/helpers violated the repository's `prefer-arrow` rule (`trc_5c8741b445e4`, 29 errors). Recovery: convert only the flagged function declarations and object methods to arrow properties, reformat, then rerun lint and the broad regression set.
- `eslint --fix` confirmed the `prefer-arrow` rule is intentionally non-autofixable and made no changes (`trc_27df19a8e8b3`). Recovery: apply the equivalent explicit arrow-function refactor to the flagged client factory and test transport methods.
- After the explicit refactor, ESLint passed and the broad regression set reached 114 passing tests, but `runtime-bundle.test.ts` rejected SwiftPM's generated `native/macos/.build/debug` symlink (`trc_41b87b30e34c`). Recovery: remove the disposable `.build` directory through task-scoped `fs.trash` and rerun the identical regression set against a clean source inventory.
- The clean rerun again reached 114 passing tests and then exposed a genuine integration gap: `native/macos/Package.swift` had no runtime-bundle classification (`trc_5b0d6134f949`). Recovery: add test-first classification coverage and classify the native macOS source tree explicitly as a `platform-adapter` in the cross-platform runtime inventory, consistent with native Windows source.
- The final cleanup batch removed generated `.build` and `.tmp-macos-alpha` output, but its workpad hunk missed the current formatted text (`trc_1c8fad3a7ad9`, failed step `trc_01a4625d2337`). Recovery: inspect the current workpad lines and apply the correction against the exact formatted content.
- The focused classification assertion failed red as intended (`trc_8a21610be84e`): macOS package/source paths returned `null` instead of `platform-adapter`. Recovery: classify `native/macos/**` alongside `native/windows-service/**` so distribution inventory remains fail-closed and explicit.
- A validation command then expanded ESLint onto the pre-existing 1,000-line runtime-bundle implementation and its legacy test helpers, surfacing 45 unrelated baseline `prefer-arrow`/escape errors before Vitest ran (`trc_d0856550c7b0`). The Worker 19 patch itself adds only a prefix classification and assertions. Recovery: validate that integration behavior through the runtime-bundle tests and diff, while keeping strict lint scoped to Worker 19-owned/new files rather than broadening this task into a legacy style refactor.

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
- `packages/os/AGENTS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/docs/architecture/native-platform-spike.md`
- `packages/os/docs/architecture/workspace-node-registry.md`
- `packages/os/docs/linux-platform.md`
- `packages/os/docs/windows-platform.md`
- `packages/os/native/macos/Package.swift`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/04-lifecycle-engine.md`
- `packages/os/plans/consuelo-os-foundation/workers/05-retention-rollback-uninstall.md`
- `packages/os/plans/consuelo-os-foundation/workers/18-native-platform-spike.md`
- `packages/os/plans/consuelo-os-foundation/workers/19-macos-app-service.md`
- `packages/os/plans/consuelo-os-foundation/workers/24-distribution-integration.md`
- `packages/os/plans/consuelo-os-foundation/workers/25-multi-node-registry-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/distribution/lifecycle-contract.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- `packages/os/tests/linux-platform.test.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`
- `packages/os/tests/windows-platform.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-26 23:49:42 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-07-26 23:49:51 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-26 23:49:51 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:50:06 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:52:12 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:52:59 apply-patch: `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- 2026-07-26 23:52:59 apply-patch: `packages/os/tests/macos-platform.test.ts`
- 2026-07-26 23:52:59 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:53:37 apply-patch: `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- 2026-07-26 23:53:37 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:53:55 apply-patch: `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- 2026-07-26 23:53:55 apply-patch: `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- 2026-07-26 23:53:55 apply-patch: `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- 2026-07-26 23:53:55 apply-patch: `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- 2026-07-26 23:53:55 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:55:15 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`

- 2026-07-26 23:57:20 apply-patch: `.task/os-native/implement-macos-menu-bar-app-and-service-integration/workpad.md`
