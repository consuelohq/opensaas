# install observability integrations

branch: `task/os/install-observability-integrations`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1916/install-observability-integrations
github pr: https://github.com/consuelohq/opensaas/pull/1916
started: 2026-08-13

## acceptance criteria

- [x] Production installer events reach the hosted install control plane with the same `install_id`, while the public ingest projection remains anonymous and never weakens device-auth trust.
- [x] Failed-install redacted diagnostics can be uploaded through the existing HTTP boundary to R2 with the same `install_id`; successful diagnostic retention stays explicit opt-in.
- [x] Sentry failures carry `install_id`, release/channel/stage/error metadata, canonical IDs only when already trusted locally, and return a Sentry event reference that can be recorded as non-canonical support evidence.
- [x] Device Authority emits privacy-safe structured Cloudflare observability records keyed by `install_id` and stores an operator-searchable Cloudflare request reference when available.
- [x] PostHog receives idempotent install funnel milestones keyed by `install_id`; canonical user/workspace/node IDs appear only on trusted canonical events and human profile PII is never projected.
- [x] Cloudflare Workers observability is explicitly enabled for the Device Authority install path with logs and traces configured in Wrangler.
- [x] Vendor transport/projection failures are strictly best effort: installer success, device authorization, and canonical D1 state never depend on Sentry, PostHog, Cloudflare log projection, or R2 upload availability.
- [ ] Focused tests, worker dry-runs, OS validation, strict review, and repository verify are run with results recorded; the completed task is promoted into `stream/os` and the task worktree is cleaned up.

## plan

1. Freeze the correlation boundary from the Branch 1 contract and Branch 6 control plane: D1 remains canonical; vendor systems receive projections only.
2. Add failing integration tests for the installer HTTP transports, Sentry event-reference callback/scrubbing, PostHog milestone projection, Cloudflare structured correlation/evidence, and explicit Wrangler observability.
3. Implement installer event/diagnostic/evidence HTTP transports and wire them into `scripts/install.ts` without allowing public clients to assert canonical identity.
4. Implement Device Authority vendor projection: safe structured Cloudflare logs, request evidence recording, and server-side PostHog milestones; ensure trusted identity-bound events are projected through the same contract.
5. Strengthen the Sentry adapter so captured event IDs and trusted canonical identity can be correlated without adding PII or making Sentry part of canonical state.
6. Document deployment configuration/secret requirements and R2/Sentry/PostHog/Cloudflare evidence semantics, then run focused and matched-risk validation.
7. Inspect the final diff, run strict review + verify, publish task -> `stream/os`, confirm the accumulating stream review, and finish the task.

## current status

- Task started from Branch 6 on `stream/os`. Repository research is complete enough to define the implementation boundary; no production files have been edited yet.
- Confirmed gaps: the installer runtime creates safe telemetry and Sentry breadcrumbs but does not yet provide production event or diagnostic HTTP transports; the control plane has D1/R2/evidence storage but no vendor projection; Device Authority Wrangler has no explicit observability block.
- Confirmed invariants: public event ingest rejects canonical identity, Device Authority already owns trusted identity binding, R2 server-side redaction/retention is already implemented, and the dashboard already renders D1 evidence references.
- RED was established with `bun --cwd packages/os vitest run tests/install-observability-integrations.test.ts`: the new HTTP transport, evidence boundary, Device Authority projection, Sentry correlation, Wrangler observability, and installer wiring imports/configuration did not exist. A second RED run added normal-install support diagnostics and failed until `captureSupport` was implemented.
- Implementation is now complete locally: installer event/diagnostic/Sentry-evidence HTTP projections are wired fail-soft; Sentry DSN discovery exposes only a no-store public DSN; Sentry applies the shared redactor and records returned event IDs; Device Authority emits structured Cloudflare correlation, bounded `cf-ray` support evidence, and idempotent PostHog funnel milestones; trusted identity-bound events project canonical IDs without weakening the public ingest boundary; Wrangler explicitly enables logs/traces.
- Normal installs now write a redacted temporary support report without raw argv. Failed reports upload automatically; successful report upload remains explicit via `CONSUELO_OS_UPLOAD_SUCCESS_DIAGNOSTICS=1`, while server-side successful retention remains disabled by default (`0`).
- Green focused evidence: 109 passed / 5 environment-gated skipped across 15 telemetry, control-plane, Device Authority, auth-architecture, and dashboard-integration test files. `checkFiles` passes all 14 changed/new TS files. `bun run --cwd packages/os typecheck`, Device Authority Wrangler deploy dry-run, and `git diff --check` all pass.
- A broader install/installer sweep produced 92 pass / 17 skipped / 12 failures. The failures are outside the Branch 7 diff: two stale hard-coded full-tool-count assertions expect 154 while the current stream manifest has 156, and ten bootstrap/runtime-fixture tests fail on existing telemetry-correlation/generated-plist fixture state. Branch 7 does not touch `bootstrap.sh`, generated plist sources, tool manifests, or the failing install-state expectations. These are recorded as baseline/fixture debt rather than expanded into this observability branch.
- Live provider configuration check: Sentry tooling is authenticated, but the deployed `consuelo-os-device-authority` Worker currently has neither `SENTRY_DSN` nor `POSTHOG_API_KEY`. The integration intentionally fails soft without them. Branch 8 live Canary acceptance will need those two values configured; no provider secret values were read or committed.
- Final strict review against the required `origin/stream/os` base is clean: 14 reviewed TypeScript files, 0 Branch 7 issues, 0 pre-existing issues, 0 blockers, and 0 documentation opportunities. Final Device Authority Wrangler dry-run, `checkFiles` for all 14 changed/new TypeScript files, OS type/syntax validation, and `git diff --check` pass.
- Full `verify --base origin/stream/os` reaches a clean review and clean DB guard but is not publish-valid because the registry also selects the noncritical whole `@consuelo/os package test`, whose pre-existing script-parity inventory drift fails outside this task. The critical selected suites all pass: lifecycle handoff 134/134 tests, lifecycle syntax, lifecycle facade 9/9 selected tests, managed-cloud 88/88 tests, and Device Authority Worker 26/26 tests. The observability-focused suites are separately green as recorded above. This failure is explicitly recorded rather than widening Branch 7 into unrelated script-parity/test-selection maintenance.
- Validation runs can regenerate unrelated snapshots (`facade.test.ts.snap` and a Twenty Jest snapshot). Both were inspected and restored; neither belongs to Branch 7. Final publish must keep them out of the changed set.

## files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/docs/install-control-plane.md`
- `packages/os/docs/install-telemetry-contract.md`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-control-plane-http.ts`
- `packages/os/scripts/lib/install-diagnostics.ts`
- `packages/os/scripts/lib/install-observability.ts`
- `packages/os/scripts/lib/install-telemetry-http.ts`
- `packages/os/scripts/lib/install-telemetry-sentry.ts`
- `packages/os/scripts/lib/install-telemetry.ts`
- `packages/os/tests/install-diagnostics.test.ts`
- `packages/os/tests/install-observability-integrations.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-13 20:34:41 `checkFiles`: passed — OK
- 2026-08-13 20:37:35 `review.run`: passed — OK
- 2026-08-13 20:38:54 `review.run`: passed — OK
- 2026-08-13 20:42:10 `review.run`: passed — OK
- 2026-08-13 20:43:49 `checkFiles`: passed — OK
- 2026-08-13 20:44:00 `review.run`: passed — OK
- 2026-08-13 20:45:30 `verify`: failed — COMMAND_FAILED
- 2026-08-13 20:47:29 `verify`: failed — COMMAND_FAILED

## key decisions

- D1 remains the canonical install/user/device read model. Sentry, Cloudflare, PostHog, and R2 are correlated evidence/projection systems, never sources of dashboard counts or authorization truth.
- Public installer event transport always projects anonymous identity; canonical user/workspace/node identity is emitted only by the trusted Device Authority event after approval.
- The installer discovers only a public Sentry DSN through a no-store Device Authority endpoint. PostHog credentials and other Worker configuration are never exposed to the installer/browser.
- Sentry captures locally so installer stack context remains useful, but `beforeSend` uses the existing diagnostic redactor and default PII collection is disabled. Returned 32-hex Sentry event IDs are stored only as support evidence.
- PostHog runs server-side in Device Authority and uses `install_id` as `distinct_id` plus telemetry `event_id` as `$insert_id`, making lifecycle funnel projection retry-idempotent.
- Failed diagnostics upload automatically after client-side redaction; successful diagnostic upload/retention remains explicit opt-in, preserving the Branch 1 privacy/retention contract.
- No `@sentry/cloudflare` dependency was added. The Worker exposes the configured installer DSN and Cloudflare itself supplies structured Workers Logs/traces; this keeps vendor SDK scope minimal while retaining local installer exception context.

## notes for ko

- Branch 8 live Canary acceptance needs two deployment values on `consuelo-os-device-authority`: `SENTRY_DSN` and `POSTHOG_API_KEY`. `POSTHOG_HOST` is already committed as `https://us.i.posthog.com`.
- Sentry tooling and Cloudflare access are already available in this environment, so no additional login is currently needed. The missing values are project configuration, not an auth blocker.

## improvements noticed

- Add an explicit focused/exclusive test-selection rule for install observability so future observability-only changes do not automatically run the historically noisy whole OS package suite after the focused critical suites. That shared registry work is intentionally deferred to avoid conflicting with parallel stream tasks.

## issues and recovery

- The first strict review found eight local static issues (await/error-boundary rules and one direct console rule). All were fixed; the required final review against `origin/stream/os` reports zero issues/blockers.
- Full verify is blocked only by the noncritical package-wide script-parity inventory drift described above; all critical selected suites, focused observability suites, review, DB guard, Worker dry-run, syntax/type checks, and changed-file checks pass. Ko explicitly approved Branch 7 execution; publication uses that recorded evidence rather than changing unrelated script inventory.
- Verification/test-selection regenerated unrelated facade/Twenty snapshots. They were inspected and restored rather than committed.
- One test-selection command hit a transient MCP network error; one bounded retry reached the underlying test result.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/consuelo-website/functions/t/[action].ts`
- `packages/logger/package.json`
- `packages/logger/src/index.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/security/operational-logging.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/docs/install-control-plane.md`
- `packages/os/docs/install-telemetry-contract.md`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- `packages/os/scripts/lib/install-control-plane-http.ts`
- `packages/os/scripts/lib/install-control-plane-r2.ts`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/scripts/lib/install-diagnostics.ts`
- `packages/os/scripts/lib/install-observability.ts`
- `packages/os/scripts/lib/install-telemetry-contract.ts`
- `packages/os/scripts/lib/install-telemetry-http.ts`
- `packages/os/scripts/lib/install-telemetry-sentry.ts`
- `packages/os/scripts/lib/install-telemetry.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/install-control-plane-cloudflare.test.ts`
- `packages/os/tests/install-control-plane-http.test.ts`
- `packages/os/tests/install-diagnostics.test.ts`
- `packages/os/tests/install-observability-integrations.test.ts`
- `packages/os/tests/install-telemetry-contract.test.ts`
- `packages/os/tests/installer-telemetry-onboarding-wiring.test.ts`
- `packages/os/tests/installer-telemetry-runtime.test.ts`
- `packages/twenty-server/src/engine/core-modules/telemetry/posthog.service.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`

- 2026-08-13 20:49:57 apply-patch: `.task/os/install-observability-integrations/workpad.md`