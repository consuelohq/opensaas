# Implement queue-first LeadConnector dialer experience

branch: `task/dialer/implement-queue-first-leadconnector-dialer-experience`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1777/implement-queue-first-leadconnector-dialer-experience
github pr: https://github.com/consuelohq/opensaas/pull/1777
started: 2026-08-04

## acceptance criteria

- [x] `/overlay` and the custom-menu calling surface open on a queue-first “Who do you want to call?” setup, not the current People/Deals picker.
- [x] GHL pipeline stages are presented as callable lists/queues; individual opportunity names are not used as list names.
- [x] Operators can switch between Choose list and Single dial, select predictive or single-line queue behavior, choose one/two/three lines, and retain local-presence preference.
- [x] Queue candidate-pool size is independent from requested fanout; the existing backend remains authoritative for ranking and call selection.
- [x] CRM resources refresh without a top-level GHL reload and concurrent refreshes are coalesced; active call snapshots are not mutated underneath an in-progress call.
- [x] Call completion/disposition uses a soft return-home transition that preserves authentication, resources, and operator preferences.
- [x] Active calls and call history remain first-class on the admin surface, while diagnostics are secondary.
- [x] Existing direct click-to-call behavior opens Single dial prefilled.
- [ ] LeadConnector tests, relevant dialer-server/domain tests, typechecks, builds, strict review, publish verification, and authenticated sandbox UI proof pass.
- [x] No carrier call, recording, transcription request, or customer-data mutation occurs during this task.

## plan

1. Map the mature Twenty preparation flow and current LeadConnector state/controller/backend contracts.
2. Add red contracts for queue-first rendering, stage-as-queue mapping, fanout independence, background refresh, and soft return home.
3. Implement the smallest shared queue-first setup model and view for both `/admin` and `/overlay`.
4. Add the thin LeadConnector queue-candidate adapter required to hydrate a selected stage while reusing existing predictive/local-presence services.
5. Wire focus/visibility/idle refresh with request coalescing and active-session protection.
6. Run focused and broad validation, review the exact diff, merge to `stream/dialer`, deploy affected Worker/Marketplace/Railway layers, and verify both GHL surfaces without dialing.

## current status

- Implementation and local validation complete. Strict review is clean. Pending full verify, merge, deployment of Worker/Marketplace/Railway, and authenticated GHL browser proof.

## files changed

- `packages/lead-connector`: queue candidate contracts/resolver, authenticated preview API client, queue-first state/controller/view, background refresh, responsive overlay/admin styles, and behavior tests.
- `packages/dialer-server`: Hono queue-preview route, Effect application contract, workspace-scoped runtime wiring, local-presence caller-ID reuse, and integration/contract tests.
- `packages/dialer`: one-line queue support, local-presence intent propagation, runtime target-aware caller-ID contract, and application tests.
- Task workpad and task metadata only outside product packages.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 22:56:06 `review.run`: passed — OK
- 2026-08-04 22:56:07 `review.run`: passed — OK
- 2026-08-04 22:56:42 `review.run`: passed — OK
- 2026-08-04 22:57:29 `verify`: passed — OK

## key decisions

- Preserve the existing domain ranking, caller-ID locks, browser-agent conference bridge, call history, and transcription implementation.
- Treat a pipeline stage as the user-visible queue. The browser supplies candidates; the backend ranks and selects only the requested fanout.
- Use a soft home transition for ordinary completion. Full reset remains reserved for invalid/expired installation state.
- Keep active calls/history prominent on admin; reuse the same setup form in a wider layout rather than maintaining a separate calling product.

## Test-first contract

- Behavior under test: queue-first setup rendering, stage queue projection, independent requested fanout, resource refresh coalescing/active-call stability, and soft completion reset.
- Existing patterns: `view.test.ts`, `state-machine.test.ts`, `controller.test.ts`, and existing Hono/Effect adapter tests.
- New/changed tests: visible setup contract; stage selection and candidate hydration; predictive three-line request sends full pool with `requestedFanout: 3`; direct click opens Single dial; soft return home preserves token/resources/preferences; repeated refresh coalesces and does not overwrite active snapshot.
- Focused red command: `bun test packages/lead-connector/src/embed/view.test.ts packages/lead-connector/src/embed/state-machine.test.ts packages/lead-connector/src/embed/controller.test.ts`.
- Expected red failure: current view still renders “Choose someone to call”; state has no setup/preferences/soft-home event; controller derives fanout from selected target count and lacks queue-stage/background-refresh behavior.

## validation summary

- Red contracts failed for missing queue-first UI/state/controller/API behavior before implementation.
- LeadConnector: 87 tests passed before the final no-winner contract; final focused view suite: 13/13 passed.
- Dialer-server: 69/69 passed.
- Shared dialer: 172/172 passed.
- All three package typechecks passed.
- LeadConnector embed and dialer-server production builds passed.
- Strict review against `origin/stream/dialer`: zero findings.
- No external provider call, recording, transcription request, or GHL record mutation occurred.

## notes for ko

- The screenshot was genuinely the old product shape, not a cache artifact. The queue-first home now exists in source and is protected by visible-copy tests.
- Pipeline stages are the callable list names. The queue adapter paginates provider results, reuses embedded contacts, and hydrates missing phone records only.
- The browser sends the full candidate pool; existing server-side predictive ranking chooses only the requested one/two/three lines.
- “Call from” currently defaults to automatic caller ID. The existing local-presence resolver is reused; this task does not expose a new tenant-safe outbound-number inventory endpoint.
- Queue batches return to the preserved setup after disposition or no-human completion. No automatic endless queue loop was introduced; the selected stage remains ready for the next batch.

## improvements noticed

- A future tenant-safe workspace-number listing contract can populate the optional caller-ID selector; automatic/local-presence behavior is already functional without it.
- A future queue orchestration task can add automatic next-batch progression after disposition. This change intentionally preserves the existing backend session boundary and makes the next batch a deliberate operator action.

## issues and recovery

- The workspace `batch` wrapper twice lost the task worktree context for read-only probes; reran those probes directly with the task session.
- One index-based controller rewrite produced malformed source before tests; restored the single file from `origin/stream/dialer` and reapplied changes through exact named-block replacements.
- Strict review caught one unnormalized caller-ID comparison; normalized the provider result and reran typecheck/review successfully.
- A no-winner UI test initially referenced an undefined fixture; corrected the fixture before any production deployment.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
