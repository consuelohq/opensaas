# fix(os-web): preserve authority metadata routes in auth matrix

branch: `task/os-web/fix-os-web-preserve-authority-metadata-routes-in-auth-matrix`
stream: `stream/os-web`
pr: https://github.com/consuelohq/opensaas/pull/1565
started: 2026-07-22
source stream sha: `74fabb5101`

## acceptance criteria

- [x] Add every currently registered public authority support route omitted from `UNIVERSAL_AUTH_ROUTE_MATRIX`: `/health`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, and `/.well-known/oauth-protected-resource/mcp`.
- [x] Preserve the exact `app.all`/`ALL` registration contract and classify health separately from OAuth discovery/resource metadata.
- [x] Add regression tests that fail if any preserved public support route disappears or is reclassified.
- [x] Rerun focused contract tests, authority architecture/worker regressions, strict review, and full verify.
- [ ] Push the fix, disposition the Codex finding, merge PR #1565 into `stream/os-web`, and leave the stream review PR unpromoted to `main`.

## plan

1. Use `registerHealthRoutes` and `DEVICE_AUTHORITY_ROUTE_POLICIES` as the runtime sources of truth.
2. Add exact failing assertions to the existing web-auth contract test.
3. Extend only the route access union and matrix entries required by the finding.
4. Validate, review the diff, publish, reply to the review, and merge to the stream.

## Test-first contract

- Behavior under test: the executable Worker 14 boundary must preserve public health and OAuth metadata/discovery routes needed by health checks, MCP client discovery, and bearer challenges.
- Existing local pattern: exact route objects in `packages/os/tests/os-web-auth-contract.test.ts` checked against `UNIVERSAL_AUTH_ROUTE_MATRIX`.
- Changed tests: require `ALL /health` as `public-health`; require all three `/.well-known/*` endpoints as `public-oauth-metadata` with owner `existing`.
- Focused red command: `bun run --cwd packages/os test -- tests/os-web-auth-contract.test.ts`.
- Expected red failure: all four routes are absent from the matrix on stream commit `74fabb5101`.
- No-test waiver: none.

## current status

- New follow-up task started from `stream/os-web` after Codex reviewed stream commit `74fabb5101`.
- The finding is valid. `registerHealthRoutes` registers all four omitted paths with `app.all`, and `DEVICE_AUTHORITY_ROUTE_POLICIES` marks them public.
- No runtime handler, provider, WAF, OAuth algorithm, or persistence behavior changed; this is an executable-contract correction only.
- Focused red: `trc_ff5a04f2b05b` reproduced the missing-route defect (1 failed, 7 passed).
- Focused green: `trc_ae06e0499315` passed 8/8.
- Selected syntax and regression validation: `trc_ff0793b78f50` passed syntax and 70/70 tests.
- Strict review: `trc_fa4721b3b79b` found zero issues.
- Full verify: `trc_a5dedd76b1cf` passed and is publish-valid with a clean DB guard.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-22 21:44:42 fs.write: `.task/os-web/fix-os-web-preserve-authority-metadata-routes-in-auth-matrix/workpad.md`
- managed by workspace hooks

## workspace-owned: validation evidence

- focused red: `trc_ff5a04f2b05b`
- focused green: `trc_ae06e0499315`
- selected regressions: `trc_ff0793b78f50`
- strict review: `trc_fa4721b3b79b`
- publish verify: `trc_a5dedd76b1cf`
- managed by workspace hooks
- 2026-07-22 21:46:08 `review.run`: passed — OK
- 2026-07-22 21:46:19 `verify`: passed — OK

## key decisions

- Use distinct `public-health` and `public-oauth-metadata` access classes instead of overloading `public-preauth` or `public-oauth`; this keeps Worker 14's routing/security intent explicit.
- Preserve `ALL` because Hono registers these paths with `app.all`, even though their handlers return public read-only responses.
- Treat `/.well-known/oauth-protected-resource/mcp` as the MCP metadata alias referenced in the review; `/mcp` and `/mcp/*` were already preserved separately.

## notes for ko

- This closes a Worker 13 contract-completeness gap. It does not implement Worker 14 universal login.
- After this merge, Worker 14 can consume the matrix without accidentally deleting existing health or OAuth discovery/resource metadata routes.

## improvements noticed

- The matrix should eventually be mechanically compared with `DEVICE_AUTHORITY_ROUTE_POLICIES` so omissions become test failures automatically rather than reviewer discoveries.

## issues and recovery

- Typed `task.push` injected unsupported `--task-session` and failed (`trc_ff83f65c3865`); recovered with the same OS-owned `task-push.js` inside the scoped task worktree.
- An initial validation attempt used nonexistent package script `check:syntax` and failed before tests ran (`trc_0d1de15383e6`); reran with the repository command `node packages/os/scripts/check-syntax.js`.
- The successful regression run emitted a non-failing trace-persistence warning because the test harness could not load `bun:sqlite`; all 70 assertions passed and no product behavior used that trace sink.
- Initial no-session `fs.read` was ambiguous because other workers have active task worktrees (`trc_57bd0b16c8b5`); the follow-up task was started directly from the stream and all subsequent calls are task-scoped.

---

## publish checklist

- [x] focused red then green
- [x] architecture and authority worker regressions pass
- [x] strict review passes
- [x] full verify is publish-valid
- [ ] task commit pushed
- [ ] Codex finding disposition posted
- [ ] PR #1565 merged into `stream/os-web`
- [ ] task finished; stream PR remains unpromoted

- 2026-07-22 21:44:42 write: `.task/os-web/fix-os-web-preserve-authority-metadata-routes-in-auth-matrix/workpad.md`
