# rd8 finalize inbound runtime review and deployment readiness

branch: `task/dialer/rd8-finalize-inbound-runtime-review-and-deployment-readiness`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2488/rd8-finalize-inbound-runtime-review-and-deployment-readiness
github pr: https://github.com/consuelohq/opensaas/pull/2488
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-09-21 01:40:43 `verify`: passed — OK
- 2026-09-21 01:43:34 `review.run`: passed — OK
- 2026-09-21 01:44:00 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Additional release-gate scope

General workspace verification selects the server suite without building the newly required contacts runtime export. Reproduce with contacts/dist temporarily absent (restored immediately); then register the contacts build as an ordered prerequisite and select the server suite when contacts changes. This fixes cold-checkout validation without relaxing any test. The earlier verify used an outdated local stream ref and selected unrelated historical work; stop that owned run and verify against the exact task starting SHA 458089050f38efdf90873a6e361bed37f7534944 after the correction.

Cold dependency RED reproduced the exact 11 module-load errors from workspace CI. Prerequisite-order regressions failed for both server and contacts edits, then passed after registering the Nx contacts build. Cold selected server gate now passes with real-Postgres ports. The missing DIALER_EDGE_PROXY_SECRET was provisioned only in the dialer GitHub release environment; the release workflow will synchronize it to Railway and the Worker. Secret value was never logged.
