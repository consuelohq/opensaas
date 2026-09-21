# make stale lifecycle bootstrap platform neutral

branch: `task/os/make-stale-lifecycle-bootstrap-platform-neutral`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2409
started: 2026-09-08

## acceptance criteria

- [ ] Any active, non-revoked stale explicit node can invoke a fixed compatibility `lifecycle.update` without requiring modern managed-cloud provisioning state.
- [ ] The compatibility updater uses existing local trusted release keys when available and only falls back to validated GCP startup metadata when local trust is absent.
- [ ] Missing/unsafe trust fails closed before the historical lifecycle child runs.
- [ ] Caller input remains limited to a validated release channel; exact-version and injection-shaped/unknown fields fail before upstream contact.
- [ ] Compatible modern nodes remain on typed `lifecycle.update`; ordinary stale tools remain blocked; revoked nodes remain non-recoverable; routing-only `nodeId` is stripped before upstream execution.
- [ ] Focused and affected Device Authority tests, Worker dry-run, strict review, and formal verify pass before publish.
- [ ] After merge/deploy, a direct top-level `nodeId: "cloud-1"` update no longer returns `UNKNOWN_TOOL_SCOPE`, durable heartbeat reports a modern compatible/ready runtime, and direct `session.start { kind: "task", dryRun: true }` succeeds.

## plan

1. Freeze the platform-neutral behavior in routing/bootstrap tests and prove the current managed-cloud classifier produces the expected RED.
2. Replace the GCP-only bootstrap with a fixed platform-neutral bootstrap: validate existing local trust first; recover release origin/keys from GCP metadata only when local trust is absent; invoke the historical updater with fixed argv.
3. Remove Device Authority's managed-cloud provisioning classifier from stale lifecycle routing while preserving revocation, readiness, compatibility, scope, and routing metadata gates.
4. Run focused GREEN, mocked trust/bootstrap execution cases, the full affected Device Authority/session boundary, and a fresh Worker dry-run.
5. Self-review the diff, run strict review and formal verify, publish task -> stream/os, and require fresh stream CI/review before main merge.
6. Deploy Device Authority from the exact merged main SHA and prove recovery/readiness/session.start using only direct top-level `nodeId: "cloud-1"` calls.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## key decisions

- Recovery eligibility is based on the authenticated explicit stale-node lifecycle request, not on managed-cloud provisioning history. Revocation remains the hard identity boundary before rewrite.
- The compatibility command is fixed and shell-literal-safe. Caller input can select only `stable|beta|canary|dev`; exact versions and unknown fields are rejected before upstream contact.
- Use validated local `runtime/trusted-release-keys.json` first. A present but unsafe/invalid trust file fails closed; it does not silently fall back to infrastructure metadata.
- Only an absent trust file triggers the legacy managed-cloud GCP startup-metadata recovery path. That path keeps the existing strict `storage.googleapis.com` origin check and public-key validation, persists recovered trust with owner-only permissions, and enables GCP metadata authorization for the historical updater.
- Use the historical install convention `"$HOME/.bun/bin/bun"` instead of the GCP-specific `/home/consuelo/.bun/bin/bun`, so the fixed bridge works across supported historical macOS/Linux installs.

## notes for ko

- Implementation is complete locally. Final live acceptance remains deployment + direct `cloud-1` update/status/session smoke; no cloud secret/environment work has started.

## improvements noticed

- none yet

## errors i ran into

- Initial focused RED produced 5 failures / 4 passes as expected. Two failures were only the test harness using the future portable command prefix while production still emitted the old Linux-specific prefix; the architectural REDs were stale non-managed routing, exact-version validation bypass, and the hardcoded Bun path.

## validation

- Canonical destructive-literal source preflight: `tests/test-source-safety.test.ts` — 1/1 passed after final test edits.
- Focused lifecycle routing/bootstrap: `tests/workspace-node-registry-routing.test.ts -t lifecycle` — 9/9 passed.
- Affected Device Authority/auth/session boundary: 10 files / 154 tests passed, 0 failed.
- Device Authority Worker dry-run: passed; Wrangler bundle 623.32 KiB / 126.51 KiB gzip.
- Structured `git.diff` self-review: only the two intended product/test files plus workspace-owned task metadata/logs are changed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: stale explicit `lifecycle.update` uses one fixed, caller-nonprogrammable compatibility updater on any active non-revoked stale node. The updater first uses an existing safe local `runtime/trusted-release-keys.json` and historical lifecycle defaults/env when available; only when local trust is absent does it attempt the validated GCP startup-metadata trust recovery required by old managed-cloud nodes. Compatible modern nodes remain on typed `lifecycle.update`; exact-version remains unsupported on the legacy path; missing local trust plus unavailable/invalid GCP metadata fails closed before spawning lifecycle.
existing local pattern: current main has a fixed GCP-only `mac.call` legacy bootstrap plus a managed-cloud provisioning classifier. Historical hosted installs persist trusted release keys locally; historical managed-cloud installs can recover their missing trust roots from infrastructure-owned GCP startup metadata. The manually provisioned `cloud-1` predates current provisioning-job state, so the classifier prevents the deployed bridge from running even though the node is genuinely managed cloud.
new or changed tests: replace stale non-managed typed-preservation expectation with a local-trust compatibility-bootstrap case that proves no GCP metadata is required; retain managed-cloud missing-trust metadata recovery, invalid metadata fail-closed, revoked denial, compatible no-rewrite, input-injection rejection, and routing-only nodeId stripping. Add mocked execution for local-trust success/failure-before-child behavior.
focused red command: `bun run --cwd packages/os test -- tests/workspace-node-registry-routing.test.ts -t lifecycle` after canonical destructive-literal source-safety preflight.
expected red failure: stale non-managed lifecycle.update remains typed because production still gates legacy rewrite on managed-cloud provisioning state; the new local-trust bootstrap expectation therefore fails before implementation.
no-test waiver: not applicable.

RED evidence (2026-09-08): canonical test-source-safety preflight passed. Focused lifecycle run produced 5 failures / 4 passes. Expected architectural failures: stale node without managed-cloud provisioning still forwarded typed `lifecycle.update`; exact-version request without provisioning state returned 200 instead of the legacy-path 400; generated command still used `/home/consuelo/.bun/bin/bun` instead of the portable `$HOME/.bun/bin/bun`. Two existing mocked metadata cases failed only because their command extractor was pre-updated to the portable prefix while production still emitted the old prefix.

- 2026-09-08 04:10:49 append: `.task/os/make-stale-lifecycle-bootstrap-platform-neutral/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 04:10:49 fs.write: `.task/os/make-stale-lifecycle-bootstrap-platform-neutral/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/mac.js`
- `packages/os/tests/test-source-safety.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tools/mac/handler.ts`
- `packages/os/tools/mac/schema.ts`

- 2026-09-08 14:27:57 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-09-08 14:28:05 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-09-08 14:28:10 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-09-08 14:29:35 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 14:31:44 apply-patch: `.task/os/make-stale-lifecycle-bootstrap-platform-neutral/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 14:32:15 `review.run`: passed — OK
- 2026-09-08 14:33:07 `verify`: passed — OK
