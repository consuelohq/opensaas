# test(os-web): define universal login auth contract

branch: `task/os-web/test-os-web-define-universal-login-auth-contract`
stream: `stream/os-web`
pr: https://github.com/consuelohq/opensaas/pull/1559
started: 2026-07-22
recovered after crash: 2026-07-22

## acceptance criteria

- [x] Inventory the current OS device-authority routes, backing stores, protocol boundaries, and workspace/node behavior.
- [x] Define the universal-login handoff/session schema, threat model, and Worker 14 ownership boundary without registering runtime routes.
- [x] Add deterministic executable contract tests for safe return paths, membership outcomes, host-only cookies, and audience-bound single-use handoffs.
- [x] Correct the executable route matrix so every listed preserved device endpoint matches production and every Worker 14 universal-login route in the design note is present.
- [x] Verify and disposition all existing review findings on PR #1559.
- [x] Rerun focused tests, security regressions, strict review, and full verify.
- [ ] Push the corrected task commit, record dispositions on GitHub, merge PR #1559 into `stream/os-web`, and finish the task without promoting the stream to main.

## plan

1. Preserve the existing pure contract seam and characterization scope.
2. Add failing exact-route assertions for the two existing review findings.
3. Make the smallest matrix correction: real device routes, no duplicate MCP token classification, and complete Worker 14 route entries.
4. Run focused and broader regressions, inspect the diff, then run review and verify.
5. Push, post finding dispositions, merge into stream, and finish.

## Test-first contract

- Behavior under test: `UNIVERSAL_AUTH_ROUTE_MATRIX` must be an accurate executable handoff to Worker 14, not an approximate sample.
- Existing local pattern: Vitest contract tests in `packages/os/tests/os-web-auth-contract.test.ts` and the authoritative route inventory in `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`.
- Changed tests: require `/login/device`, `/login/device/code`, `/login/device/workspace`, `/login/device/approve`, and `/login/oauth/access_token` as preserved device routes; reject `/oauth/device/code`; require exactly one `/oauth/token` as preserved MCP OAuth; require `/auth/workspaces` and `/auth/handoff` with their Worker 14 access contracts.
- Focused red command: `bun run --cwd packages/os test -- tests/os-web-auth-contract.test.ts`.
- Expected red failure: current matrix lacks the real device routes and two Worker 14 routes, while containing invented/duplicated device entries.
- No-test waiver: none.

## current status

- Original task session and PR #1559 recovered through exact-title `task.start` after the computer crash.
- User explicitly waived another Grok run. Both existing Grok/Codex findings were verified as valid and fixed directly.
- No runtime route registration or provider lifecycle change is in scope. The correction is ready to publish and merge.

## files changed

- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`
- `packages/os/tests/os-web-auth-contract.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/plans/consuelo-os-foundation/web-auth-contract.md`
- `packages/os/tests/os-web-auth-contract.test.ts`

## workspace-owned: activity log

- 2026-07-22 21:30:04 fs.write: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`
- 2026-07-22 21:30:29 fs.write: `packages/os/tests/os-web-auth-contract.test.ts`
- 2026-07-22 21:30:53 fs.write: `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- managed by workspace hooks

## workspace-owned: validation evidence

- managed by workspace hooks
- 2026-07-22 21:32:32 `review.run`: passed — OK
- 2026-07-22 21:32:39 `verify`: passed — OK
- 2026-07-22 21:33:47 `verify`: passed — OK

## key decisions

- Treat the matrix as an exact implementation boundary because Worker 14 is expected to consume it as executable contract data.
- Preserve MCP `/oauth/token` only as `preserved-mcp-oauth`; device polling remains `/login/oauth/access_token`.
- Include all five existing device-login routes in the preserved matrix rather than only the two installer transport endpoints.
- Add `/auth/workspaces` and `/auth/handoff` so the executable matrix matches the committed design note.
- Skip any further Grok invocation as directed by Ko; verify the already-returned findings locally and on GitHub.

## notes for ko

- No install, update, reset, restart, or uninstall command will be run on a real Mac.
- The duplicate recovery PR #1563 was closed and its task worktree/branch cleaned up; PR #1559 remains the sole durable task.

## improvements noticed

- Exact-title task recovery is required after a crash. Using a shortened title creates a new task slug and PR.

## issues and recovery

- Final typed `task.push` retry failed because the facade again injected unsupported `--task-session` (`trc_d67e2f64722b`). Recovery uses the same OS-owned `task-push.js` from the scoped worktree without the redundant CLI flag.

- The prior task session initially returned `TASK_SESSION_NOT_FOUND` (`trc_9ee3a460af8f`).
- A shortened-title recovery accidentally created duplicate PR #1563 (`trc_5dfa70cb06a4`). It was closed through the GitHub facade (`trc_8a6799fe2687`) and cleaned up through `task.cleanup` (`trc_b330b4cd5f94`, `trc_d3d0fe0cafdf`).
- Exact original title recovery restored PR #1559 and task session `tsk_fb2f87d41f93` (`trc_eeb45ff48096`).
- Existing review finding 1 is confirmed: invented `/oauth/device/code`, incorrect device classification of `/oauth/token`, and absent production device endpoints.
- Existing review finding 2 is confirmed: executable matrix omits design-contract routes `/auth/workspaces` and `/auth/handoff`.

---

## publish checklist

- [x] focused red then green
- [x] selected auth/device/MCP regressions pass
- [x] strict review passes
- [x] full verify is publish-valid
- [ ] task commit pushed
- [ ] existing findings and dispositions posted to PR #1559
- [ ] task PR merged into `stream/os-web`
- [ ] task finished; stream not promoted to main

- 2026-07-22 21:30:04 write: `.task/os-web/test-os-web-define-universal-login-auth-contract/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`

## final validation and finding dispositions

- Focused red: `trc_c5094730a7da` — 2 expected failures for the incorrect device endpoints and missing authority-session routes.
- Focused green: `trc_0ea7af3ff4e2` — 7/7 contract tests passed after the minimal matrix correction.
- Final focused rerun: `trc_7a6af88b005b` — 7/7 passed after removing an accidental escape-only test diff.
- Broader OS auth/device validation: `trc_76198a83a0be` — syntax checks passed and 43/43 tests passed.
- Working-tree self-review: `trc_22b49c80cdfa` — only the intended contract/test corrections plus task metadata.
- Strict repository review: `trc_72737bbd9a1c` — no findings.
- Full verify: `trc_24d264ef412d` — publish-valid with DB guard clean.
- Finding 1 disposition: valid and fixed. The matrix now preserves the actual five `/login/device*` and `/login/oauth/access_token` routes, removes invented `/oauth/device/code`, and classifies `/oauth/token` only as MCP OAuth.
- Finding 2 disposition: valid and fixed. The matrix now includes Worker 14's `GET /auth/workspaces` and `POST /auth/handoff` authority-session routes.
- Grok rerun disposition: intentionally skipped at Ko's direction after the computer crash; no additional model process was started.
