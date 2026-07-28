# Worker 23a Domain Audit Report: Core Runtime, Lifecycle, and Recovery

## Audit coordinates

- Authoritative GitHub review surface: [PR #1674](https://github.com/consuelohq/opensaas/pull/1674), merged and immutable
- Review-only task PR: [PR #1688](https://github.com/consuelohq/opensaas/pull/1688)
- Assigned audit stream: `stream/os-foundation-two`
- Baseline SHA: `702053057d19c066607d4508b49d42b183d17b32`
- Candidate SHA: `ef2530b136ec2a170915b583abfb2341899bd6ab`
- PR merge commit: `a2b591bbc35125aa1702422a19424ac91900283a`
- Domain brief: `packages/os/plans/consuelo-os-foundation/workers/23a-core-runtime-lifecycle-recovery-audit.md`
- Reviewer task/session: `core-runtime-lifecycle-recovery-audit-round-1-independent-rerun` / `tsk_5c202dad605d`
- Review round: `1`
- Final domain status: `DOMAIN CONDITIONAL`

PR #1674 is the authorized ordinary promotion surface for this completed wave. The missing synthetic `audit/*` coordinates are process debt, not a product-review blocker. Current `main` was compared with the immutable candidate; no post-candidate change under the Worker 23a product paths was found, so task-worktree product reads were candidate-equivalent while all conclusions remain pinned to the exact candidate SHA above.

## Original-intent lineage

| Original worker prompt | Exact requirement/section | Authoritative domain | Secondary seam reviewers | Implementation and repair PRs | Current implementation location | Automated evidence | Runtime/live evidence | Status | Remediation |
| ---------------------- | ------------------------- | -------------------- | ------------------------ | ----------------------------- | ------------------------------- | ------------------ | --------------------- | ------ | ----------- |
| Worker 01, `01-distribution-test-harness.md` | Registered Linux/macOS/Windows environments, deterministic artifact fixtures, failure injection, and clean-host lifecycle contracts | 23A | Platform and release domains consume evidence but do not own lifecycle disposition | [#1544](https://github.com/consuelohq/opensaas/pull/1544) | `.github/workflows/consuelo-os-distribution-environments.yaml`; `packages/os/scripts/testing/distribution/`; `packages/os/tests/distribution/` | Distribution suite: 77 passed, seven lifecycle TODOs; typecheck passed | Exact-candidate registered platform run unavailable because Worker 24 integration lineage was not promoted | Partial; evidence harness exists but candidate integration gate is incomplete | Resolve `23A-R01-002`, then rerun every registered platform lane with candidate and artifact identity recorded |
| Worker 04, `04-lifecycle-engine.md` | One lifecycle authority; lock and journal safety; atomic activation; health acceptance; rollback; migrations; install, update, status, repair, and service lifecycle semantics | 23A | Provider and platform reviewers may verify adapters; 23A owns lifecycle disposition | [#1578](https://github.com/consuelohq/opensaas/pull/1578), [#1584](https://github.com/consuelohq/opensaas/pull/1584) | `packages/os/scripts/lib/lifecycle/engine.ts`; `lock.ts`; `release.ts`; `runtime.ts`; `migrations.ts`; `service.ts`; `state.ts` | Focused domain suite passed 109/109 | Disposable-home evidence exists; no authorized Ko-machine mutation | Conditional; normal-path transaction coverage is strong, but interrupted activation can split live service and link state | Resolve `23A-R01-003` with crash-boundary service and health evidence |
| Worker 05, `05-retention-rollback-uninstall.md` | Retain current, previous, pinned, and unresolved bases; symlink-safe pruning; deterministic recovery; default-preserving uninstall; explicit destructive reset only | 23A | Security and platform domains may inspect preservation seams; 23A owns lifecycle state | [#1600](https://github.com/consuelohq/opensaas/pull/1600), [#1605](https://github.com/consuelohq/opensaas/pull/1605) | `packages/os/scripts/lib/lifecycle/retention.ts`; `uninstall.ts`; `engine.ts`; lifecycle state files | Retention/uninstall tests included in 109/109 focused pass | No real-machine rollback or uninstall checkpoint was authorized | Implemented for tested paths; recovery remains incomplete across the live-service boundary | Resolve `23A-R01-003`; retain existing post-commit retention semantics |
| Worker 06, `06-managed-components.md` | Provenance, deterministic planning, three-way merge, conflict preservation, unresolved-base retention, and no silent overwrite | 23A | Security may inspect sensitive content; 23A owns managed lifecycle disposition | [#1601](https://github.com/consuelohq/opensaas/pull/1601) | `packages/os/scripts/lib/managed-components.ts`; `managed-component-install.ts`; lifecycle retention state | Managed-component focused tests passed in the 109/109 set | Exact-candidate clean-host conflict journey unavailable because Worker 24 lane is absent | Implementation present; integrated candidate proof incomplete | Resolve `23A-R01-002` and execute the managed-conflict journey against the next candidate |
| Worker 07, `07-steering-runtime-context.md` | Installed skills, safe node/workspace/channel context, compact update summary and preference, portable redacted output, and exclusion of `decision.md` | 23A | Security reviews redaction; platform reviews node adapters; 23A owns steering lifecycle contract | [#1640](https://github.com/consuelohq/opensaas/pull/1640) | Candidate still uses `packages/os/scripts/lib/install-state.ts:223` and `packages/os/scripts/os.ts:497-527`; PR #1640's dedicated steering context is absent | Candidate install/steering tests pass but encode the obsolete `decision.md` behavior | No candidate runtime evidence for the omitted Worker 07 surface | Missing from candidate due diverged stream lineage | Resolve `23A-R01-001` by promoting or narrowly reapplying PR #1640 and rerunning negative safety tests |
| Worker 24, `24-distribution-integration.md` | Replace placeholder contracts with executable end-to-end distribution integration and preserve exact candidate/platform evidence | 23A | Platform and release domains consume the lane; 23A owns lifecycle journey completeness | [#1663](https://github.com/consuelohq/opensaas/pull/1663) | Candidate retains `packages/os/tests/distribution/lifecycle-contract.test.ts:6-12` as seven TODOs; PR #1663 runner/tests are absent | Candidate distribution suite reports seven TODOs | No exact-candidate Worker 24 clean-host run exists | Missing from candidate due diverged stream lineage | Resolve `23A-R01-002` by promoting or narrowly reapplying PR #1663 and rerunning the platform matrix |

Worker 07 merge commit `ef4b0f0352c4eb8bcc5248be7c7962c7fb2968b1` and Worker 24 merge commit `37b083f2eaf0ec406c5de67269fa84a101b05cfa` both diverge from candidate `ef2530b136ec2a170915b583abfb2341899bd6ab`. Their absence is therefore verified promotion loss, not inference from missing files alone.

## Required GitHub review outputs

- Finding `23A-R01-001`: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098961444)
- Finding `23A-R01-002`: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098963021)
- Finding `23A-R01-003`: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098964745)
- Finding `23A-R01-004`: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098966417)
- Structured review object: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098968315)
- Top-level review summary: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098968913)
- Consolidated agent-fix prompt: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098969712)
- Unavailable evidence and tooling failures: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538)
- Final domain status: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098971539)
- Current finding-disposition index: [GitHub comment](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098975213)

## High-signal code-review findings

| Finding ID | Priority / severity | Category | Location | Risk | GitHub thread | Disposition |
| ---------- | ------------------- | -------- | -------- | ---- | ------------- | ----------- |
| `23A-R01-001` | P1 / high | Architecture | `install-state.ts:223`; `os.ts:497-527` | Final candidate omits completed Worker 07 steering behavior, retains `decision.md`, and exposes incomplete machine-local context | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098961444) | open |
| `23A-R01-002` | P1 / high | Tests | `tests/distribution/lifecycle-contract.test.ts:6-12` | Final candidate omits Worker 24 executable integration and leaves seven launch-critical journeys as TODOs | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098963021) | open |
| `23A-R01-003` | P1 / high | Reliability | `retention.ts:229-270`; `engine.ts:143-165,513-535` | Crash recovery can repoint links without relaunching and health-accepting the restored service, creating split brain | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098964745) | open |
| `23A-R01-004` | P2 / medium | Observability | `diagnostics.ts:37-52`; `native-lifecycle-endpoint.ts:354-360` | One JSONL file grows indefinitely and export reads it synchronously in full | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098966417) | open |

Finding counts: P0 `0`; P1 `3`; P2 `1`; P3 `0`.

## Evidence executed

| Test, CI lane, runtime journey, or inspection | Exact command or GitHub link | Environment | Result | Applies to candidate SHA |
| --------------------------------------------- | ---------------------------- | ----------- | ------ | ------------------------ |
| Immutable PR identity and retained comparison | [PR #1674](https://github.com/consuelohq/opensaas/pull/1674) plus GitHub API metadata and all 63 changed files | GitHub | Base, candidate, merge commit, and retained diff frozen | yes |
| Candidate-to-current product equivalence | GitHub compare `ef2530b136ec2a170915b583abfb2341899bd6ab...main`, filtered to OS scripts, tests, manifests, and tools | GitHub | No post-candidate Worker 23a product path changed | yes |
| Focused lifecycle, retention, service-contract, managed-component, install-state, steering, and skill registry tests | `bun --cwd packages/os vitest run tests/lifecycle-engine.test.ts tests/lifecycle-retention-uninstall.test.ts tests/lifecycle-restart-contract.test.ts tests/managed-components.test.ts tests/install-state.test.ts tests/os-get-steering-trace.test.ts tests/skills-registry.test.ts` | Assigned task worktree, disposable fixtures | 7 files; 109/109 passed; trace `trc_d7fd32086985` | yes |
| Distribution tests and typecheck | `bun --cwd packages/os vitest run tests/distribution` and `bun run --cwd packages/os typecheck` | Assigned task worktree | Distribution: 77 passed, one skipped file, seven TODOs; typecheck passed; trace `trc_95f2b3908c52` | yes |
| Broad OS suite | `bun run --cwd packages/os test` | Assigned task worktree | Failed: 19 files failed, 192 passed, 18 skipped; 75 tests failed, 1882 passed, 138 skipped, seven TODOs; trace `trc_57419efa9552` | yes, but failures required isolation |
| Detached lifecycle operation isolation | `bun --cwd packages/os vitest run tests/native-lifecycle-operation.test.ts --reporter=verbose` | Assigned task worktree | 6 failed, 5 passed; tests omit required queued-state setup, so classified as test-fixture drift rather than a runtime finding; trace `trc_aa57f2d31010` | yes |
| Onboarding isolation | `bun --cwd packages/os vitest run scripts/onboarding-flow.test.ts --reporter=verbose` | Assigned task worktree | 2 exact-string failures, 20 passed; equivalent prompt/log-directory behavior exists in source; trace `trc_ebea0c226aa2` | yes |
| Script parity and generated-manifest isolation | `bun --cwd packages/os vitest run tests/audit/script-parity-audit.test.ts tests/code-call.test.ts --reporter=verbose` | Assigned task worktree | Parity baseline omits current scripts; generated manifest absent; 2 failures, 25 passes; trace `trc_49e657e22562` | yes; evidence debt recorded |
| PR #1674 CI | GitHub checks on [PR #1674](https://github.com/consuelohq/opensaas/pull/1674) | GitHub-hosted/provider CI | 46 checks; `Workers Builds: opensaas` failed and `congratulate` was cancelled; neither is a Worker 23a runtime lane | yes |
| Worker 07 lineage | [PR #1640](https://github.com/consuelohq/opensaas/pull/1640) and compare from merge commit to candidate | GitHub | Diverged: 22 commits ahead, 33 behind, merge base `14830da418b04868bdf46bced64aa0dbe066e108` | yes |
| Worker 24 lineage | [PR #1663](https://github.com/consuelohq/opensaas/pull/1663) and compare from merge commit to candidate | GitHub | Diverged: 19 commits ahead, 39 behind, merge base `313c595e11133036f6e2fd5467561a9e354af1fc` | yes |
| Structured review schema validation | Parsed `review-records/structured-review.json`; required schema and four deterministic IDs asserted | Assigned task worktree | Passed; trace `trc_f3b4d4f7d242` | yes |

Focused green tests do not neutralize the findings. Candidate tests currently assert `decision.md` installation, omit service-aware interrupted recovery, and leave the Worker 24 distribution contracts as TODOs.

## Existing review dispositions

| Source | Finding or thread | Current status | Verification evidence | GitHub disposition |
| ------ | ----------------- | -------------- | --------------------- | ------------------ |
| Prior Worker 23A | Missing synthetic audit coordinates | obsolete/superseded | This kickoff explicitly authorizes PR #1674 and the exact candidate; complete product inspection is now recorded | [original](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5097770162), [index](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098975213) |
| Codex | Domain report lacked explicit links for structured review, summary, and consolidated prompt | fixed | PR #1678 added the schema; this completed report populates every link | [original](https://github.com/consuelohq/opensaas/pull/1674#discussion_r3660067944), [repair PR](https://github.com/consuelohq/opensaas/pull/1678) |
| CodeRabbit | Placeholder lineage row had fewer cells than the ten-column header | fixed in audit task | This report replaces the placeholder with complete ten-cell rows | [original](https://github.com/consuelohq/opensaas/pull/1674#discussion_r3660656757), [repair PR](https://github.com/consuelohq/opensaas/pull/1688) |
| Qodo and other bot approvals | Audit-plan summaries and approvals | informational | Independently inspected code, tests, lineage, and candidate; no bot approval was treated as proof | [PR reviews](https://github.com/consuelohq/opensaas/pull/1674) |
| Human/orchestrator review | Ownership, serialized ledger, and report-validation issues | repaired outside 23A product ownership | Current Worker 23 plan assigns one authoritative domain and sole ledger writer | [PR reviews](https://github.com/consuelohq/opensaas/pull/1674) |

No existing open PR #1674 finding duplicates the four `23A-R01-*` product findings.

## Proposed deterministic ledger rows for Worker 23

Worker 23 is the sole writer of `finding-ledger.md`. The following rows are proposed; this review does not edit the shared ledger.

| Finding ID | Authoritative domain | Source reviewer | Priority / severity | Category | GitHub thread | Original worker prompt and requirement | Owner | Synthesis verifier | Replacement rationale | Repair PR | Validation evidence | Candidate SHA verified | Disposition | Ko waiver |
| ---------- | -------------------- | --------------- | ------------------- | -------- | ------------- | -------------------------------------- | ----- | ------------------ | --------------------- | --------- | ------------------- | ---------------------- | ----------- | --------- |
| `23A-R01-001` | 23A | Worker 23A | P1 / high | Architecture | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098961444) | Worker 07: installed skills, safe node/workspace/channel/update context, exclude `decision.md` | unassigned narrow repair worker | Worker 23h after 23A re-review | none; original Worker 07 implementation was omitted from candidate | not assigned | Promote or reapply PR #1640; focused install/steering and negative safety tests; exact candidate platform evidence | `ef2530b136ec2a170915b583abfb2341899bd6ab` | open | none |
| `23A-R01-002` | 23A | Worker 23A | P1 / high | Tests | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098963021) | Worker 24 and Worker 01: executable clean-host distribution integration and registered platform evidence | unassigned narrow repair worker | Worker 23h after 23A re-review | none; original Worker 24 implementation was omitted from candidate | not assigned | Promote or reapply PR #1663; execute all seven journeys and registered platform matrix with exact SHA/artifact identity | `ef2530b136ec2a170915b583abfb2341899bd6ab` | open | none |
| `23A-R01-003` | 23A | Worker 23A | P1 / high | Reliability | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098964745) | Workers 04 and 05: deterministic interruption recovery, no split brain, health-gated rollback | unassigned narrow repair worker | Worker 23h after 23A re-review | none | not assigned | Crash after service relaunch before health; prove restored release relaunch and health acceptance; status/check-only consistency | `ef2530b136ec2a170915b583abfb2341899bd6ab` | open | none |
| `23A-R01-004` | 23A | Worker 23A | P2 / medium | Observability | [thread](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098966417) | Worker 23a acceptance: lifecycle diagnostics are redacted and bounded | unassigned narrow repair worker | Worker 23h after 23A re-review | none | not assigned | High-volume bound, bounded-tail export, redaction, permissions, and symlink-containment tests | `ef2530b136ec2a170915b583abfb2341899bd6ab` | open | none |

## Unavailable evidence and assumptions

| Item | Reason | Risk | Launch effect | Exact next action | GitHub record |
| ---- | ------ | ---- | ------------- | ----------------- | ------------- |
| Exact-candidate Worker 24 clean-host/platform evidence | PR #1663 diverged from the final candidate | Required lifecycle journeys remain unexecuted at the promotion SHA | Blocks domain clear | Promote or narrowly reapply PR #1663, then run the registered Linux/macOS/Windows matrix with exact SHA and artifact identity | [limitations](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538) |
| Ko-controlled real-machine acceptance | Worker 23a forbids reviewer mutation of the Mac Mini and MacBook Air; candidate is not ready for a checkpoint while P1 findings remain open | Disposable fixtures cannot prove every installed-host interaction | Does not block code inspection; required before final launch clear | After a repaired immutable candidate passes CI, Worker 23/24 must issue Ko the registry-approved command, expected result, and evidence request for the MacBook Air canary then beta checkpoint | [limitations](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538) |
| Broad OS suite is not green | Mixed stale tests, generated artifacts, and unrelated repository failures | Reduces confidence in repository-wide regression evidence | Domain remains conditional; focused evidence remains usable | Repair evidence drift separately and rerun the broad suite without changing 23A finding ownership | [limitations](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538) |
| Two non-green PR checks | Cloudflare deployment build failed; congratulatory CI job cancelled | Promotion surface is not wholly green, though neither check exercises 23A runtime | Record for synthesis; not a substitute for runtime validation | Worker 23/23h must disposition these checks in release synthesis | [limitations](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538) |
| OS tool routing failures | Ambiguous unscoped task, nested batch session propagation, malformed query inputs, and one dangerous-material false positive | Could have obscured evidence if bypassed | No launch effect after supported recovery | Preserve traces in task workpad; no legacy/native fallback was used | [limitations](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538) |

No real-machine checkpoint is requested in round one because the candidate has open P1 findings and lacks the Worker 24 exact-candidate lane. The next checkpoint must be issued only after a repaired candidate clears focused and registered CI evidence.

## Domain conclusion

`DOMAIN CONDITIONAL`

The immutable candidate was actually inspected, its product implementation was recoverable, and the missing synthetic audit coordinates did not block a defensible review. The domain is not clear for launch:

- `23A-R01-001` and `23A-R01-002` prove that completed Worker 07 and Worker 24 behavior was lost during stream integration.
- `23A-R01-003` identifies a concrete crash boundary where links, reported state, and the running service can disagree.
- `23A-R01-004` identifies an explicit bounded-diagnostics acceptance failure.

Worker 23 should serialize the four proposed rows, assign narrow repair tasks, and preserve 23A as the authoritative disposition owner. The same Worker 23A reviewer must inspect the next immutable candidate, rerun affected evidence, and update the original GitHub threads with repair PR, exact candidate SHA, validation, and `fixed`, `stale`, `needs_verification`, or `waived_by_ko`. Worker 23h should not issue a final go decision until all three P1 findings are closed and the P2 is fixed or explicitly waived by Ko.
