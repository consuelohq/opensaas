# resolve PR 2060 minor reviews

branch: `task/explore/resolve-pr-2060-minor-reviews`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2281
started: 2026-08-29

## acceptance criteria

- [x] Audit all eight collapsed CodeRabbit minor findings against the current stream head; skip only findings already fixed or made obsolete by the canonical Workspace ExploreBench shim.
- [x] Reject benchmark labels that combine `required: true` with `relevance: 0` so required recall cannot be reported as perfect for dropped required labels.
- [x] Reject missing values for every value-taking canonical OS ExploreBench CLI flag with a clear argument error before consuming the next option or `undefined`.
- [x] Assert inherited install identity is returned without persisting an `install-id` file.
- [x] Guard compact Workspace ExploreBench projections from null/primitive result entries.
- [x] Correct frozen-vector report provenance docs and decision-engine critical test-selection coverage; preserve the already-fixed TOOLS pipe escaping and Workspace ExploreBench compatibility rule; regenerate derived registries rather than hand-editing them.
- [x] Run review.run and verify; merge/publish handoff is ready for `stream/explore` and PR #2060.

## plan

1. Read the current implementations/docs/rules cited by the eight minor findings and classify each as live, fixed, or obsolete.
2. Add focused failing coverage before each live behavioral production fix; documentation/generated-registry-only changes use explicit static validation instead of synthetic runtime tests.
3. Make the smallest fixes, regenerate derived artifacts where required, and run destructive-literal preflight before executing focused tests.
4. Reconcile stream/main test-selection expectations exposed by the focused selector suite, then inspect diff, run review/verify, push and merge PR #2281 into `stream/explore`.

## Test-first contract

behavior under test: benchmark validation must reject required zero-relevance labels; canonical ExploreBench CLI parsing must reject missing option values deterministically; inherited installer identity must remain non-persistent; compact payload projection must tolerate invalid result entries.
existing local pattern: Vitest coverage in `packages/os/tests/explore-bench.test.ts`, `packages/os/tests/semantic-embedding-identity.test.ts`, and `packages/workspace/tests/explore-bench.test.js`; CLI behavior is tested with `spawnSync`.
new or changed tests: zero-relevance-required validation assertion, missing-value CLI cases for the canonical OS parser, explicit no-install-id-file assertion, null/primitive compact-result case, and selector expectations reconciled to current main lifecycle/release/work-session ownership.
focused red command: three affected Vitest files before production fixes.
red evidence: 20 tests ran; 17 passed and exactly 3 failed — required zero-relevance was accepted, missing `--cases` produced an incidental path TypeError instead of a clear missing-value error, and compacting a `null` result crashed. The inherited-ID non-persistence assertion passed immediately, proving implementation behavior was already correct but untested.
no-test waiver: documentation and generated test-selection changes do not need standalone behavioral red tests; they are validated statically and through registry generation/selector tests.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/explore-bench.js`
- `packages/os/scripts/lib/explore-bench.js`
- `packages/os/tests/explore-bench.test.ts`
- `packages/os/tests/semantic-embedding-identity.test.ts`
- `packages/workspace/scripts/lib/explore-bench.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/explore-bench.test.js`
- `packages/workspace/tests/test-selection.test.js`

## review findings

1. required=true + relevance=0 validation — fixed with validation + red/green regression coverage.
2. frozen-vector A/B producer documentation — fixed; docs name the generator and paired metadata invariants including `comparisonRunId`.
3. null/primitive payload.results guard — fixed with red/green regression coverage.
4. TOOLS.md union pipe escaping — already fixed before this task; static check confirms `detail?: "compact" &#124; "full"`.
5. Workspace ExploreBench critical test-selection rule — already fixed before this task as `workspace-explore-bench-compatibility`; source and registry both select the compatibility test.
6. decision-engine handler parity test in critical rule — fixed in `os-explore-retrieval-science`, source and command both include `handler.test.ts`.
7. inherited identity non-persistence assertion — added; behavior was already correct.
8. missing CLI flag values — fixed in the canonical OS parser; the old Workspace-parser half of the review is obsolete because Workspace now delegates through the compatibility shim.

## integration findings

- The full selector suite exposed three exact duplicate explicit rule definitions inherited in the stream/main overlap: `frontend-lint-config-contract`, `obsolete-metering-artifact-contract`, and `native-os-workflow-contract`. They were byte-equivalent duplicates and are now deduplicated.
- The stream carried older Explore-era assertions that generated surfaces and `SCRIPTS.md` should remain inert, while current main deliberately routes them through work-session/lifecycle/release contracts. Rules were reconciled to current main semantics while retaining stream-specific production-release security coverage, and the stale selector expectations were updated accordingly.

## validation

- destructive-literal preflight: clean for all executed test/script sources.
- focused red: 3 expected behavioral failures before implementation changes.
- focused green: 5 files / 86 tests passed, including the full 65-test `test-selection.test.js` suite and decision-engine handler parity.
- registry generation: 2685 tests discovered, 2600 mapped, 85 unmapped; 59 unique explicit rules + 19 auto rules.
- static checks: frozen-vector generator docs present; `comparisonRunId` documented; TOOLS pipe escaped; no duplicate explicit rule IDs; Explore rule/registry run decision-engine handler parity; Workspace ExploreBench compatibility remains critical; production-release security remains owned; control/challenger reports share `comparisonRunId` `26f002f0707216e4`.
- `git diff --check`: clean.
- `review.run --strict --no-tests`: 0 issues, 0 blockers.
- `verify` against `origin/stream/explore`: passed; `publishValid=true`; 0 DB risks.

## errors / recovery

- Initial static TOOLS validation used an over-escaped regex and falsely reported the already-correct `&#124;`; retried once with the literal Markdown text and all static checks passed.
- First post-fix selector run exposed four stream/main integration failures; after reconciling duplicate rules and current-main routing, one release-security ownership failure remained because replacing the release rule from main dropped a stream-specific security test. Restored that source/command entry; the subsequent 86-test run passed.

## tooling gap

- `stream.sync` still has no typed conflict-resolution/continue surface. The earlier stream/main sync therefore required the sanctioned host fallback only inside the temporary sync worktree; this task itself remains task-scoped.

- 2026-08-29 04:39:35 write: `.task/explore/resolve-pr-2060-minor-reviews/workpad.md`

## workspace-owned: files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/explore-bench.js`
- `packages/os/scripts/lib/explore-bench.js`
- `packages/os/tests/explore-bench.test.ts`
- `packages/os/tests/semantic-embedding-identity.test.ts`
- `packages/workspace/scripts/lib/explore-bench.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/explore-bench.test.js`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-08-29 04:39:35 fs.write: `.task/explore/resolve-pr-2060-minor-reviews/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 04:40:12 `review.run`: passed — OK
- 2026-08-29 04:41:02 `verify`: passed — OK
