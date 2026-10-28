# E4 unified Explore policy

branch: `task/explore/e4-unified-explore-policy`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2083
started: 2026-08-15

## acceptance criteria

- [x] One shared Explore policy evaluator is the source of truth for readiness, dependency map, uncertainty, next action, and edit target.
- [x] `explore` returns the policy packet directly in structured and compact output.
- [x] `confidenceScore` and `decideNext` project the shared policy rather than maintaining independent decision rules.
- [x] Default `exploit` uses the shared policy and cannot bypass a non-edit-ready investigation; explicit target override remains for compatibility.
- [x] Agent guidance teaches `explore -> policy.next_action -> evidence -> explore -> edit_ready` as the normal loop.
- [x] The new policy module is included in critical Explore test selection.
- [x] Reproduce live CLI policy output on the recovered task state.
- [x] Refresh generated tool/skill surfaces and validate exact critical tests.
- [ ] Pass strict review and canonical verify.
- [ ] Push and promote into `stream/explore`.

## plan

1. Recover the existing managed task worktree and verify local E4 edits were preserved.
2. Reproduce the focused E3+E4 contracts and live Explore policy packet.
3. Refresh generated manifest/registry surfaces required by schema/skill changes.
4. Run critical test-selection/runtime validation and syntax/type checks.
5. Inspect the exact diff, run strict review and canonical verify.
6. Push task PR #2083, promote it to `stream/explore`, and finish the task.

## Test-first contract

behavior under test:
- a single shared policy determines categorical readiness and next action;
- compatibility commands are projections of that policy;
- default exploit cannot choose an edit target unless the unified policy is edit-ready;
- compact Explore output retains the policy packet.

existing local pattern:
- E3 `explore-hypothesis-model` owns hypothesis grouping/readiness primitives;
- Explore output-contract tests own the compact response contract;
- manifest/test-selection tests own registered tool and critical-file behavior.

new or changed tests:
- `packages/os/tests/explore-hypothesis-model.test.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

focused red command:
- prior session ran the focused E3+E4 Vitest set before implementation.

expected red failure:
- `explore-policy.js` did not exist and Explore had no unified `policy` packet.

red evidence:
- prior agent recorded the expected missing-policy-module / missing-policy-packet RED before implementation.

no-test waiver: not applicable.

## current status

- Recovered the existing worktree after the OS control-facade outage; no E4 source was lost.
- Refreshed the manifest characterization fixture from `buildToolManifest({ write: false })` and ran the canonical tool-manifest + skills-registry generators.
- Reproduced focused and critical Explore suites, type/syntax checks, test-selection routing, and a real CLI policy packet.
- Ready for strict review + canonical verify.

## files changed

- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/scripts/lib/state/explore-policy.js`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/explore-hypothesis-model.test.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/decision-engine/schema.ts`
- `packages/workspace/test-selection.rules.json`

## key decisions

- Readiness remains categorical and explicitly non-probabilistic.
- E4 does not replace E3 hypothesis construction; it composes those primitives into one policy front door.
- Legacy `confidenceScore`, `decideNext`, and `exploit` remain compatibility interfaces, but agents should normally follow the policy returned by `explore`.
- Explicit exploit target override remains for backwards compatibility; only default exploit is gated by `edit_ready`.
- Stateful live Explore smoke evidence is not committed into the generic root `.task/evidence-log.json` / `.task/explore-state.json`; those files were restored after the smoke proof to avoid unrelated shared-state churn.

## issues and recovery

- Previous session was interrupted by persistent OS/workspace MCP 502s before runtime verification, review, verify, push, or promotion.
- On recovery, `task.start` reattached to the existing task/worktree/PR without creating replacements. Local git status confirmed all E4 changes were preserved.
- Old `packages/workspace/scripts/*` paths are stale for this implementation; current Explore source is under `packages/os/scripts/*`.
- The first generated-surface command used incorrect Bun argument ordering and only printed scripts; rerunning with `bun run --cwd packages/os <script>` correctly generated manifests/registry.
- The live CLI smoke initially used `code.call` verify mode. Explore itself succeeded and returned the policy packet, but the wrapper correctly flagged that Explore persisted state. The shared root task-state files were restored after capturing the proof.

## validation evidence

- Focused E4/manifest suite: 3 files, **36/36 tests passed**.
- Critical `os-explore-retrieval-science` selector suite: 9 files, **55/55 tests passed**.
- Safety preflight: all nine critical test files were read before execution; they use mocked HTTP/in-memory state/temp directories and contain no host-destructive commands.
- `bun run --cwd packages/os typecheck`: **passed** (`workspace script syntax checks passed`).
- `node packages/workspace/scripts/test-selection.js check`: **passed**; `os-explore-retrieval-science` selected as a critical rule.
- Tool manifest generator: wrote 159-tool full manifest + 13-tool core manifest + workflow bundles.
- Skills registry generator: wrote 11-skill registry.
- Live task-worktree Explore CLI (semantic gateway forced to closed localhost to exercise lexical fallback): **exit 0**, compact JSON contained `policy_version: 1`, categorical `gathering` readiness, `edit_ready: false`, dependency map, uncertainty reasons, and `next_action = read packages/os/scripts/lib/state/explore-state.js`.
- The currently installed typed `explore` runtime still executes the pre-E4 main/workspace implementation, as expected before this task is published; it is not used as evidence for unpublished task code.

## next

Run strict review and canonical verify on this exact state, then push #2083, promote it into `stream/explore`, finish task cleanup, and only then begin E5.

- 2026-08-15 20:11:26 write: `.task/explore/e4-unified-explore-policy/workpad.md`

## workspace-owned: files changed

- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/scripts/lib/state/explore-policy.js`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/explore-hypothesis-model.test.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/decision-engine/schema.ts`
- `packages/workspace/test-selection.rules.json`

## workspace-owned: activity log

- 2026-08-15 20:11:26 fs.write: `.task/explore/e4-unified-explore-policy/workpad.md`
- 2026-08-15 20:15:03 fs.write: `.task/explore/e4-unified-explore-policy/workpad.md`
- 2026-08-15 20:16:49 fs.write: `.task/explore/e4-unified-explore-policy/workpad.md`

## workspace-owned: validation evidence

- Focused E4/manifest suite: 3 files, **36/36 tests passed**.
- Critical `os-explore-retrieval-science` selector suite: 9 files, **55/55 tests passed**.
- Safety preflight: all nine critical test files were read before execution; they use mocked HTTP/in-memory state/temp directories and contain no host-destructive commands.
- `bun run --cwd packages/os typecheck`: **passed** (`workspace script syntax checks passed`).
- `node packages/workspace/scripts/test-selection.js check`: **passed**; `os-explore-retrieval-science` selected as a critical rule.
- Tool manifest generator: wrote 159-tool full manifest + 13-tool core manifest + workflow bundles.
- Skills registry generator: wrote 11-skill registry.
- Live task-worktree Explore CLI (semantic gateway forced to closed localhost to exercise lexical fallback): **exit 0**, compact JSON contained `policy_version: 1`, categorical `gathering` readiness, `edit_ready: false`, dependency map, uncertainty reasons, and `next_action = read packages/os/scripts/lib/state/explore-state.js`.
- The currently installed typed `explore` runtime still executes the pre-E4 main/workspace implementation, as expected before this task is published; it is not used as evidence for unpublished task code.
- 2026-08-15 20:11:56 `review.run`: passed — OK
- 2026-08-15 20:13:11 `verify`: failed — COMMAND_FAILED
- 2026-08-15 20:17:04 `review.run`: passed — OK
- 2026-08-15 20:17:29 `verify`: passed — OK

## workspace-owned: files read

- `packages/workspace/tests/test-selection.test.js`

## Late publish-gate regression contract

behavior under test:
- E4's Explore policy source plus its two Explore-facing bundled skill changes must remain fully owned by the exclusive `os-explore-retrieval-science` rule;
- the selector must not re-add the historically red auto `@consuelo/os package test` for that E4 change set.

existing local pattern:
- `packages/workspace/tests/test-selection.test.js` already proves that focused/exclusive OS rules suppress broad auto package tests when all changed package code is explicitly covered.

new test:
- add an E4-specific selector case using `explore-policy.js`, `skills/senior-engineer/SKILL.md`, and `skills/task/SKILL.md`.

focused red command:
- `bun x vitest run packages/workspace/tests/test-selection.test.js -t "keeps E4 unified Explore policy skill changes on the focused Explore suite"`

expected red failure:
- selector currently includes `@consuelo/os package test` because the two changed skill files are not in `os-explore-retrieval-science.source`.

no-test waiver: not applicable.

- 2026-08-15 20:15:03 append: `.task/explore/e4-unified-explore-policy/workpad.md`

- 2026-08-15 20:15:10 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-15 20:15:24 apply-patch: `packages/workspace/test-selection.rules.json`
### Late publish-gate regression evidence

- RED: E4 selector regression test failed because the changed Explore policy + bundled skill files selected only `auto:@consuelo/os:package-test`.
- Fix: added `packages/os/skills/senior-engineer/SKILL.md` and `packages/os/skills/task/SKILL.md` to the exclusive `os-explore-retrieval-science` source set and regenerated `packages/workspace/test-selection.registry.json`.
- GREEN focused selector test: 1/1 passed.
- Post-fix selector for `--base origin/stream/explore`: broad `@consuelo/os package test` absent.
- Safety preflight: every exact selected test/validation source was inspected before execution. Lifecycle/platform tests mutate temp fixtures or use injected process runners; workflow/server selector tests are read-only or mocked; syntax validation only runs `node --check`.
- Exact canonical selector `check --base origin/stream/explore --run --json`: **8/8 selected suites passed**:
  - workspace test selection tests
  - OS Explore retrieval science contracts
  - OS lifecycle update handoff contracts
  - OS lifecycle syntax contracts
  - OS lifecycle facade snapshots
  - changed server task selector tests
  - GitHub workflow policy tests
  - TypeORM CLI compatibility contract

- 2026-08-15 20:16:49 append: `.task/explore/e4-unified-explore-policy/workpad.md`
