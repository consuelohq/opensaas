# resolve final stream sync conflicts

branch: `task/dialer-algorithm/resolve-final-stream-sync-conflicts`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2142/resolve-final-stream-sync-conflicts
github pr: https://github.com/consuelohq/opensaas/pull/2142
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/app.contract.test.ts`
- `packages/dialer-server/src/commercial-target-authorization.test.ts`
- `packages/dialer-server/src/commercial-target-authorization.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.test.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- `packages/dialer-server/src/routes/call-sessions.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/domain/learning-observation.spec.ts`
- `packages/dialer/src/domain/learning-observation.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`
- `packages/dialer/src/services/binomial-estimate.spec.ts`
- `packages/dialer/src/services/binomial-estimate.ts`
- `packages/dialer/src/services/cadence-optimizer.service.ts`
- `packages/dialer/src/services/cadence-optimizer.spec.ts`
- `packages/dialer/src/services/call-timing-model.service.ts`
- `packages/dialer/src/services/call-timing-model.spec.ts`
- `packages/dialer/src/services/contextual-response-model.spec.ts`
- `packages/dialer/src/services/contextual-response-model.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-evaluation.spec.ts`
- `packages/dialer/src/services/predictive-evaluation.ts`
- `packages/dialer/src/services/predictive-priority.contract.spec.ts`
- `packages/dialer/src/services/predictive-priority.service.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/predictive-selection-science.spec.ts`
- `packages/dialer/src/services/retry-decision-model.contract.spec.ts`
- `packages/dialer/src/services/retry-decision-model.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`
- `packages/dialer/src/services/whittle-index.service.ts`
- `packages/dialer/src/types.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/lib/trace-database-schema.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/streams/dialer-algorithm/AGENTS.md`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/code-call-process-regressions.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/media/31-svg-convert.test.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/subagent-runner-termination.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/streams/dialer-algorithm/AGENTS.md`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`
- `packages/workspace/tests/test-selection.test.js`


## workspace-owned: files changed

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/app.contract.test.ts`
- `packages/dialer-server/src/commercial-target-authorization.test.ts`
- `packages/dialer-server/src/commercial-target-authorization.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.test.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- `packages/dialer-server/src/routes/call-sessions.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/domain/learning-observation.spec.ts`
- `packages/dialer/src/domain/learning-observation.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`
- `packages/dialer/src/services/binomial-estimate.spec.ts`
- `packages/dialer/src/services/binomial-estimate.ts`
- `packages/dialer/src/services/cadence-optimizer.service.ts`
- `packages/dialer/src/services/cadence-optimizer.spec.ts`
- `packages/dialer/src/services/call-timing-model.service.ts`
- `packages/dialer/src/services/call-timing-model.spec.ts`
- `packages/dialer/src/services/contextual-response-model.spec.ts`
- `packages/dialer/src/services/contextual-response-model.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-evaluation.spec.ts`
- `packages/dialer/src/services/predictive-evaluation.ts`
- `packages/dialer/src/services/predictive-priority.contract.spec.ts`
- `packages/dialer/src/services/predictive-priority.service.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/predictive-selection-science.spec.ts`
- `packages/dialer/src/services/retry-decision-model.contract.spec.ts`
- `packages/dialer/src/services/retry-decision-model.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`
- `packages/dialer/src/services/whittle-index.service.ts`
- `packages/dialer/src/types.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/lib/trace-database-schema.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/streams/dialer-algorithm/AGENTS.md`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/code-call-process-regressions.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/media/31-svg-convert.test.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/subagent-runner-termination.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/streams/dialer-algorithm/AGENTS.md`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-08-16 06:48:44 fs.write: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`
- 2026-08-16 06:50:56 fs.write: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`
- 2026-08-16 07:04:52 fs.write: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`
- 2026-08-16 07:05:53 fs.write: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:51:46 `review.run`: passed — OK
- 2026-08-16 06:54:32 `verify`: failed — COMMAND_FAILED
- 2026-08-16 07:00:37 `verify`: failed — COMMAND_FAILED

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: current `main` and `stream/dialer-algorithm` must form one merge candidate with no unresolved conflicts; the merged facade tests must use current-main linked task-worktree fixtures while preserving the stream's runnable-tool filtering, and the test-selection registry must be regenerated from the merged source tree.
existing local pattern: `stream.sync` performs a real main→stream merge and treats generated test-selection metadata as derived output. Current-main facade tests use `createLinkedTaskSession`, which matches the newer task-worktree model; stream-only `createManagedTaskWorktree` is obsolete after the newer main changes.
new or changed tests: no new behavior tests are needed; resolve the exact two merge conflicts and run the affected facade/code.call contracts plus test-selection registry parity on the combined tree.
focused red command: merge `stream/dialer-algorithm` into this task started from current `main` with `--no-commit`.
expected red failure: the same two conflicts reported by `stream.sync`: `packages/os/tests/facade/facade.test.ts` and `packages/workspace/test-selection.registry.json`.
no-test waiver: not applicable; the merge conflict itself is the RED condition and combined-tree tests are required GREEN evidence.

## Acceptance criteria

- [ ] Merge current `stream/dialer-algorithm` into the current-main task with only the two known conflicts.
- [ ] Resolve facade test conflicts in favor of the current-main linked-worktree fixture model while preserving non-conflicting stream test eligibility logic.
- [ ] Regenerate `packages/workspace/test-selection.registry.json` from the fully merged source tree rather than choosing ours/theirs.
- [ ] Affected facade/code.call tests and test-selection parity pass on the combined tree.
- [ ] Dialer/Trace registered stream checks remain green.
- [ ] Strict review and canonical verify are clean, then promote the combined task into `stream/dialer-algorithm` only.

- 2026-08-16 06:48:44 append: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`

## Merge resolution evidence

- RED reproduced exactly: merging `stream/dialer-algorithm` into current-main task conflicted only in `packages/os/tests/facade/facade.test.ts` and `packages/workspace/test-selection.registry.json`.
- Facade resolution: selected current-main blocks only inside the six conflict regions, retaining all non-conflicting stream edits. This preserves the newer linked Git worktree/session fixture model from main.
- Registry resolution: used current-main only as a temporary conflict seed, then regenerated `packages/workspace/test-selection.registry.json` from the fully merged source with `bun packages/workspace/scripts/test-selection.js generate --json`. Final combined inventory: 2,667 tests, 2,583 mapped, 84 unmapped, 73 rules.
- Conflict markers: none remain; index has no unmerged paths.

## Combined-tree GREEN evidence

- OS facade conflict contracts: 51 selected cases passed (including matching taskSession/branch code.call, edit mode, and synthetic dry-run matrix).
- Workspace registry discovery: 1/1 passed against the regenerated combined registry.
- Dialer SDK: 221/221 passed.
- dialer-server: 172/172 passed + 1 intentionally opt-in local service integration skip.
- LeadConnector: 122/122 passed.
- Durable subagent runtime contracts: 4 files, 53/53 passed using local fake providers only; no live Grok/subagent reviewer invocation.
- Trace gateway/persistence/search: 3 files, 30/30 passed.

### Acceptance progress

- [x] Merge current `stream/dialer-algorithm` into the current-main task with only the two known conflicts.
- [x] Resolve facade conflicts using current-main linked-worktree fixtures while preserving non-conflicting stream eligibility logic.
- [x] Regenerate the test-selection registry from the fully merged tree.
- [x] Affected facade/code.call tests and registry inventory pass.
- [x] Dialer/Trace registered runtime checks are green on the combined tree.
- [ ] Strict review and canonical verify clean.
- [ ] Promote combined task into `stream/dialer-algorithm` only.

- 2026-08-16 06:50:56 append: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`

## Final review and publish-gate note

- Strict review on the combined main+stream candidate: 199 files, 0 owned findings, 0 blockers, all selected review tests passed. One nonblocking CLI-doc opportunity comes from current-main lifecycle changes and is not introduced by the conflict resolution.
- Canonical verify was attempted repeatedly through the `verify` facade and once through the same underlying repository verify script using `code.call`; those long-running calls repeatedly ended in MCP/network transport failure before returning a stamp. Short workspace calls remain healthy.
- This is not being treated as a test pass. Ko explicitly approved finishing and promoting the work, so the documented `task.push --approved` path will be used with this transport limitation recorded. GitHub CI on the promoted stream remains the authoritative full verify gate before any merge to `main`.

### Final local evidence before approved push

- No unmerged paths or conflict markers remain.
- Combined registry regenerated from source: 2,667 tests / 2,583 mapped / 84 unmapped / 73 rules.
- Facade conflict contracts: 51 passed.
- Registry discovery: 1 passed.
- Dialer SDK: 221 passed.
- dialer-server: 172 passed + 1 opt-in integration skip.
- LeadConnector: 122 passed.
- Durable subagent contracts: 53 passed using local fake providers only.
- Trace gateway/persistence/search: 30 passed.
- Strict review: 0 issues / 0 blockers.

- 2026-08-16 07:04:52 append: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`

## GitHub secondary-rate-limit wait plan

Wait reason: GitHub rejected `task.push` while uploading the combined release-candidate blobs with a secondary API rate limit; no repository/code error occurred.
Duration: bounded polling every 30 seconds for up to 4 minutes.
Resume action: first run a read-only GitHub PR/ref check; when GitHub responds normally, retry the exact same approved `task.push` once.
Expected signal: GitHub read-only status returns normally without secondary-rate-limit error.
Fallback: if the four-minute budget expires or the retry is rate-limited again, stop mutation and report the external GitHub cooldown with the already-green local evidence preserved.

- 2026-08-16 07:05:53 append: `.task/dialer-algorithm/resolve-final-stream-sync-conflicts/workpad.md`
