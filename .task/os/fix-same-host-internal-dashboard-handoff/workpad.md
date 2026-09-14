# fix same-host internal dashboard handoff

branch: `task/os/fix-same-host-internal-dashboard-handoff`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2395
started: 2026-09-05

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: an authenticated request to `/auth/handoff/start?target_host=internal.consuelohq.com&return_to=/users` while already on `internal.consuelohq.com` must not invoke the cross-host Device Authority handoff. It should safely redirect to the local dashboard path, which is independently protected by the internal workspace-session validator.
existing local pattern: cross-host transitions use `startPrivateSiteHandoff`; the destination dashboard route itself validates the host-scoped workspace session. Workspace Chrome also has/has had client-side same-host avoidance, but the server route must remain safe for stale snapshots and copied URLs.
new or changed tests: add a Workspace Edge regression proving same-host handoff returns 302 `/users`, rejects unsafe return paths, and does not call the authority handoff stub; preserve the existing cross-host universal-login handoff test.
focused red command: `bun test tests/internal-dashboard-integration.test.ts -t "short-circuits same-host internal dashboard handoff"`
expected red failure: current code delegates to Device Authority and the test stub returns the reproduced 404 `Not found` response instead of a local 302.
no-test waiver: not applicable.

## Live reproduction
- Authenticated browser GET to the exact URL from Ko's screenshot returns HTTP 404 with plain `Not found`: `trc_ed1815fce697`, `trc_412439f7433c`, network evidence `trc_59167e48e00e`.
- Anonymous curl to the same route returns the expected Workspace Edge `401 workspace_session_required`, proving the route exists and the failure is specifically the authenticated handoff branch: `trc_6a67a4cd69e4`.
- Direct `/users` on the same authenticated browser session works, so the dashboard route and existing session are valid.

- 2026-09-05 02:38:13 append: `.task/os/fix-same-host-internal-dashboard-handoff/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 02:38:13 fs.write: `.task/os/fix-same-host-internal-dashboard-handoff/workpad.md`
- 2026-09-05 02:40:35 fs.write: `.task/os/fix-same-host-internal-dashboard-handoff/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/tests/internal-dashboard-integration.test.ts`

- 2026-09-05 02:39:11 apply-patch: `packages/os/cloudflare/workspace-edge/src/index.ts`
- 2026-09-05 02:39:11 apply-patch: `packages/os/tests/internal-dashboard-integration.test.ts`

## workspace-owned: validation evidence

- 2026-09-05 02:39:44 `review.run`: passed — OK
- 2026-09-05 02:40:01 `verify`: failed — COMMAND_FAILED
- 2026-09-05 02:40:07 apply-patch: `packages/os/cloudflare/workspace-edge/src/index.ts`
- 2026-09-05 02:40:15 `review.run`: passed — OK
- 2026-09-05 02:40:30 `verify`: passed — OK

## Implementation and verification
- Root cause confirmed: the menu URL is a cross-workspace handoff endpoint. On `internal.consuelohq.com` the source and target hosts are identical, but Workspace Edge still called Device Authority `/internal/auth/session/handoff`. The live authenticated branch returned the exact plaintext `404 Not found`, while `/users` itself and `/internal/auth/session/validate` are healthy.
- Fix: when source host equals the approved internal target host, Workspace Edge now validates the existing host-scoped browser session, sanitizes `return_to` using the canonical auth return-path normalizer, and redirects locally instead of minting a redundant cross-host handoff. Cross-host transitions still use the existing handoff mechanism.
- Security: anonymous/expired sessions still fail through the same workspace-session response; unsafe external `return_to` values normalize to `/`; arbitrary target hosts remain denied.
- Red regression: expected 302, reproduced existing 404 (`trc_868d92e5d136`).
- Green verification: focused regression passes; 24/24 integration/universal-login/chrome tests pass; syntax/typecheck and Workspace Edge Wrangler dry-run pass (`trc_e41deb6b25b6`).
- Strict review: 0 findings (`trc_d5e236b46998`).
- Full verify: passed and publish-valid (`trc_edc01e08b865`).

- 2026-09-05 02:40:35 append: `.task/os/fix-same-host-internal-dashboard-handoff/workpad.md`
