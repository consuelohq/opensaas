# connect github source control from stream

branch: `task/workspace-agents/connect-github-source-control-from-stream`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2183/connect-github-source-control-from-stream
github pr: https://github.com/consuelohq/opensaas/pull/2183
started: 2026-08-26

## acceptance criteria

- [x] Port the already reviewed GitHub App source-control onboarding change from task PR #2178 onto the actual stream base without importing unrelated `main` history.
- [x] `/diffs` offers a direct **Connect GitHub** action and Configuration hides internal connection-binding plumbing.
- [x] Device Authority owns GitHub App credentials and mints short-lived installation tokens; browser receives only an opaque one-time handoff.
- [x] GitHub repository/default-branch metadata comes from GitHub and existing static/manual credential bindings remain compatible.
- [x] Focused source-control/security/UI/gateway tests pass on the stream base, strict review is clean, canonical verify against `origin/stream/workspace-agents` passes, and browser proof is repeated.
- [ ] Task merges cleanly into `stream/workspace-agents` and the stream review PR is created/refreshed.
- [x] Do not create/install/configure the production GitHub App or mutate GitHub organization security settings without separate approval.

## plan

1. Recover from PR #2178's base-divergence conflict by creating this fresh task directly from `stream/workspace-agents`.
2. Port only commit `679703e791e69bfec95addbbfa0e02414846c182`'s product/test/test-selection changes, excluding old task metadata and unrelated main history.
3. Resolve only task-owned overlaps against stream code; do not choose ours/theirs for unrelated stream work.
4. Rerun focused source-control tests, edge contracts, browser proof, strict review, and verify against the stream base.
5. Push, promote through `task.pr`, finish, and treat PR #2178 as superseded.

## Test-first contract

- behavior under test: the validated GitHub App onboarding flow remains correct when integrated against the real `stream/workspace-agents` base, including direct Connect GitHub UX, signed Device Authority handoff, repository hydration, opaque managed bindings, short-lived token brokering, and edge routing.
- existing local pattern: the source-control/Diffs/settings implementation already present on `stream/workspace-agents`, plus the focused tests from validated task commit `679703e`.
- new or changed tests: port the focused tests from `679703e` and adapt them only when stream-local contracts differ; preserve the test-selection contract that avoids the unrelated historically red broad OS suite.
- focused red command: after the product/test patch is staged on the stream base, run the focused Vitest source-control selection before any conflict-specific production adaptation.
- expected red failure: any stream-local API/route/schema drift introduced since the original main-based implementation should surface as focused compilation/behavior failures rather than being hidden by unrelated merge conflicts.
- no-test waiver: not applicable.

## current status

- Recovery task created from the actual stream base after PR #2178 could not merge because the original task was started from `main` while `stream/workspace-agents` is an older/diverged integration branch.
- Implementation, stream-port conflict recovery, focused tests, browser proof, strict review, and canonical verify are complete. Ready to push and promote PR #2183 into `stream/workspace-agents`.
- First recovery start used the literal branch name for `startFrom` and was rejected; the supported value is `startFrom: "stream"` (trace `trc_a28df09a94c4`). Retry succeeded as PR #2183 / taskSession `tsk_265a7e485b6f` (trace `trc_f84983ee2f59`).
- The task filesystem facade currently fails to resolve this valid task branch even though local current/session metadata and durable registry entry exist; evidence `trc_dc37de79f380`, registry/candidate proof `trc_3a9436fad8d6`. Using narrowly scoped `code.call` filesystem/git fallback inside this exact task worktree until the facade catches up.
- The validated commit was ported with a no-commit cherry-pick. Only four task-owned conflicts appeared: `settings-site.test.ts`, the test-selection rules/registry, and the test-selection test. Stream content was preserved and only the GitHub source-control assertions/rule/test were integrated; old PR #2178 task metadata was removed. Recovery trace: `trc_4174f54dd37e`.
- Stream-focused source-control validation initially had exactly one stale stream assertion expecting the removed manual `connection binding`; 70/71 tests passed (`trc_3c53a722896c`). Removing those stale manual-UX assertions made all 7 focused files / 71 tests green (`trc_56fd610cd87c`).
- Test-selection integration followed RED/GREEN on the stream implementation. RED before registry generation selected only the broad OS suite (`trc_a3dc0b1518d0`). After generation, the explicit critical rule correctly matched but stream semantics still report the suppressed auto rule as a *matched* rule; the test was adapted to assert the actual safety contract—only the focused GitHub suite is selected. GREEN: `trc_6e9c00208fc4`.
- Browser proof repeated on the stream base: Configuration renders `Manage GitHub access`, `consuelohq/opensaas`, `main`, and `GitHub` with no manual binding form (`trc_badab9db97d7`); Diffs renders the direct `Connect GitHub` CTA (`trc_c06af6bdd937`), and the CTA reaches the GitHub-connect route in the local preview (`trc_b737fbfbfa54`). Preview server was closed and PID 67338 terminated (`trc_f056c2b891e7`, `trc_955ae16e3135`).
- Audit still fails only on repository-wide pre-existing drift: script-doc parity, 9,756 stale doc paths, and stale/deleted index entries; no task-specific audit finding was identified (`trc_b92c8f7f3522`).
- The first complete selection run revealed the stream selector still chose the broad OS package suite because six GitHub task files were not covered by the explicit critical source set (`trc_9795e4824c7d`). Expanded the critical rule/test to cover all GitHub task-owned OS code, regenerated the registry (`trc_076b4df4163b`), focused test passed (`trc_259d4f5c5338`), and selection now chooses only four focused suites (`trc_ad8a0c4398b9`). Full selected gate passed all four (`trc_c67aa1b347f6`).
- Final strict review against `origin/stream/workspace-agents` is clean: 0 task-owned, pre-existing, or blocking issues (`trc_1d153301e525`). Canonical full verify passes and is publish-valid (`trc_e58a155961db`); DB guard reports only the expected route-seed warning with 0 findings.

## key decisions

- Fresh stream-based task instead of force-rebasing PR #2178 or syncing the shared stream to main. This preserves parallel-agent safety and avoids rewriting remote task state or importing dozens of unrelated conflicts.
- Port the single validated commit only; exclude old `.task` metadata.
- Keep production GitHub App creation/installation outside this repo task.

## files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/source-control-config.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`
- `packages/os/tests/github-source-control-authority.test.ts`
- `packages/os/tests/settings-hono-routes.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## validation evidence

- Original implementation is fully validated in PR #2178 / commit `679703e`: focused security/UI/runtime tests green, strict review clean, browser proof green, and canonical verify publish-valid. This recovery task will repeat validation on the stream base.

## issues and recovery

- PR #2178 failed `task.pr` with GitHub 405 merge conflicts because it was based on `main` rather than the stream. A read-only merge-tree showed many unrelated changed-in-both files, so resolving that PR directly would violate narrow blast radius and parallel-agent safety. This task is the safe recovery path.
- Task-scoped `fs.read/fs.write` cannot currently discover PR #2183 despite valid local/durable metadata. Fallback is restricted to the known recovery worktree and will be removed from the workflow once normal task tooling resumes.

## notes for ko

- PR #2178 is superseded by this stream-based recovery PR. We will not close or rewrite it until the new promotion succeeds.

## workspace-owned: validation evidence

- Original implementation is fully validated in PR #2178 / commit `679703e`: focused security/UI/runtime tests green, strict review clean, browser proof green, and canonical verify publish-valid. This recovery task will repeat validation on the stream base.
- 2026-08-26 02:09:01 `checkFiles`: passed — OK
- 2026-08-26 02:09:37 `review.run`: passed — OK
- 2026-08-26 02:11:08 `audit`: failed — COMMAND_FAILED
- 2026-08-26 02:12:10 `review.run`: passed — OK
- 2026-08-26 02:12:22 `verify`: passed — OK
- 2026-08-26 02:13:46 `verify`: passed — OK
