# workspace trace table through hono

branch: `task/os-web/workspace-trace-table-through-hono`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1604/workspace-trace-table-through-hono
github pr: https://github.com/consuelohq/opensaas/pull/1604
started: 2026-07-23
task session: `tsk_2d079fa0254f`
start point: fresh `main` at source SHA prefix `ede0bba6`
assigned lane: Stream C / `stream/os-web`; local deterministic fixtures, browser verification, and GitHub CI only
real-machine boundary: no install, update, reset, restart, or uninstall on Ko's Mac Mini or MacBook Air

## acceptance criteria

- [x] Serve the useful trace table and its assets from the existing local OS Hono application rather than a parallel product runtime.
- [x] Require the established workspace session for the trace HTML and data routes, and scope every read to the authenticated workspace.
- [x] Resolve trace reads against an explicitly selected or current/default node without silently crossing to another machine when that node is stale or offline.
- [x] Preserve bounded opaque-cursor pagination, near-live refresh, semantic row formatting, raw-detail inspection, and stable selection/open/collapse/fullscreen behavior.
- [x] Provide deterministic loading, empty, offline, reconnecting, and error states without exposing topology or secrets.
- [x] Redact bearer tokens, secret prompt material, environment values, credentials, and sensitive local details from summary and raw payload responses.
- [x] Prevent archive/static refresh from unexpectedly replacing the live local trace assets or violating workspace/node cache isolation.
- [x] Retire or clearly demote redundant trace-site ownership while preserving compatibility contracts required by existing callers.
- [x] Add focused behavioral, auth-isolation, routing, cursor, redaction, static/Hono integration, and browser coverage; preserve existing trace/auth/node regressions.
- [ ] Complete CodeRabbit and Grok 4.5 review, post findings/dispositions to GitHub, pass CI, and merge PR #1604 into `stream/os-web` only.

## plan

1. Map Worker 13 auth, Worker 15 route ownership, Worker 25 node routing, existing trace data-plane contracts, Hono routes, and generated trace UI. **Complete.**
2. Select the narrow ownership boundary and record the test-first route/UI contract. **Complete.**
3. Add focused behavioral tests first and capture the expected red failures. **Complete.**
4. Implement the smallest Hono/static-adapter, workspace/node-scoping, UI-state, and redaction changes needed to satisfy the contract. **Complete.**
5. Run focused and broader trace/auth/node regression suites and browser desktop/mobile verification. **Complete.**
6. Push PR #1604, request CodeRabbit, run the prescribed Grok 4.5 wrapper, post and disposition every finding, and rerun validation. **Pending.**
7. Merge the task PR into `stream/os-web`, remove temporary review artifacts, and stop without promoting the stream to main. **Pending.**

## current status

- Implementation and local validation are complete. Hono now owns the authenticated trace document and invariant assets, the trace gateway carries explicit workspace/node context, raw trace details are redacted before browser delivery, and the generated Sites trace page delegates to the same renderer as an inline compatibility copy. Strict review, verify, publication, CodeRabbit, Grok, CI, and merge remain.
- Final local evidence: strict `review.run` has zero findings (`trc_a1d1f1574a36`); 77 Node/Vitest tests and 12 Bun-native SQLite tests pass (`trc_5fc7d812a654`); full `verify` against `origin/main` passes and is publish-valid (`trc_e1bf417b4d44`).

## test-first contract

- Behavior under test: an authenticated workspace member can load `/traces`, receive only the selected workspace/node's redacted trace rows through bounded opaque cursors, preserve inspector state during refresh, and receive explicit offline/empty/error states without cross-node fallback.
- Existing local patterns to follow: Hono route policies and session middleware, `trace-sites-gateway-*` cursor/read contracts, `trace-sites-browser-client`, generated trace markup in `sites.ts`, and Worker 25's explicit/default node routing errors.
- New or changed tests: focused Hono trace surface contract plus existing trace gateway/browser-client tests extended for workspace/node isolation, offline behavior, static asset ownership, and redaction.
- Focused red command: `bun --cwd packages/os vitest run tests/traces-hono-routes.test.ts tests/trace-history-redaction.test.ts` through `code.call` with `tddPhase: red`.
- Expected red failure: `/traces` is not yet served by Hono under workspace auth and current trace reads do not yet enforce authenticated workspace/node isolation at the local Hono boundary.
- No-test waiver: none.

## files changed

- `packages/os/scripts/lib/trace-site.ts`: shared responsive trace table/inspector renderer, stable view-state persistence, bounded polling, and deterministic loading/empty/offline/reconnecting/error states.
- `packages/os/scripts/server/routes/traces.ts` and `route-policies.ts`: signed Hono `/traces` document/assets, workspace/node fail-closed checks, and private cache isolation for data/error responses.
- Trace gateway/read/backend contracts: node context propagation, node-aware idempotency, and server-side redaction of prompts, environment fields, credentials, bearer values, stderr, and local user paths.
- `packages/os/scripts/lib/sites.ts`: removed the parallel trace page implementation and retained only a shared-renderer compatibility copy.
- Added focused route, renderer, redaction, gateway, architecture, auth, and node-routing coverage.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-23 21:46:59 `review.run`: passed — OK
- 2026-07-23 21:47:42 `review.run`: passed — OK
- 2026-07-23 21:48:12 `verify`: passed — OK

## key decisions

- Start from fresh `main`; publish only to the assigned `stream/os-web` task PR.
- Reuse the existing trace data plane and semantic browser/table behavior. Do not create another dashboard, React application, trace store, or review tool.
- Treat workspace session and explicit/default node resolution as separate mandatory gates; an offline selected/default node must be disclosed and must not fall through to another machine.
- Keep workspace/node-specific data out of invariant CSS/JavaScript assets; only the authenticated HTML document carries scope metadata.
- Persist only inspector view state in browser storage, never trace payloads.

## notes for ko

- No lifecycle action will be executed on either real Mac. This task stays within local fixtures, browser checks, and GitHub CI.
- Browser evidence covered desktop table/inspector, refresh persistence, collapse/full-screen transitions, and a 390×844 single-column mobile layout.

## improvements noticed

- none yet

## issues and recovery

- A task-scoped `batch` read dropped the outer task session and each child returned `AMBIGUOUS_TASK_SELECTION` across five active worktrees (`trc_d7b2a9829a3b`; child traces `trc_71de03bd536e`, `trc_6e0fb5d28485`, `trc_64a97699b92d`, `trc_8274b162892d`). Recovery: use direct calls with `taskSession: tsk_2d079fa0254f`; all four dependent files then read successfully. No native or legacy fallback was used.
- A scoped search included a nonexistent `packages/os/tests/trace-sites` path and failed with `COMMAND_FAILED` (`trc_63f2c9b4a467`). Recovery: reran the search against `packages/os/tests` only (`trc_61683a657f72`).
- The first focused test command used obsolete `code.call` mode `work` and was rejected before execution (`trc_637f0cfc393d`). Recovery: reran with typed mode `verify` and `tddPhase: red`; the expected five behavioral failures were captured (`trc_de3b99933811`).
- The first broad validation wrapper expanded command arrays incorrectly, so `bun run typecheck` printed Bun help rather than running the package script; the same run also hit the repository's known Node/Vitest inability to import `bun:sqlite` (`trc_92df84b45595`). Recovery: use literal typed commands, keep non-SQLite Vitest coverage separate, and exercise SQLite behavior through Bun-native code/tests. No implementation bypass was used.
- A literal function-name search included an unescaped `(` and ripgrep rejected the generated regular expression (`trc_ad1f27ffe5b0`). Recovery: reran the scoped search with `historyFailureResponse` only (`trc_903be5d113ca`) and completed the cache-context audit.
- Strict review initially found three generated-browser bare-catch patterns and one async helper without a local error boundary (`trc_53768a3ad2a2`). Recovery: marked emitted-browser catch values as runtime-unknown without changing generated JavaScript semantics, added a typed `unknown` boundary to trace authorization, and reran review clean (`trc_a1d1f1574a36`).
- A combined validation run used the normal Node/Vitest lane for `bun:sqlite` cases and failed six SQLite-backed tests after 83 other tests passed (`trc_2d441e2aeb9c`). Recovery: split the documented lanes; 77 normal Vitest tests and all 12 Bun-native SQLite tests passed (`trc_5fc7d812a654`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os-web): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/docs/architecture/workspace-node-registry.md`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/workers/13-web-auth-contract.md`
- `packages/os/plans/consuelo-os-foundation/workers/15-launcher-gtm-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/25-multi-node-registry-routing.md`
- `packages/os/scripts/lib/redaction.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/trace-site.ts`
- `packages/os/scripts/lib/trace-sites-browser-client.ts`
- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/review.js`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/environments.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/routes/traces.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/artifacts-hono-routes.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/os-web-auth-contract.test.ts`
- `packages/os/tests/redaction.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-23 21:47:33 apply-patch: `packages/os/scripts/lib/trace-site.ts`
- 2026-07-23 21:47:33 apply-patch: `packages/os/scripts/server/routes/traces.ts`

- 2026-07-23 21:48:21 apply-patch: `.task/os-web/workspace-trace-table-through-hono/workpad.md`