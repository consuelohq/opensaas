# E5 value-of-information Explore policy challenger

branch: `task/explore/e5-value-of-information-explore-policy-challenger`
stream: `stream/explore`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2094/e5-value-of-information-explore-policy-challenger
github pr: https://github.com/consuelohq/opensaas/pull/2094
started: 2026-08-16

## acceptance criteria

- [x] Add a shadow-only, myopic empirical VOI challenger without changing E4 control decisions.
- [x] Ground read token/latency costs in versioned local trace observations.
- [x] Keep net VOI undefined unless explicit non-negative utility exchange rates are supplied.
- [x] Abstain when empirical relevance/calibration support is insufficient and keep E6 as the only promotion gate.
- [ ] Fail closed when the read-cost artifact is missing or malformed; never interpret missing cost as zero.
- [ ] Pass the focused E5 contracts, the exact Explore critical selector, live task-worktree smoke, strict review, and canonical verify.
- [ ] Push task PR #2094 and promote it into `stream/explore` only.

## plan

1. Preserve E4 as the production/control investigation policy.
2. Add and test a shadow-only myopic VOI research evaluator using empirical rank-bin support and trace-derived acquisition cost.
3. Expose only a compact shadow packet and benchmark diagnostics; never feed E5 output back into E4.
4. Harden abstention/calibration/cost-data boundaries, then run focused and selector validation.
5. Run live task-worktree smoke, strict review, canonical verify, push, and stream promotion.

## current status

- Core E5 implementation and focused science/output tests were completed before a control-facade outage.
- Machine restart restored the OS facade and the managed worktree with all local edits intact.
- Finishing one queued fail-closed cost-data edge, then final validation and publication.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 02:09:05 fs.write: `.task/explore/e5-value-of-information-explore-policy-challenger/workpad.md`
- 2026-08-16 02:10:01 fs.write: `.task/explore/e5-value-of-information-explore-policy-challenger/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 02:09:54 `review.run`: passed — OK
- 2026-08-16 02:10:16 `verify`: passed — OK

## key decisions

- E5 is a shadow research challenger only. `promotion_eligible` is always false; E6 owns promotion.
- `net_voi` is computed only when explicit utility exchange rates are supplied, preserving token/latency/risk units otherwise.
- Current retrieval calibration remains provisional because 10 independent cases is below its declared 50-case calibration floor.
- The objective is a bounded dependency-coverage proxy, not task-success probability, causal uplift, or an exact POMDP value function.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The Consuelo control facade repeatedly returned upstream 502s during the first session. No raw worktree reconstruction was used. After machine restart, task PR #2094 was reattached and the managed local edits were confirmed intact.

## Test-first contract

behavior under test: missing or malformed token/latency acquisition cost must cause E5 to abstain with `insufficient_cost_data`; it must never treat absent cost as free.
existing local pattern: E5 uses explicit abstention statuses (`provisional_evidence`, `insufficient_data`, `insufficient_calibration_cases`, `insufficient_utility_scale`) and keeps E4 control immutable.
new or changed tests: `packages/os/tests/explore-voi-policy.test.ts` adds a malformed/missing cost-model case asserting null recommendation/net VOI and no promotion.
focused red command: `bun --cwd packages/os test tests/explore-voi-policy.test.ts`
expected red failure: current implementation still returns a candidate with null costs and can evaluate missing costs as zero when utility rates are supplied.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/state/evidence-log.js`
- `packages/os/scripts/lib/state/explore-voi-policy.js`
- `packages/os/streams/explore/AGENTS.md`
- `packages/os/tests/explore-bench.test.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/explore-voi-policy.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/streams/explore/AGENTS.md`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/typeorm-cli-contract.test.mjs`

## Final validation evidence (pre-review)

- Missing/malformed empirical read-cost data now fails closed as `insufficient_cost_data`; focused VOI suite: 7/7 tests, 25 assertions.
- E5-owned science/output/benchmark suite: 16/16 tests, 56 assertions.
- Authoritative changed-file selector: `test-selection.js check --base origin/stream/explore --run --json` selected 5 focused suites and all 5 passed. The historical package-wide OS suite is not selected.
- Live task-worktree Explore CLI smoke was attempted twice with an in-memory backup/`finally` restore of `.task/explore-state.json` and `.task/evidence-log.json`. Both real CLI runs reset the task-scoped MCP transport before the result packet returned. After each attempt, the generic Explore state was verified restored to its original query. Do not retry this smoke again in E5; treat it as a reproducible control-facade/runtime interaction, not evidence of an E5 policy failure.
- Current managed task worktree still contains the expected E5 source, tests, scientific spec, cost artifact, selector registry/rule, and task metadata changes; no manual reconstruction was used.
- Pending: syntax/type validation, strict review, canonical verify, task push, PR scope verification, stream promotion, task cleanup.

- 2026-08-16 02:09:05 append: `.task/explore/e5-value-of-information-explore-policy-challenger/workpad.md`

## Strict review

- `review.run --base origin/stream/explore --strict --mine --no-tests`: 0 owned issues, 0 pre-existing issues, 0 blockers, 0 documentation opportunities.
- Review scoped the changed Explore implementation/tests correctly; test execution remained delegated to the already-green authoritative selector.
- Syntax/type validation: `bun run --cwd packages/os typecheck` green; direct `node --check` green for `explore.js`, `explore-bench.js`, `explore-output.js`, and `explore-voi-policy.js`; `git diff --check` green.
- Next: canonical verify, then no further source/workpad mutation before push unless verify finds an issue.

- 2026-08-16 02:10:01 append: `.task/explore/e5-value-of-information-explore-policy-challenger/workpad.md`
