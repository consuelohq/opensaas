# DEV-1619 ignore unrelated parent telemetry messages

branch: `task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2699
started: 2026-10-30

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior: Filter messages to this Dialer's recognized protocol types before validating its version. HighLevel's other trusted-parent integrations share the postMessage channel and must not tear down an authenticated session. Preserve exact origin/source checks, signed encrypted bootstrap handling, known-version rejection, handshake payload validation and active-origin fencing.
Evidence: Real native first-opening trace (trc_0e1839a9f4a7) shows REQUEST_USER_DATA_RESPONSE at434.5ms, HTTP201 and protected resource200, UI ready at580.3ms, then unrelated trusted-parent type=rrweb (no Dialer version; snapshot contents not retained) at701.6ms and UI reconnect at702.4ms. A second rrweb arrives at744ms. Private sanitized proof ghl-native-first-open-protocol-trace.json. Parent source and origin verified. This is an observed parser defect, not a carrier/token failure.
Ownership: protocol.ts and protocol.test.ts only, plus scoped task metadata. Preserve concurrent stream work. No subagents, backend migration, billing, provider calls, purchases, identity rotation or OS auth changes.
Existing pattern: createHost dispatch fixture and ParentBridge unit tests. Add noise-before-bootstrap and noise-after-valid-bootstrap tests (rrweb and an unrelated versioned type), plus recognized-type missing/wrong-version coverage. Focused red command: bun test packages/lead-connector/src/embed/protocol.test.ts. Expected red: unrelated parent messages invoke PROTOCOL_VERSION_MISMATCH, which internal-main maps to failBootstrap. No-test waiver: none.
Plan: record red; minimally discriminate owned message types; green, complete LeadConnector tests/typecheck/build, strict review/full verify; task.push then immediately task.pr; inspect exact main promotion; deploy only changed edge assets preserving Worker routes/secrets/backend; repeat real initial-launch, queues and readiness/cleanup. The earlier OAuth and migration release is already live and fresh Company/Location authorization is confirmed; no spent code is replayed.

- 2026-10-30 02:02:17 append: `.task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 02:02:17 fs.write: `.task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages/workpad.md`
- 2026-10-30 02:02:34 append: `.task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages/workpad.md`
- 2026-10-30 02:02:34 fs.write: `.task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages/workpad.md`
- 2026-10-30 02:03:58 fs.write: `.task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages/workpad.md`

## workspace-owned: validation evidence

- 2026-10-30 02:03:10 `review.run`: passed — OK
- 2026-10-30 02:03:41 `verify`: passed — OK

## Green and review evidence

Focused9/9 pass,19 assertions; complete LeadConnector173/173 pass,1368 assertions. Build/typecheck pass after correcting the test mock's argument type (no production workaround). Strict review0 findings (trc_7d0427d2700b). Full verify passed in full mode, publishValid=true (trc_43ba90d19366). Diff limited to protocol.ts and protocol.test.ts plus task metadata. Wrangler authentication verified against the expected account; config keep_vars=true and routes only calls.consuelohq.com. Existing backend82c3ddae-bdc9-4cb9-997f-a4f6668d5adb remains unchanged for this browser fix. Edge deployment and fresh first-opening/queue/readiness evidence remain pending.

- 2026-10-30 02:03:58 append: `.task/dialer/dev-1619-ignore-unrelated-parent-telemetry-messages/workpad.md`
