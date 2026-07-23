# implement managed component provenance and deterministic update plan

branch: `task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1601/implement-managed-component-provenance-and-deterministic-update-plan
github pr: https://github.com/consuelohq/opensaas/pull/1601
task session: `tsk_b38aac3ba6fd`
base sha: `7bb40f0ce28a709253252d9c0a1f2e15e65a46e5`
node: `picassos-mac-mini.local` (read-only identity only)
started: 2026-07-23

## acceptance criteria

- [x] Define stable managed-component identity and ownership: `bundled-managed`, `custom`, and `detached`.
- [x] Persist source bundle/version, base content reference/hash, local/upstream hashes, install/update timestamps, and resolution state in structured JSON under the hidden component index.
- [x] Generate deterministic, stable-schema `update-plan.json` actions: `install`, `update-clean`, `preserve-custom`, `merge-clean`, `conflict`, `remove-upstream`, `detach`, and `no-change`.
- [x] Compare real base/local/upstream content, materialize only proven clean merges, preserve conflicts and local modifications, and never depend on AI for correctness.
- [x] Keep built-ins executing from the active immutable runtime bundle; never create hidden editable bundled duplicates or infer ownership from a name collision.
- [x] Provide typed inspect/apply/conflict-resolution/detach/restore operations with explicit safe filesystem boundaries.
- [x] Integrate unresolved content-base retention through `components/retention.json` without overlapping Worker 05's release-pruning ownership.
- [x] Cover skills, tools, site templates, scripts, and job templates with focused behavioral fixtures and the worker-required regression matrix.
- [x] Complete task-scoped OS strict review and publish-valid verify.
- [x] Complete GitHub clean-host CI and CodeRabbit request/disposition.
- [ ] Verify and disposition the two mandated read-only Grok 4.5 findings.
- [ ] Record all findings/dispositions on GitHub, remove temporary review artifacts, merge PR #1601 only into `stream/os-distribution`, and finish the task session.

## implementation

- Added `scripts/lib/managed-components.ts`: schema v1 provenance, deterministic plan generation, content-addressed bases, all eight actions, three-way text/tree merge classification, fail-closed state reads, content-reference pruning, retention handoff, secret-material rejection, live local-hash checks, symlink/path traversal rejection, and atomic exact-tree replacement.
- Added `scripts/managed-components.ts`: typed inspect-plan, apply-safe, inspect-conflict, accept-upstream, keep-local, reviewed-merge, detach, and restore-default commands.
- Added `scripts/lib/managed-component-install.ts`: indexes bundled skills/tools from the immutable package/runtime, keeps tool wrappers executable, creates no hidden editable bundled copies, and preserves pre-existing hidden directories as unread legacy custom entries for explicit migration.
- Integrated component indexes/provenance into `install-state.ts`, settings canonical-index reads with legacy fallback, runtime-bundle mandatory inputs, release/lifecycle fixtures, package scripts, and operator documentation.
- Added `components/retention.json` containing only sorted unresolved base references for Worker 05.
- Updated the script-parity baseline for the three new OS-only entrypoints and repaired eight already-stale assigned-stream classifications plus two existing Railway content-drift statuses.

## test-first evidence

- RED missing managed-component module: `trc_54f1e3155d61`.
- GREEN initial deterministic planner/state/resolution suite 8/8: `trc_0c4ce22a0c61`.
- RED absent CLI and legacy hidden-copy provisioning: `trc_697322383ad9`; GREEN focused CLI/provisioning plus syntax: `trc_aea9440fc514`.
- GREEN managed/install integration 30/30: `trc_8d52f6925f8a`.
- RED canonical settings index: `trc_3b3507114961`; GREEN settings 6/6 plus syntax: `trc_be1da582a756`.
- RED secret/live-hash/exact-replacement safety: `trc_c63a876fd0b1`; GREEN safety suite 11/11: `trc_b1b1be586be9`.
- GREEN managed/runtime-bundle integration 27/27 plus syntax: `trc_8c3107258a85`.
- GREEN lifecycle + local-agent recovered regressions 35/35: `trc_cbbf1cbfe3be`.
- GREEN worker-required named matrix 107/107: `trc_a3f7c94c79d6`.
- RED stale content-base/corrupt-state fail-closed behavior: `trc_5a6e3f755629`; GREEN: `trc_7d2bda5788f3`.
- GREEN script-parity execution audit 10/10 and package typecheck: `trc_ba3d159a2ec8` before the unrelated broad-suite failures described below.
- RED registered distribution fixture missing new required runtime files: `trc_68cba779275d`; GREEN exact distribution lane 70/70, macOS host isolation probe, and Apple Container Linux/arm64 clean-host probe: `trc_ec22b072a177`.
- RED strict review catch typing finding: `trc_4a604f5be1aa`; fixed with `catch (error: unknown)`, focused safety/typecheck green `trc_452799aac20a`, and strict review clean `trc_0c6ef0bcdb99`.
- Publish-valid full verify against `stream/os-distribution`: `trc_c9752ad2ac0e`.

## validation status

- `bun run typecheck`: pass.
- `bun x vitest run tests/audit/script-parity-audit.test.ts`: pass, 10/10.
- Worker 06 named regression matrix: pass, 107/107.
- Registered distribution lane `bun x vitest run tests/distribution`: pass, 70/70 with 10 pre-existing TODO contracts.
- Host probe: pass, Bun 1.3.14 arm64/darwin, isolated writable home, atomic replacement, cleanup.
- Apple Container clean host: pass, Linux/arm64 Bun 1.3.14, isolated writable home, atomic replacement, cleanup.
- Strict task review: pass, zero owned/pre-existing findings after the typed-catch disposition.
- Full task verify: pass, publish-valid, zero DB risks, verification stamp written.
- Global repository audit: blocked by pre-existing repository-wide drift (`trc_c83a5123c940`): 9,378 dead documentation references, 240 stale index entries, 371 indexed deletions, and unrelated script documentation mismatches. Worker 06's scoped script-parity audit, strict review, verify, named regression matrix, and registered distribution lane pass.
- Broad `bun x vitest run`: execution audit and 258 tests passed, but 62 tests across 15 unrelated environment/provider/TTY/trace files failed (`trc_ba3d159a2ec8`). The failures are outside Worker 06 changed paths and include pre-existing local-environment contracts; the plan-designated named and clean-host lanes pass. GitHub's registered workflow remains the durable cross-platform source of truth.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/docs/managed-components.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/managed-components.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/managed-components.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/managed-components.test.ts`
- `packages/os/tests/settings-site.test.ts`


## key decisions

- `bundled-managed` is the current schema value; migration recognizes legacy `source: bundled` without adding a second ownership vocabulary.
- Built-ins execute from immutable runtime assets. Hidden state contains indexes and content-addressed review bases only; visible user content is the sole editable copy.
- Same-name local content is always custom unless provenance proves managed ownership.
- Existing hidden skill/tool directories are preserved and not read, merged, moved, or overwritten during provisioning.
- AI may assist a human review but is never a correctness dependency; reviewed merges require expected local/upstream hashes.
- Worker 05 retains broad release-pruning ownership; Worker 06 publishes only unresolved content-base references.

## issues and recovery

- Pre-task main reads were ambiguous with active worktrees (`trc_d86b47cb8199`, `trc_99f684630f6c`); recovered with approved read-only bootstrap access, then exact task-base reads.
- Literal `$CONSUELO_HOME` did not expand (`trc_43b61fce4267`); corrected to approved absolute paths.
- Nested batch calls lost task-session scope (`trc_eab1657df469`; children `trc_3ac99de0e220`, `trc_d3e8c507beaa`); recovered with direct task-scoped calls (`trc_f11cb5c59b08`, `trc_f330fa2ea1cd`).
- `status` ignored explicit task routing (`trc_b9e47bab8938`); base/session evidence uses task metadata and typed GitHub reads.
- Unsupported GitHub field request (`trc_49f1fc4d6f3a`) was corrected; exact base SHA was recovered through the documented GitHub raw escape hatch (`trc_06c8ea4a98ce`).
- `fs.search` exceeded its typed maximum (`trc_8c27adbc956e`); retried within 200 (`trc_9746285a3538`).
- `fs.patch` is absent from the generated manifest; recovered with scoped `code.call` (`trc_dcd1dc9fb7e2`) and then the correct `fs.apply_patch` tool.
- Large inline edit payloads failed before mutation (`trc_bd6e5c4ec9b9`, `trc_0b06db5d80ae`, `trc_715b47852cb7`); recovered by splitting edits and moving provisioning into a dedicated module.
- Combined package/docs patch failed atomically on a stale heading (`trc_f66f58b05c88`); read the actual boundary and applied a narrower patch.
- Root audit paths were initially misresolved (`trc_41595e94f7aa`, `trc_8ccf0d1a07b4`); located the package audit taxonomy through scoped repository inspection.
- Script-parity audit exposed eight assigned-stream files missing from the baseline and two Railway scripts misclassified as identical (`trc_3e60eb1eb2bd`); verified OS/workspace inventory and classified the existing drift explicitly rather than deleting unrelated code.
- Registered distribution tests initially failed because the publication fixture omitted Worker 06's new mandatory runtime files (`trc_68cba779275d`); updated the fixture and reran the exact lane green (`trc_ec22b072a177`).
- Global audit failed on broad existing repository drift (`trc_c83a5123c940`); no Worker 06 product bypass was taken. Continued through the plan-designated scoped execution audit, strict review, verify, and registered clean-host lane.
- Strict review found one Worker 06 bare-catch typing issue (`trc_4a604f5be1aa`); fixed it, reran focused tests/typecheck (`trc_452799aac20a`), then reran strict review clean (`trc_0c6ef0bcdb99`) and verify publish-valid (`trc_c9752ad2ac0e`).
- The first task publish surfaced an unrelated facade snapshot modified by the broad local suite. Cross-branch `fs.read` correctly rejected the task-session mismatch (`trc_bea707fff03b`); recovered through the authenticated GitHub content API inside the task worktree (`trc_4c0403e2a2a3`) and verified the restored file is byte-identical to `stream/os-distribution` (`trc_8d117ecfd8e3`).

## real-machine boundary

No Consuelo install, update, reset, restart, or uninstall was run on Ko's Mac Mini or MacBook Air. Only temporary homes, injected adapters, read-only host identity, the environment probe, and the registered Apple Container clean-host lane were used.

Human rehearsal checkpoint (temporary home only):

```bash
sandbox="$(mktemp -d)"
HOME="$sandbox/user" CONSUELO_HOME="$sandbox/os" bun --cwd packages/os -e \
  "import { provisionLocalOs } from './scripts/lib/install-state.ts'; provisionLocalOs({ mode: 'local', selectedSkills: ['task'] });"
bun --cwd packages/os managed-components -- inspect-plan --home "$sandbox/os" --json
```

Expected: `ok: true`, schema version 1, `summary.requiresReview: 0`, and no editable `$sandbox/os/skills/task` or `$sandbox/os/tools/status` directory.

## next

1. Run scoped OS audit/review/verify gates.
2. Push PR #1601 and execute the registered GitHub compatibility workflow.
3. Request CodeRabbit and post/fix/dispose findings.
4. Render and run the mandated read-only Grok 4.5 review; post structured review, inline findings, summary, and dispositions; remove `.tmp-reviews`.
5. Merge only into `stream/os-distribution` and finish the task session.

## active wait plan

- Start time: 2026-07-23T21:23:00Z.
- Wait reason: the exact mandated Grok 4.5 wrapper outlived the outer tool transport but its bounded subprocess remains active (PIDs 83526/83527/83532); avoid a duplicate review.
- Duration: poll after 60 seconds, then bounded 30-second intervals up to the wrapper's 900-second timeout.
- Resume action: inspect those PIDs immediately; after exit, locate and parse the wrapper's structured stdout/raw log for the current task session and prompt path.
- Expected signal: all three PIDs exit and a non-empty JSON review with `status: completed` is available.
- Fallback: if the process reaches its 900-second bound, exits non-zero, or has empty/incomplete output, record the failure and retry once through the typed `subagent` tool with identical provider/model/policy/prompt/workspace parameters.

## Grok review findings

- Completed Grok run: `trc_bece22a5a9c3`; persisted provider stdout is non-empty and identifies exactly two findings (`CR-001`, `CR-002`) with no `CR-003` (`trc_e669e0931799`). Two transport-created duplicate runs failed closed with empty output and were terminated; the surviving run completed normally.
- `CR-001` (High / correctness, valid): production provisioning always passes `localOverrides: []`, so live visible changes and a prior `keep-local` decision can be reclassified from the base and have their persisted local hash clobbered.
- `CR-002` (Medium / correctness, valid): `remove-upstream` review items intentionally have no upstream content reference, while `inspectManagedComponentConflict` unconditionally requires one and therefore cannot inspect that required review case.
- All 48 GitHub checks pass with zero failures/pending (`trc_14e81abc6614`). CodeRabbit completed but skipped the PR because all changed paths are excluded by its configured filters; no CodeRabbit code finding exists.

## Test-first contract: Grok dispositions

- Behavior under test: plan generation must snapshot live visible managed trees; a kept-local tree must remain divergent after refresh/reprovision; upstream-removal review items must remain inspectable without fabricated upstream content.
- Existing pattern: use the deterministic `buildManagedComponentUpdateState` boundary, existing symlink-safe `readFilesystemTree`, typed resolution operations, and focused Vitest filesystem fixtures.
- New tests: live-tree refresh classifies visible divergence; keep-local followed by refresh preserves the local hash/content; provisioning reads a configured visible `localPath`; remove-upstream inspection returns `upstream: null`; CLI exposes `refresh-plan`.
- Focused red command: `bun x vitest run tests/managed-components.test.ts` from `packages/os`.
- Expected red: missing `refreshManagedComponentPlan` export/CLI command and current remove-upstream inspection throws `upstream content reference is missing`.

## Grok finding dispositions

- RED: focused suite failed exactly on missing live refresh, production `localOverrides: []`, absent `refresh-plan`, and remove-upstream inspection requiring upstream content (`trc_67e7448c52db`).
- `CR-001` fixed: added symlink-safe live visible-tree snapshots, production provisioning overrides, typed `refresh-plan`, and automatic refresh after safe apply, accept-upstream, keep-local, and reviewed merge. A kept-local or reviewed tree now remains represented by its live divergent hash.
- `CR-002` fixed: review inspection returns `upstream: null` for upstream-removal items while preserving base/local evidence.
- GREEN: focused managed-component suite 14/14 plus typecheck (`trc_643274123590`).
- GREEN: expanded affected regression set 95/95 across managed components, install state, lifecycle, runtime bundle, settings, local-agent connectivity, publication, and execution audit (`trc_6af8844007f2`).
- GREEN: registered distribution suite 70/70 with 10 pre-existing TODO contracts (`trc_f4d6f5c8c937`).
- GREEN: registered macOS host-isolation and Apple Container Linux/arm64 probes (`trc_ac48158d537f`).
- GREEN: strict task review reports zero findings (`trc_5fae9f8d23df`).
- Grok structured review, both inline findings, and the top-level `☑️ issues found` summary are durable on PR #1601 (`trc_fc802d660ed2`).

## wait outcome

- The original wrapper transport timed out while the bounded provider process continued. Two transport-created duplicate Grok runs were terminated and failed closed with empty output.
- The surviving run completed as `trc_bece22a5a9c3`; the persisted provider envelope was compacted after `CR-002`, but exact finding IDs/content were recovered and independently verified before posting.
- Temporary `packages/os/.tmp-reviews/implement-managed-component-provenance-and-deterministic-update-plan/` and `.task/subagent-runs/` artifacts were removed after the review became durable on GitHub.

- 2026-07-23 21:10:32 write: `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`

## workspace-owned: files changed

- `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`
- `packages/os/.tmp-reviews/implement-managed-component-provenance-and-deterministic-update-plan` (deleted)
- `packages/os/docs/managed-components.md`
- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/managed-components.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/managed-components.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/managed-components.test.ts`
- `packages/os/tests/settings-site.test.ts`

## workspace-owned: activity log

- 2026-07-23 21:10:32 fs.write: `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`
- 2026-07-23 22:07:38 fs.trash: `packages/os/.tmp-reviews/implement-managed-component-provenance-and-deterministic-update-plan`
- 2026-07-23 22:07:38 fs.trash: `.task/subagent-runs`

## workspace-owned: validation evidence

- 2026-07-23 21:11:25 `audit`: failed — COMMAND_FAILED
- 2026-07-23 21:11:49 `review.run`: passed — OK
- 2026-07-23 21:11:58 apply-patch: `packages/os/scripts/lib/managed-components.ts`
- 2026-07-23 21:12:15 `review.run`: passed — OK
- 2026-07-23 21:12:28 `verify`: passed — OK
- 2026-07-23 21:12:48 apply-patch: `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`
- 2026-07-23 21:14:11 apply-patch: `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`
- 2026-07-23 21:14:27 `verify`: passed — OK
- 2026-07-23 21:23:20 apply-patch: `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`
- 2026-07-23 22:07:25 `review.run`: passed — OK
- 2026-07-23 22:07:46 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/docs/managed-components.md`
- `packages/os/scripts/lib/managed-components.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-23 22:06:33 apply-patch: `packages/os/SCRIPTS.md`
- 2026-07-23 22:06:33 apply-patch: `packages/os/docs/managed-components.md`

- 2026-07-23 22:07:38 apply-patch: `.task/os-distribution/implement-managed-component-provenance-and-deterministic-update-plan/workpad.md`
