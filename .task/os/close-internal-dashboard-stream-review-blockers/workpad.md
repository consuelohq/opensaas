# close internal dashboard stream review blockers

branch: `task/os/close-internal-dashboard-stream-review-blockers`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2399/close-internal-dashboard-stream-review-blockers
github pr: https://github.com/consuelohq/opensaas/pull/2399
started: 2026-09-05

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

- 2026-09-05 03:48:05 fs.write: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`
- 2026-09-05 03:50:14 fs.write: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`
- 2026-09-05 03:52:31 fs.write: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`
- 2026-09-05 03:53:58 fs.write: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 03:52:07 `checkFiles`: passed — OK
- 2026-09-05 03:52:57 `review.run`: passed — OK
- 2026-09-05 03:53:33 `review.run`: passed — OK
- 2026-09-05 03:53:52 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [ ] Access-disabled `internal.consuelohq.com` still requires an explicit operator authorization boundary before serving global users/install/device/error data; an ordinary authenticated workspace customer must be denied.
- [ ] An anonymous request to an internal dashboard route such as `/users` preserves `internal.consuelohq.com` through the Google login flow and returns to the internal host instead of a customer workspace host.
- [ ] Existing Cloudflare Access-configured internal dashboard authorization behavior remains intact.
- [ ] Install-control-plane documentation accurately distinguishes the internal root behavior when Access is configured versus when it is not.
- [ ] Focused tests are red before implementation, green after implementation, strict review and full verify pass, then the task is promoted to `stream/os`.

## Plan

1. Inspect the current internal-host route/auth/login path and the nearest integration tests on the exact stream head.
2. Identify and reuse the existing operator authorization primitive; do not invent a second identity system.
3. Add focused regressions first for unauthorized customer sessions and internal-host-preserving anonymous login, then run them RED.
4. Implement the smallest Workspace Edge changes, update the route documentation, and rerun the focused tests GREEN.
5. Run adjacent Workspace Edge/internal dashboard coverage, strict review, full verify, then publish into `stream/os` and re-check PR #2387 review/CI before release.

## Test-first contract

behavior under test: when Cloudflare Access is disabled, the dedicated internal dashboard remains operator-only even for otherwise valid workspace sessions, and an anonymous request to an internal dashboard route carries the internal target host through central login so the post-login handoff returns to `internal.consuelohq.com`; configured-Access behavior remains unchanged.
existing local pattern: current Workspace Edge already has separate configured/unconfigured internal dashboard branches, central workspace-session login responses, signed workspace sessions, and integration coverage for internal dashboard routing/auth. The fix must reuse the repository's existing operator authorization source and existing auth handoff parameters.
new or changed tests: extend `packages/os/tests/internal-dashboard-integration.test.ts` (or the nearest existing owner if inspection shows another canonical test) with negative ordinary-customer authorization and anonymous internal-host login-return regressions; preserve configured-Access root expectations.
focused red command: select the narrow Vitest command after reading the exact current tests, then run the new cases before editing production code.
expected red failure: current Access-disabled internal-host authorization accepts any valid internal-host workspace session, and current anonymous login response preserves only the path rather than the internal target host.
no-test waiver: not applicable.

- 2026-09-05 03:48:05 append: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/tests/os-universal-login.test.ts`

## Focused test selection

- Device Authority ownership/security: `packages/os/tests/os-universal-login.test.ts` will prove that cross-host handoff to the private internal Site requires an active `internal.consuelohq.com` membership, uses that membership's workspace ID, and that revoking the membership invalidates the internal session on the next validation.
- Workspace Edge login continuity: `packages/os/tests/internal-dashboard-integration.test.ts` will prove anonymous internal dashboard redirects carry `target_host=internal.consuelohq.com` through central Google login for both Access-disabled and Access-configured internal dashboard routes.
- Google target selection: the universal-login suite will also prove an explicit internal `target_host` survives OAuth state/callback and selects the matching active membership directly instead of dropping the browser onto another workspace.
- Focused RED command: `bun --cwd packages/os x vitest run tests/os-universal-login.test.ts tests/internal-dashboard-integration.test.ts`.
- Expected RED: current cross-workspace handoff succeeds without internal membership; internal validation accepts the source workspace ID; and central login redirects omit `target_host`.

- 2026-09-05 03:50:14 append: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`

- 2026-09-05 03:50:32 apply-patch: `packages/os/tests/os-universal-login.test.ts`
- 2026-09-05 03:50:37 apply-patch: `packages/os/tests/internal-dashboard-integration.test.ts`

- 2026-09-05 03:51:14 apply-patch: `packages/os/cloudflare/os-device-authority/src/types.ts`
- 2026-09-05 03:51:14 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- 2026-09-05 03:51:14 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- 2026-09-05 03:51:20 apply-patch: `packages/os/cloudflare/workspace-edge/src/index.ts`
- 2026-09-05 03:51:27 apply-patch: `packages/os/docs/install-control-plane.md`
- 2026-09-05 03:51:37 apply-patch: `packages/os/tests/internal-dashboard-integration.test.ts`
- 2026-09-05 03:51:46 apply-patch: `packages/os/tests/internal-dashboard-integration.test.ts`

## Implementation and validation evidence

- RED focused run: 5 failures / 19 passes before production edits, exactly covering the missing internal membership gate, wrong internal workspace ID, dropped `target_host`, and anonymous internal login redirect. Trace `trc_2cbc914af7fe`.
- Implemented Device Authority membership authorization at both internal handoff and internal session validation. Cross-host internal handoff now resolves the account's active `internal.consuelohq.com` membership and mints the internal session with that membership's workspace ID; accounts without it receive 403. Revoking the membership makes an existing internal session fail validation immediately.
- Added an optional private `targetHost` to web OAuth state. Only `internal.consuelohq.com` is accepted. Google callback preserves it into `/auth/workspaces`, which directly selects the matching active membership and refuses arbitrary or unauthorized targets.
- Workspace Edge now appends `target_host=internal.consuelohq.com` to anonymous internal dashboard Google-login redirects. Access-disabled dashboard authorization no longer uses an unconditional `async () => true`; it re-validates the internal workspace session through Device Authority, while Access-configured mode keeps the existing JWT/email gate.
- Workspace Edge maps explicit Device Authority 403 membership denials to a dashboard 403 instead of a generic auth-unavailable response.
- Documentation now states the actual root behavior: `/` remains Home when Access is disabled, but is intercepted by the private dashboard when the complete Access gate is configured.
- Focused GREEN: `os-universal-login` + `internal-dashboard-integration` pass 24/24; trace `trc_b55ed314f513`.
- Adjacent auth/edge suite passes 86/86 across universal login, internal dashboard integration, install-control-plane Cloudflare, Device Authority Worker, and Device Authority architecture; trace `trc_b807a3d76e29`.
- `checkFiles` passes all six changed TypeScript/test files; trace `trc_248c3357c1bf`.

## Key decisions

- Internal dashboard authorization is modeled as canonical active membership in the dedicated `internal.consuelohq.com` workspace. This reuses the existing account/workspace membership authority instead of introducing a second admin identity store.
- The target-host login parameter is intentionally allow-listed to the single private internal host. It is not a generic browser-controlled cross-workspace redirect primitive.
- Session validation checks active internal membership on every internal-host validation, so sessions minted before this repair cannot retain access after membership is absent or revoked.

- 2026-09-05 03:52:31 append: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`

- 2026-09-05 03:53:04 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`

## Final pre-publish validation

- Review initially found one local async error-handling blocker in the new membership helper; fixed with an explicit fail-closed try/catch and reran the focused suite 24/24 green (`trc_21c76757c179`).
- Final strict review: 0 issues / 0 blockers (`trc_b19772eb20e4`).
- Full verify against `origin/stream/os`: passed, `publishValid: true`, DB guard clean (`trc_3dd076b30b44`).

## Files changed

- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/docs/install-control-plane.md`
- `packages/os/tests/internal-dashboard-integration.test.ts`
- `packages/os/tests/os-universal-login.test.ts`

## Current status

- Implementation, focused behavior proof, adjacent auth/edge proof, strict review, and full verify are complete. Ready to promote into `stream/os`, then re-check stream review PR #2387 and continue the already approved canary release/live validation.

- 2026-09-05 03:53:58 append: `.task/os/close-internal-dashboard-stream-review-blockers/workpad.md`
