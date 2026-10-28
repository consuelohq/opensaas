# mcp security state hardening

branch: `task/os/mcp-security-state-hardening`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1824/mcp-security-state-hardening
github pr: https://github.com/consuelohq/opensaas/pull/1824
started: 2026-08-10

## acceptance criteria

- [x] Stack exactly on Branch 1 / PR #1819 head `70f1778e80791a85966066173376e3671de28ce5` without rewriting Branch 1 history.
- [x] Replace request-time `auth.json` replay read/check/write with atomic replay admission safe across independent OS worker processes on one node.
- [x] Stop ordinary authenticated requests from rewriting credential configuration merely to record `lastUsedAt`; preserve usage/audit evidence separately.
- [x] Make steering loop-guard decision + event recording atomic across concurrent workers.
- [x] Derive steering caller identity from Branch 1 authenticated principal context rather than `Mcp-Session-Id` for HTTP MCP.
- [x] Preserve existing legacy MCP session/wire behavior; Branch 2 does not implement the 2026 transport migration.
- [x] Preserve dangerous-material admission, exact tool scopes, OAuth/CIMD/Origin protections, Cloudflare edge signing, and existing observability behavior from Branch 1.
- [x] Add concurrency/security regression tests that fail under the prior race-prone implementation.
- [x] Full verify and strict review are clean before publish.

## plan

1. Reconcile Branch 1 exact head into this task branch and inspect the resulting principal/auth paths.
2. Discover current replay, credential usage, steering guard, runtime-state, and test ownership; note overlapping work before editing.
3. Add focused red tests for concurrent replay admission, atomic steering-guard progression, principal caller identity, and immutable request-time auth config.
4. Implement the smallest shared/atomic persistence changes using existing SQLite/runtime-state patterns rather than a new distributed store.
5. Run focused security/runtime-state tests, broader MCP/auth/security regressions, and both Bun + Node/Vitest integration paths.
6. Run strict review + full verify; publish PR #1824 only.

## Test-first contract

- Behavior under test: two independent workers/process-equivalent callers cannot both accept the same signed nonce; concurrent `get_steering` calls for the same authenticated principal cannot both observe first-call/full state.
- Existing local pattern followed: SQLite-backed runtime state and existing security-gateway / steering trace tests.
- Red evidence: `cd packages/os && bun test tests/runtime-state.test.ts tests/mcp-gateway.test.ts tests/security-gateway.test.ts` produced 41 passing existing tests and 4 intended failures: principal-vs-session steering identity, request-time `auth.json` mutation, missing atomic steering claim, and missing atomic replay claim.
- Green evidence: the same focused suite now passes 47/47 tests with 241 assertions.
- No-test waiver: none.

## current status

- Branch 1 exact head was merged into this task branch with no conflicts; Branch 1 remains unmerged to `stream/os`.
- Implementation is complete and validated.
- Replay admission for machine-signed and workspace-edge requests now uses an atomic SQLite uniqueness claim scoped to credential/workspace identity. Legacy `auth.json` nonce records are still honored during the transition window, but no new request-time nonce state is written there.
- Successful machine and bearer authentication no longer rewrites credential configuration for `lastUsedAt`; usage lives in runtime SQLite and remains visible through credential status APIs.
- Steering guard progression is an atomic `BEGIN IMMEDIATE` decision+insert transaction and is keyed by Branch 1 `principalKey`, not legacy MCP session identity.
- Runtime SQLite has Bun (`bun:sqlite`) and Node/Vitest (`node:sqlite`) adapters so importing/exercising the Hono security path under repository integration tests does not break; production Bun continues using `bun:sqlite`.
- Legacy MCP session issuance and `Mcp-Session-Id` behavior remain untouched for Branch 3 compatibility work.

## files changed

- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/runtime-state.test.ts`
- `packages/os/tests/security-gateway.test.ts`


## workspace-owned: files changed

- `.task/os/mcp-security-state-hardening/workpad.md`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/runtime-state.test.ts`
- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: activity log

- 2026-08-10 03:53:15 fs.write: `.task/os/mcp-security-state-hardening/workpad.md`
- 2026-08-10 04:06:22 fs.write: `.task/os/mcp-security-state-hardening/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 04:05:31 `review.run`: passed — strict review, 0 blocking findings.
- 2026-08-10 04:05:40 `verify`: passed — full mode, `publishValid: true`, scoped against Branch 1 head.
- 2026-08-10 04:06:32 `verify`: passed — OK
- 2026-08-10 04:14:26 `review.run`: passed — OK
- 2026-08-10 04:14:35 `verify`: passed — OK
- 2026-08-10 04:14:51 `verify`: passed — OK

## validation details

- Focused Bun security/state: 47 passed, 0 failed, 241 assertions.
- Broader OS security/MCP/steering/Hono subset: 93 passed with 5 intentional workspace-gateway skips; the Cloudflare authority file was rerun with its intended Vitest runner rather than Bun's test shim.
- Cloudflare authority via Vitest: 26 passed, 0 failed.
- Hono trace + local-server review integrations via Vitest: 24 passed, 0 failed; later trace + authority confirmation: 32 passed, 0 failed.
- `git diff --check`: clean.
- Strict review: 0 own issues, 0 pre-existing issues, 0 blocking issues.
- Full verify: passed, database safety gate passed, `publishValid: true`.

## key decisions

- Branch 2 is stacked on the exact Branch 1 head rather than pretending `stream/os` already contains PR #1819.
- This branch hardens security/correctness state only; modern stateless MCP wire behavior remains Branch 3.
- Same-node correctness state reuses SQLite transactions/uniqueness rather than introducing Redis or another service.
- Atomic replay admission happens after cryptographic/signature/scope validation; there is no redundant shared-state pre-read.
- Request-time usage/replay state is separated from credential configuration so multiple workers do not race on `auth.json`.
- Old replay records remain honored for compatibility but are no longer appended to `auth.json`.
- Node/Vitest uses `node:sqlite` only as a compatibility adapter for repository integration execution; Bun production uses `bun:sqlite`.

## notes for ko

- PR #1824 is intentionally dependent on PR #1819 until Branch 1 lands.
- Branch 2 does not remove or alter legacy MCP transport sessions; Branch 3 remains the dual-era/stateless transport PR.

## improvements noticed

- None required for Branch 2. Broader process-local mutation queues/settings state remain intentionally deferred to Branch 4 (`os-replica-correctness`).

## issues and recovery

- `task.call` is advertised by the task workflow but rejected by the generated OS manifest (`UNKNOWN_TOOL_SCOPE`). Container execution cannot enter the host macOS worktree. Task-scoped `code.call` was used for Git/runtime evidence; lifecycle/review/verify/publish remained on typed OS tools.
- An initial ad-hoc `bunx tsc --noEmit` from `packages/os` was not a valid project check because that directory has no standalone tsconfig; repository `review.run` and `verify` performed the authoritative type/lint/spec checks and passed.
- Running `os-device-authority-worker.test.ts` with `bun test` fails because Bun's test shim lacks Vitest `vi.stubGlobal/unstubAllGlobals`; rerunning with `bunx vitest` passed 26/26 and no code change was made for that runner mismatch.
- The first Node/Vitest trace integration exposed a real Branch 2 issue: static/runtime Bun SQLite coupling. Runtime state now lazily selects Bun or Node SQLite and the affected integration suites pass.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): harden MCP security state" --changed
bun run task:pr -- --task-only --ready
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
- `.task/os/mcp-security-state-hardening/workpad.md`

- 2026-08-10 03:53:15 write: `.task/os/mcp-security-state-hardening/workpad.md`

- 2026-08-10 04:06:22 write: `.task/os/mcp-security-state-hardening/workpad.md`

## wait log

- Start: 2026-08-10T04:09:30Z
- Wait reason: GitHub has completed the failing distribution job but withholds job logs until the parent workflow run completes.
- Duration: 15s, one bounded attempt.
- Resume action: inspect run 31354534609 job 93351642450 with `gh run view --log-failed`, then re-check PR #1824 checks.
- Expected signal: parent workflow is complete and failed-step logs identify a concrete assertion/error.
- Fallback: if logs remain unavailable, inspect job annotations/API evidence and report the CI failure as unresolved without guessing.
- Wait attempt 1 result: typed `wait` facade returned HTTP 502 before the timer completed.
- Recovery plan: task-scoped terminal sleep for 15s; immediately inspect run 31354534609 job 93351642450 logs after wake.
- Wait completion: GitHub logs became available on the next immediate verification; run 31354534609 job 93351642450 failed only in `tests/install-state.test.ts` because `gateway-audit.jsonl` was written under `<home>/logs` instead of the established `<home>/node/logs` path.
- Root cause: Branch 2 overloaded the existing `homeFromGeneratedAuthPath` helper with two meanings. Audit/config code needs the security-node root; runtime SQLite needs the top-level Consuelo home.
- Fix: restored `homeFromGeneratedAuthPath` to its original security-root semantics and added `consueloHomeFromGeneratedAuthPath` only for runtime replay/credential-usage state.
- Regression result: the exact failing install-state test passes; the exact CI distribution-regression command now passes 89 tests with 5 intentional skips.
- Post-fix safety: focused Bun security/state 47/47, Node/Vitest trace+authority 32/32, `git diff --check` clean, strict review 0 findings, full verify publish-valid.
