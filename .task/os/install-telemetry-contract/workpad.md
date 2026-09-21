# install telemetry contract

branch: `task/os/install-telemetry-contract`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1900/install-telemetry-contract
github pr: https://github.com/consuelohq/opensaas/pull/1900
started: 2026-08-13

## acceptance criteria
- [x] Define one stable `install_id` contract that can correlate installer, Device Authority, Sentry, Cloudflare, PostHog, R2 diagnostics, and the internal dashboard without embedding PII or secrets.
- [x] Define a versioned telemetry event envelope with stable producers, lifecycle events, install stages, outcomes, and error codes, including device-auth and background-service failure modes.
- [x] Define canonical identity rules: Consuelo `UserEntity.id` is the only dashboard/user telemetry `userId`; `WorkspaceEntity.id` is canonical `workspaceId`; Device Authority `nodeId` is canonical node identity; direct `google:<sub>` authority IDs are never promoted to canonical `userId` without an explicit mapping.
- [x] Define an allow-listed telemetry metadata surface and a redaction contract that builds on existing installer diagnostic redaction while excluding credentials, auth material, raw bodies/argv/paths, and human PII from event payloads.
- [x] Define storage ownership and retention: Consuelo control-plane read model is canonical; Sentry/Cloudflare/PostHog are projections/operational evidence; R2 owns redacted diagnostic bundles with bounded retention.
- [x] Define read-only internal dashboard API/read-model types for overview, users, installs, devices, error groups, and install detail/timeline so parallel dashboard/control-plane branches can build against fixtures independently.
- [x] Document transport/correlation rules, including propagation of `install_id` across Device Authority requests and vendor projections.
- [x] Add focused contract tests that fail before the contract module exists and pass after implementation.
- [x] Keep this branch foundation-only: no live Sentry/PostHog/R2/Cloudflare wiring, no database migrations, no launcher/UI implementation.
- [ ] Merge the completed task branch into `stream/os` via normal task lifecycle; do not leave work only on the task branch.

## plan
1. Inspect current installer stages/diagnostics, Device Authority identity/storage, canonical app-user approval flow, PostHog identity, and private control-plane boundary.
2. Write a focused contract test for IDs, schema/stages/error codes, redaction/safe metadata, retention/storage ownership, and dashboard route/read-model invariants; run it RED before adding the module.
3. Implement `scripts/lib/install-telemetry-contract.ts` as a dependency-light shared TypeScript contract for the parallel branches.
4. Add `docs/install-telemetry-contract.md` describing semantics, storage/retention, identity, transport, privacy, and API/read-model ownership.
5. Run focused tests GREEN, package typecheck/syntax checks appropriate to changed files, diff/review, and verification against `origin/main`.
6. Push, promote/merge into `stream/os`, then finish the task session.

## test-first contract
- New focused test: `packages/os/tests/install-telemetry-contract.test.ts`.
- RED expectation: test imports the planned contract module before it exists, so the focused Vitest run must fail for missing module/exports.
- GREEN assertions:
  - generated install/event IDs use opaque prefixed UUIDs and validate strictly;
  - schema version, event names, producers, stages, outcomes, and error codes are stable and duplicate-free;
  - motivating failures (`DEVICE_AUTH_*`, `BACKGROUND_SERVICE_*`) are represented;
  - safe telemetry context contains only explicitly allowed scalar fields and forbidden/sensitive field names are enumerated;
  - canonical identity type does not expose Google subject/email/name fields;
  - storage owners and retention constants match the documented ownership model;
  - internal dashboard route constants and read-model types support overview/users/installs/devices/errors/install detail without requiring vendor APIs at render time.

## evidence
- `scripts/lib/install-diagnostics.ts`: current diagnostics are opt-in dev reports, use a strong recursive redactor, redact user paths/query auth codes/tokens, and currently swallow diagnostic write failures so diagnostics cannot break install.
- `scripts/install.ts`: current human progress stages are dependencies/workspace/security/skills/agents/service/health; device login falls back on unavailable/denied/expired/timeout/exception and records local diagnostic events; successful provisioning happens after prompts.
- `scripts/lib/workspace-device-login-client.ts`: device auth already has stable OAuth-ish errors (`DEVICE_CODE_DENIED`, `DEVICE_CODE_EXPIRED`) plus unavailable network/proof/result states.
- `twenty-server/.../auth.service.ts`: the primary app-mediated Google approval signs `approvedUser.id` into Device Authority, establishing Consuelo `UserEntity.id` as the canonical account/user identifier for that path.
- `cloudflare/os-device-authority/src/routes/google-oauth.ts`: direct Device Authority Google flows still use `google:<sub>`, so the contract must prohibit treating those values as canonical dashboard `userId` until mapped.
- `cloudflare/os-device-authority/src/types.ts`: Device Authority already owns workspace/node identities, platform/architecture/channel/capabilities/last-seen state, memberships, and browser sessions.
- `twenty-front/.../PostHogInitEffect.tsx`: existing PostHog identity uses `currentUser.id` and current workspace ID, matching the canonical-user decision.
- `docs/workspace-control-plane-contract.md`: device/auth/activity data is private and must load only after authenticated workspace-bound browser session; secrets must never enter logs/traces/audit/browser snapshots.

## current status
- Contract implementation and architecture documentation are complete. Focused tests and strict review pass. Full `verify` is blocked by an unrelated pre-existing `tests/operator-login.test.ts` unhandled-rejection failure; the task does not modify `operator-login.ts` or its test. Proceeding to publish with this blocker explicitly recorded rather than expanding the foundation task into an unrelated test repair.

## files changed
- `.task/os/install-telemetry-contract/workpad.md`

## validation log
- RED: `bunx vitest run tests/install-telemetry-contract.test.ts` failed as expected because `scripts/lib/install-telemetry-contract.ts` did not yet exist.
- GREEN: `bunx vitest run tests/install-telemetry-contract.test.ts` — 5/5 passed.
- Regression + syntax: `bunx vitest run tests/install-telemetry-contract.test.ts tests/install-diagnostics.test.ts && bun run typecheck` — 8/8 passed; workspace script syntax checks passed.
- `review.run --base origin/main --strict` — passed with 0 blocking issues, 0 review issues, and typecheck/spec-compliance clean.
- Full `verify --base origin/main` — review and DB gates passed, but selected full `@consuelo/os` package test failed because unchanged `tests/operator-login.test.ts` produces 3 unhandled Promise rejections despite all 17 assertions passing.
- Isolated reproduction: `bunx vitest run tests/operator-login.test.ts` — 17/17 assertions pass, process exits 1 only for the same 3 unhandled rejections (`StateMismatch`, denied authorization, no-code authorization).
- Scope proof: diff against `origin/main` for `packages/os/scripts/lib/operator-login.ts` and `packages/os/tests/operator-login.test.ts` is empty (0 files changed).

## tool/recovery notes
- `decideNext` first call used array values for scalar mark fields and was rejected; retried with valid scalar input.
- A later batch used `query` instead of `pattern` for `fs.search`; corrected and reran successfully.
- `decideNext` without persisted explore state initially failed; reran a direct task-scoped `explore` before continuing.
- First workpad rewrite attempted without overwrite permission; retried with `force`.
- First `code.call` RED invocation used an outdated argument shape; corrected after `tools.search`. A second attempt used an outer timeout in milliseconds incorrectly; retried with the proper timeout.
- Full-package verification rewrote an unrelated facade snapshot while exercising the existing suite; restored that generated snapshot to `HEAD` immediately.

## workspace-owned sections
<!-- task hooks may append below this line; preserve their content on later edits -->

- 2026-08-13 16:27:46 write: `.task/os/install-telemetry-contract/workpad.md`

## files changed

- `packages/os/docs/install-telemetry-contract.md`
- `packages/os/scripts/lib/install-telemetry-contract.ts`
- `packages/os/tests/install-telemetry-contract.test.ts`

## workspace-owned: files changed

- `packages/os/docs/install-telemetry-contract.md`
- `packages/os/scripts/lib/install-telemetry-contract.ts`
- `packages/os/tests/install-telemetry-contract.test.ts`

## workspace-owned: activity log

- 2026-08-13 16:27:46 fs.write: `.task/os/install-telemetry-contract/workpad.md`
- 2026-08-13 16:28:56 write: `packages/os/tests/install-telemetry-contract.test.ts`
- 2026-08-13 16:28:56 fs.write: `packages/os/tests/install-telemetry-contract.test.ts`
- 2026-08-13 16:30:06 write: `packages/os/scripts/lib/install-telemetry-contract.ts`
- 2026-08-13 16:30:06 fs.write: `packages/os/scripts/lib/install-telemetry-contract.ts`
- 2026-08-13 16:31:12 apply-patch: `packages/os/tests/install-telemetry-contract.test.ts`
- 2026-08-13 16:32:31 write: `packages/os/docs/install-telemetry-contract.md`
- 2026-08-13 16:32:31 fs.write: `packages/os/docs/install-telemetry-contract.md`

## workspace-owned: validation evidence

- 2026-08-13 16:33:33 `review.run`: passed — OK
- 2026-08-13 16:34:50 `verify`: failed — COMMAND_FAILED

## workspace-owned: files read

- `packages/os/skills/task/SKILL.md`
- `packages/workspace/scripts/verify.js`

- 2026-08-13 16:37:31 apply-patch: `.task/os/install-telemetry-contract/workpad.md`