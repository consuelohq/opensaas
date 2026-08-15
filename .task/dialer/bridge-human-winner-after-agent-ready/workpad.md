# Bridge human winner after agent ready

branch: `task/dialer/bridge-human-winner-after-agent-ready`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1758/bridge-human-winner-after-agent-ready
github pr: https://github.com/consuelohq/opensaas/pull/1758
started: 2026-08-03

## acceptance criteria

- [x] A human-answered customer leg is not left on Twilio hold music while waiting for the agent/browser participant.
- [x] Winner selection connects only the human winner to the intended agent leg; losing customer legs terminate.
- [x] Customer-first and agent-first ordering are both race-safe.
- [x] Missing agent readiness does not produce a false failed group from premature unmute.
- [x] Terminal cleanup releases caller-ID locks and persists the answered outcome.
- [ ] Focused tests, package suites, build, review, verify, deploy, and no-carrier runtime checks pass before any new live call.

## plan

1. Trace the current stream customer TwiML, agent join contract, winner selection, participant mute/hold behavior, and cleanup.
2. Add a focused red lifecycle test reproducing a human customer answer before an active bridgeable conference/agent participant exists.
3. Implement the smallest readiness-aware bridge contract while preserving predictive fanout and winner/loser semantics.
4. Validate locally, review the diff, publish to stream/dialer, deploy the standalone server, and verify without another carrier call.

## current status

- Task started from current stream/dialer commit 88070303. Live evidence: customer heard Twilio hold music for 153 seconds; Twilio classified human, winner selection succeeded, but cleanup logged unmute-winner: Active conference not found and group became failed.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

## key decisions

- Preserve the conference architecture; the bug is participant readiness/ordering, not the use of conferences.
- Treat the agent/browser participant as a required bridge dependency. Do not expose a human winner to indefinite provider hold music.
- No further live carrier call until the patch is deployed and lower-level/no-carrier proof passes.

## test-first contract

- Behavior under test: customer answers human before the agent participant/conference is ready; the lifecycle must defer the bridge action instead of failing unmute or leaving indefinite hold music, then connect once readiness is reported.
- Existing local pattern: parallel-lifecycle.contract.spec.ts, callback transition tests, cleanup actions, and Twilio provider adapter fixtures.
- New or changed tests: customer-first readiness deferral, agent-ready completion, loser termination, exactly-once bridge action, and terminal cleanup.
- Focused red command: `bun test packages/dialer/src/services/parallel-lifecycle.contract.spec.ts packages/dialer-server/src/twilio-boundary.test.ts packages/dialer-server/src/app.contract.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/api-client.test.ts packages/lead-connector/src/embed/agent-voice.test.ts`.
- Expected red failure: current callback path immediately executes unmute-winner, which fails when no active conference exists.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial task PR #1757 was created from main and did not contain the recent standalone dialer runtime. Recovered by starting PR #1758 from stream/dialer; no production edit was made on #1757.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## implementation evidence

- Browser agent voice: authenticated token route, isolated Twilio Voice SDK adapter, microphone preflight, Device registration, outgoing agent leg scoped by SessionId, and teardown on media/readiness failure.
- Conference contract: customer legs use startConferenceOnEnter=false, endConferenceOnExit=false, waitUrl empty, muted until winner selection; the agent starts/moderates the conference; only the selected winner is promoted to endConferenceOnExit=true.
- Readiness reconciliation: browser agent acceptance triggers a bounded six-attempt cleanup retry before the session is exposed as connected.
- Terminal lifecycle: winner completion marks the group completed, clears stale unmute cleanup, terminates any remaining loser legs, releases caller-ID locks, and allows telemetry/learning to finish.
- Provider documentation checked: Twilio default waitUrl is hold music; an empty waitUrl disables it; startConferenceOnEnter=false creates a moderated participant; browser Call accept indicates media setup.

## validation evidence

- Dialer: 166 pass, 0 fail, 348 expectations.
- Dialer-server: 47 pass, 0 fail, 233 expectations.
- LeadConnector: 68 pass, 0 fail, 636 expectations.
- TypeScript: dialer, dialer-server, and LeadConnector all clean.
- Production builds: dialer tsc, dialer-server compiled Bun binary, and LeadConnector browser/embed bundle all clean.
- No carrier call was placed during implementation or validation.

## review evidence

- git diff --check: clean.
- Secret-like addition scan: clean.
- Browser bundle/server dependency guard: only guard-test literals matched.
- Strict repository review against stream/dialer: 0 blocking findings, 0 related pre-existing findings, 0 failed suites.
- Review found two missing browser adapter error boundaries; both were fixed and the strict review rerun clean.
