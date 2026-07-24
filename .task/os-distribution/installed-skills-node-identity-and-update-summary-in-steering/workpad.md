# Worker 07 workpad: installed skills, node identity, and update summary in steering

## Task identity

- Assigned stream: `stream/os-distribution`
- Task branch: `task/os-distribution/installed-skills-node-identity-and-update-summary-in-steering`
- Task session: `tsk_e769309696fc`
- Task PR: https://github.com/consuelohq/opensaas/pull/1640
- Synchronized stream base SHA: `cee8e172aa633ca131136fef941cd88344f949d3`
- Environment lane: local isolated task worktree only. No install, update, reset, restart, or uninstall on Ko's Mac Mini or MacBook Air.

## Acceptance contract

- [x] `os.get_steering` reports a safe typed runtime identity: opaque node ID, display name, platform, architecture, release channel, installed runtime version, workspace ID/slug/host, and default-node status.
- [x] Safe node summaries use Worker 25's authenticated/redacted contract, preserve offline nodes, and never expose credentials, local paths, raw environment values, logs, DB contents, or private keys.
- [x] Steering markdown reads managed `system_prompt.md` first, then explicit user Markdown in `~/Consuelo/Steering/` in deterministic order; `decision.md` and legacy `steering.md` never appear.
- [x] Steering reports only selected/installed skills from the active installed-skill index, with compact metadata: name, title, description/trigger, status, and entrypoint. No `SKILL.md` bodies.
- [x] Missing or corrupt installed-skill/node/update registries degrade to bounded diagnostics rather than crashing or inlining raw file content.
- [x] Core tools come from the canonical effective core manifest authority.
- [x] Steering includes Worker 06's compact update summary: available count, conflict count, checked timestamp, current version, and target version, without full plan items or component contents.
- [x] A positive available-update count with notifications enabled emits one concise reminder. Zero updates, notifications off, and active snooze emit no reminder.
- [x] Fresh installs no longer seed `decision.md`; a pre-existing modified file is preserved, while an unchanged bundled copy is removed safely.
- [x] Explicit steering output size budget is tested and measured: oversized fixture is 65,534 characters against the 65,536-character ceiling.
- [x] Required regression suites remain green: steering trace/raw steering, install state, skills registry, MCP gateway, security gateway, plus focused Worker 06/25 contracts.
- [ ] Task PR receives CodeRabbit and mandatory Grok 4.5 review; every substantive finding is verified, fixed or rejected with evidence, and dispositioned on GitHub.
- [ ] Task PR is merged only into `stream/os-distribution`; the stream is not promoted to `main`.

## Test-first implementation plan

1. Add focused behavioral tests before production edits for safe runtime/node/workspace identity, selected/custom installed skills, missing/corrupt registry degradation, compact update state/reminder gating, visible steering ordering/exclusions, secret/path exclusion, size budget, raw steering regression, and `decision.md` migration.
2. Run the focused suite in red phase and retain the failure evidence.
3. Implement the shared Worker 25 response parser/cache, bounded steering runtime-context helper, minimum `os.ts` integration, authenticated node-list cache persistence, and bounded `install-state.ts` migration.
4. Run focused green tests, then required regression suites and package validation.
5. Push an independently reviewable PR, request CodeRabbit, run/post Grok 4.5 structured review, resolve findings, rerun validation, merge into the assigned stream, and clean temporary review artifacts.

## Chosen architecture and contract boundaries

- Worker 25 authority remains the producer of safe node data through `workspaceNodeListPayload()` / `safeWorkspaceNode()`.
- Add one shared strict parser/type/cache module for the authenticated safe response. `workspace-node-client`, cache persistence, and steering all consume this same parser; steering does not recreate a second parser.
- Successful authenticated `workspace:nodes list` writes the validated safe response to the current workspace state directory. Steering reads that cache synchronously, so offline nodes remain visible without placing credentials in steering or performing a bootstrap network call.
- Typed global/node/workspace YAML remains the local identity source. Worker 25's validated cache supplies platform, architecture, presence, and default-node truth. Missing cache yields bounded unknown/diagnostic fields rather than environment guesses.
- Worker 06's `readManagedComponentState()` is the only update-plan parser. Steering derives a compact summary from its parsed plan/provenance and never serializes `items` or content.
- `availableCount` counts actionable upstream actions only: `install`, `update-clean`, `merge-clean`, `conflict`, and `remove-upstream`. `no-change`, `preserve-custom`, and `detach` do not create update notices.
- Current version is the single installed provenance `sourceVersion`; mixed or unavailable versions become `null` plus a bounded diagnostic. Target version and checked timestamp come from `plan.sourceBundle.version` and `plan.generatedAt`.
- Installed bundled metadata comes from `components/installed-skills.json.selected`. Legacy custom entries are resolved only within the active Consuelo home and read from their compact `skill.json`; Markdown bodies and filesystem paths are never emitted.
- Managed `system_prompt.md` remains in the hidden runtime home. User-authored Markdown comes only from `${HOME}/Consuelo/Steering`, sorted deterministically and excluding `decision.md`/`steering.md` case-insensitively.
- Steering uses an explicit 64 KiB output budget. The deliberately oversized regression fixture renders 65,534 characters against the 65,536-character ceiling and retains every enabled core-tool name.

## Current code findings

- `packages/os/scripts/os.ts` already excludes `decision.md` and legacy `steering.md`, orders hidden `system_prompt.md` first, and reads the canonical effective core manifest. Its runtime identity currently exposes environment/config paths and omits installed skills, channel/version, safe node summaries, and compact update state.
- Worker 06's canonical parser is `readManagedComponentState()`. `ManagedComponentUpdatePlan.summary` contains deterministic totals, review count, and per-action counts; selected skills are written with compact metadata to `components/installed-skills.json`.
- Worker 25's canonical safe producer is `workspaceNodeListPayload()` / `safeWorkspaceNode()` in the device-authority service. It preserves offline nodes and excludes private keys/tokens/local paths.
- `workspace-node-client.ts` currently returns unvalidated `Record<string, unknown>` and does not persist the authenticated safe list, so a shared strict consumer/cache boundary is required.
- `install-state.ts` still declares `DEFAULT_STEERING_FILES = ['system_prompt.md', 'decision.md']`, so the decision-file migration is not complete.
- Existing steering tests cover hidden steering ordering/exclusions and loop-guard tracing; new tests must preserve managed hidden `system_prompt.md` while moving user-authored steering to the visible tree.
- The brief names `packages/os/tests/os-raw-steering.test.ts` as a required regression suite, but that file is absent and no existing test covers `getRawSteering()`. This task will add the missing characterization suite rather than silently dropping the contract.

## Route failures and recovery evidence

All failures below must be summarized on the PR with the successful recovery path; none were bypassed with native Git, unscoped shell, another computer, provider substitution, or the legacy workspace connector.

1. Pre-task `fs.read` could not choose among active worktrees. Explicit `branch: main` also failed (`trc_baca56e943cb`), and a diagnostic explore call failed (`trc_33cf33d02633`). Recovery: bounded OS `mac.read` of the required local-main governance files only (`trc_b1dc16b385ec`); all product work remained task-scoped afterward.
2. `stream.sync` accepted `repo` at the facade but the underlying script rejected `--repo` (`trc_14deb26fc905`). Recovery: retried with the script-supported fields and synchronized/pushed the stream successfully (`trc_88fbbdc7963f`).
3. `task.start` rejected `startFrom: stream/os-distribution` (`trc_e2302d1309dd`) and then rejected a repository string in the `github` field (`trc_3e49f34ee8c4`). Recovery: used typed `startFrom: stream` with no inappropriate GitHub selector; task/PR/session created successfully (`trc_ab24d2b1a4c5`).
4. Task-scoped `status` ignored the task session and reported root `main` (`trc_b90dd8963f49`). It is not used as task-state evidence.
5. The semantic code index was stale and returned irrelevant matches (`trc_eea02a8865fa`, `trc_fee9e5c8899f`, `trc_6acd080b2029`, `trc_8f1abebb82f1`). Recovery: direct exact task-worktree searches.
6. Nested `batch` did not propagate `taskSession` to `fs.search`, causing ambiguous-task failures (`trc_1c08fffdb2e7`, children `trc_1f6f0a43f7b9`, `trc_43683005cb20`, `trc_9edf5ca36603`, `trc_0bfeba896999`); one search also exceeded the documented maximum (`trc_2c3c33886839`). Recovery: direct task-scoped `fs.search` calls succeeded (`trc_817ad3775084`, `trc_8375b9acde53`, `trc_7702a9f891ae`, `trc_cd65dc778dd3`, `trc_407058b3cee9`).
7. A later direct search used `maxResults: 250`, above the typed maximum (`trc_186d0372f081`). Recovery: retried with 200 and completed (`trc_181a6a02d8a6`).
8. The required `os-raw-steering.test.ts` path returned `NOT_FOUND` (`trc_2e6899c89893`); exact search found no raw-steering coverage (`trc_8a446e6e3a8a`) and the task-local test listing confirmed the absence (`trc_273cb2994cf3`). Recovery: add a focused characterization suite in this task.
9. The documented `task.call` execution route was advertised by discovery but rejected by the live generated manifest with `UNKNOWN_TOOL_SCOPE`; its legacy `task.exec` alias failed identically. Recovery: discovery explicitly recommended task-scoped `code.call`, which executed the focused red suite in the correct task worktree (`trc_ec1dd6d7a10e`).
10. Direct Vitest import of `os.ts` in the newly added raw-steering characterization could not load Bun's `bun:sqlite` module. Recovery: converted the test to the repository's established Bun subprocess pattern (`trc_4ea527801768`); this is a test-harness correction, not a product behavior change.
11. The first combined patch to `workspace-node-client.ts` missed its context. Recovery: split the change into exact import/input/response hunks and applied it successfully (`trc_8b6936fec892`).
12. Diff review found that visible steering followed symlinks and could inline Markdown outside `~/Consuelo/Steering`. The focused security test reproduced the leak (`trc_54a762901297`); regular-file and root-containment checks fixed it (`trc_d0b021c6f982`), and the regression passed (`trc_42fbdd6da165`).
13. A focused cache-safety test showed that an authenticated workspace ID containing `../` could escape the intended node-state directory (`trc_efecc31d6392`). The shared strict schema now rejects unsafe path segments (`trc_d47d0d5d7d92`), and the regression passed (`trc_fabffec54a9f`).
14. Package `check-files` was first invoked without its required `--files` input (`trc_d280180c6620`). The corrected explicit-file invocation then exposed an existing runner mismatch: `check-files.js` resolves the controller repository root, where the `code-call` package script is unavailable, so every nested check failed with `Script not found \"code-call\"` (`trc_bf4f54b0a085`). Recovery: retain the successful task-scoped package syntax gate (`trc_b8f54d11e862`), full test suite (`trc_608a5fbac719`), and direct manifest drift check (`trc_021df376d386`) as the scoped validation evidence. No product route was bypassed.
15. The first exact size assertion intentionally probed the oversized fixture at the 65,536-character ceiling and measured an actual deterministic output of 65,534 (`trc_c6a1715c805d`). The regression now pins that measured value and passes (`trc_de3764b9db98`).

## Implemented changes

- Added `workspace-node-summary.ts`, the single strict consumer/cache contract for Worker 25's already-redacted authenticated node-list response. It rejects unknown fields, inconsistent counts/current-node references, and unsafe workspace path segments; writes private atomic cache files; and preserves offline nodes.
- Updated the authenticated workspace-node client and CLI to validate list responses through that shared contract and persist them under the active Consuelo home.
- Added `steering-runtime-context.ts` to read typed global/node/workspace YAML, validated node summaries, selected bundled/custom installed-skill metadata, and Worker 06 managed-component state. Each unavailable/corrupt source degrades independently to stable bounded diagnostics.
- Rebuilt `getSteering()` around safe typed identity, node summaries, installed skills, compact update state, reminder gating, canonical effective-core routing metadata, managed/user steering ordering, symlink/root containment, and a hard 65,536-character budget. Raw/operator steering remains a separate full-manifest surface.
- Changed provisioning to seed only `system_prompt.md`; byte-identical legacy bundled `decision.md` copies are removed, while modified/user-owned copies and package-checkout sources are preserved.
- Added the missing raw-steering characterization suite and focused behavioral/security coverage for all Worker 07 acceptance paths.

## Validation evidence

- TDD red: `trc_ec1dd6d7a10e` — 30 pre-existing tests passed; new contracts failed only on the intentionally absent Worker 07 behavior.
- Focused green: `trc_e705ea615bd0` — 39/39; strengthened budget/core-tool suite `trc_e722bed6e404` — 40/40.
- Required regression matrix: `trc_caf6cc13f165` — 125/125 across steering trace/raw, install state, skills registry, managed components, Worker 25 node routes/client/cache, MCP gateway/action scopes, and security gateway.
- Package syntax gate: `trc_b8f54d11e862` — green.
- Full package suite: `trc_608a5fbac719` — 129 test files, 530 tests, all green.
- Generated core manifest drift check: `trc_021df376d386` — current.
- Measured oversized steering fixture: `trc_de3764b9db98` — exactly 65,534 characters, below the 65,536-character ceiling.

## Governance/read evidence

- OS bootstrap: completed exactly once.
- Required task-local governance and brief reads: `trc_045c27f58c11`, continued SCRIPTS read `trc_5ba9ce60632b`.
- Worker 06/25 contracts and key implementations: `trc_eb25ef4a4056`, `trc_807f7b2facea`, `trc_ba1117e4fb8b`, `trc_dd36af613f4d`.
- Current steering/install/lifecycle/test implementation reads: `trc_62074fa597cd`, `trc_0b260afa7c03`, `trc_dd970c5012f1`, `trc_2e6899c89893`.

## Current status

Implementation and local validation are complete. The task is ready for checkpoint/push, CI, CodeRabbit, mandatory Grok 4.5 review, finding dispositions, and merge into `stream/os-distribution`. No install/update/reset/restart/uninstall command has been run on Ko's Mac Mini or MacBook Air.

- 2026-07-24 16:52:37 write: `.task/os-distribution/installed-skills-node-identity-and-update-summary-in-steering/workpad.md`

## files changed

- `packages/os/scripts/lib/steering-runtime-context.ts`
- `packages/os/scripts/lib/workspace-node-summary.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/os-steering-runtime-context.test.ts`
- `packages/os/tests/workspace-node-summary.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/steering-runtime-context.ts`
- `packages/os/scripts/lib/workspace-node-summary.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/os-steering-runtime-context.test.ts`
- `packages/os/tests/workspace-node-summary.test.ts`

## workspace-owned: activity log

- 2026-07-24 16:52:37 fs.write: `.task/os-distribution/installed-skills-node-identity-and-update-summary-in-steering/workpad.md`
- 2026-07-24 16:53:47 write: `packages/os/tests/os-steering-runtime-context.test.ts`
- 2026-07-24 16:53:47 fs.write: `packages/os/tests/os-steering-runtime-context.test.ts`
- 2026-07-24 16:53:53 write: `packages/os/tests/os-raw-steering.test.ts`
- 2026-07-24 16:53:53 fs.write: `packages/os/tests/os-raw-steering.test.ts`
- 2026-07-24 16:54:03 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-07-24 16:54:13 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-07-24 16:54:23 write: `packages/os/tests/workspace-node-summary.test.ts`
- 2026-07-24 16:54:23 fs.write: `packages/os/tests/workspace-node-summary.test.ts`
- 2026-07-24 16:54:35 apply-patch: `packages/os/tests/workspace-nodes-cli.test.ts`
- 2026-07-24 16:55:20 write: `packages/os/tests/os-raw-steering.test.ts`
- 2026-07-24 16:55:20 fs.write: `packages/os/tests/os-raw-steering.test.ts`
- 2026-07-24 16:55:27 apply-patch: `.task/os-distribution/installed-skills-node-identity-and-update-summary-in-steering/workpad.md`
- 2026-07-24 16:55:59 fs.write: `packages/os/scripts/lib/workspace-node-summary.ts`
- 2026-07-24 16:57:39 fs.write: `packages/os/scripts/lib/steering-runtime-context.ts`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/workspace-nodes.ts`

- 2026-07-24 17:03:54 apply-patch: `.task/os-distribution/installed-skills-node-identity-and-update-summary-in-steering/workpad.md`