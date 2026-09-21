# Fix LeadConnector stage queue provider search

branch: `task/dialer/fix-leadconnector-stage-queue-provider-search`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1780/fix-leadconnector-stage-queue-provider-search
github pr: https://github.com/consuelohq/opensaas/pull/1780
started: 2026-08-04

## acceptance criteria

- [x] Opportunity searches translate internal pipeline/stage/status fields into the provider's supported `filters` array.
- [x] Unfiltered CRM searches keep working and queue-stage previews return callable candidates instead of 502.
- [x] Pagination, embedded-contact reuse, and missing-contact hydration remain intact.
- [x] LeadConnector and dialer-server tests/typechecks/builds, strict review, and publish verification pass.
- [ ] Production queue preview for New Lead returns 200 and no call-session request is created.
- [x] No carrier call, recording, transcription request, or GHL record mutation occurs.

## plan

1. Add a red provider-boundary contract matching GHL's live opportunity search filter payload.
2. Change only the LeadConnector opportunity-search adapter; preserve internal Hono/Effect contracts.
3. Run focused and full LeadConnector/dialer-server validation, review, and verify.
4. Merge, deploy only dialer-server, and prove New Lead queue preview in authenticated GHL without starting a call.

## current status

- Provider adapter fixed and full local validation is green. Strict review has zero findings. Pending publish verification, merge, Railway deployment, and authenticated New Lead preview proof.

## files changed

- `packages/lead-connector/src/application/resources.ts`
- `packages/lead-connector/src/application.contract.test.ts`
- task workpad/metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 23:49:52 `review.run`: passed — OK
- 2026-08-04 23:49:53 `review.run`: passed — OK
- 2026-08-04 23:50:26 `verify`: passed — OK

## key decisions

- Preserve the internal `pipelineId`, `stageId`, and `status` API; translate only at the provider adapter boundary.
- Use the same `filters` structure observed in the authenticated GHL Opportunities request: `{ field, operator: "eq", value: [id] }`.

## Test-first contract

- Behavior: provider request body contains `filters` for `pipeline_id`, `pipeline_stage_id`, and `status`, while omitting unsupported top-level filter fields.
- Existing pattern: `application.contract.test.ts` captures provider requests through the Effect test transport.
- Focused red command: `bun test packages/lead-connector/src/application.contract.test.ts`.
- Expected red: current body contains top-level `pipelineId`, `pipelineStageId`, and `status` and has no `filters` array.

## validation summary

- Production red proof: unfiltered opportunity search 200; top-level `pipelineId` search 502 `LEADCONNECTOR_PROVIDER_ERROR`.
- Focused red contract failed on top-level provider fields, then passed after translation.
- LeadConnector: 89/89 tests, 763 assertions.
- Dialer-server: 69/69 tests, 357 assertions.
- LeadConnector and dialer-server typechecks passed.
- LeadConnector embed and dialer-server builds passed.
- Strict review: zero findings.
- No call-session request or carrier activity occurred.

## notes for ko

- The live failure was not the Worker or iframe. Railway returned `LEADCONNECTOR_PROVIDER_ERROR` only when the browser supplied a pipeline/stage.
- The provider rejects top-level `pipelineId`/`pipelineStageId`; GHL's own authenticated UI uses `filters` with `pipeline_id`, `pipeline_stage_id`, and `status`.
- Internal Hono/Effect contracts remain unchanged. Only the provider adapter translates the fields.

## improvements noticed

- Provider errors currently redact the upstream status/body completely. A future observability task should log the provider status and operation through structured redacted telemetry without exposing tokens or customer payloads.

## issues and recovery

- The initial discovery batch lost task worktree context for one read; reran it directly with the task session.
- Production diagnosis used a fresh embed authorization only in memory and emitted no credentials.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet
