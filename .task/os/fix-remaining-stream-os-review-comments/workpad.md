# Fix remaining stream OS review comments

branch: `task/os/fix-remaining-stream-os-review-comments`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1895
started: 2026-08-12

## acceptance criteria

- [ ] Resolve every still-valid second-wave CodeRabbit finding on stream PR #1892 without changing unrelated behavior.
- [ ] Give workspace node list payloads concrete types so launcher sanitization is type-safe.
- [ ] Never replace a completed upstream MCP response with a post-upstream task-affinity bookkeeping error; report bookkeeping failures safely out of band.
- [ ] Create new task affinity only from a successful `task.start`, not from arbitrary calls carrying an unbound taskSession.
- [ ] Add bounded task-affinity lifetime, prune stale affinity before routing/claim decisions, refresh active owner affinity, and remove affinity when its owner node is deleted.
- [ ] Prevent stale cloud-pricing responses from updating the Nodes UI after region changes.
- [ ] Remove the launcher Nodes test `as never` escape hatch.
- [ ] Align the integration fixture `/nodes` route with production workspace-session auth.
- [ ] Rename affected task-affinity/routing tests to `should [behavior] when [condition]`.
- [ ] Strengthen trace-persistence reattachment coverage by comparing stable event identities.
- [ ] Focused tests, strict review, and full verify pass before integration into `stream/os`.
- [ ] No Mac, Cloudflare, GCP, billing, node, or runtime deployment occurs.

## review audit

1. `workspace-nodes.ts`: untyped `workspaceNodeListPayload` makes sanitize/index/map unsafe — valid.
2. `mcp-proxy.ts`: post-upstream affinity conflict/storage failure can hide a successful side effect — valid.
3. `mcp-proxy.ts`: arbitrary successful calls can create affinity for a new taskSession — valid.
4. `stores.ts`: affinity has no expiry and survives owner-node deletion — valid.
5. `settings-site.ts`: concurrent region pricing requests can resolve out of order — valid. Two CodeRabbit comments describe the same race; one fix covers both.
6. `launcher-nodes-control-plane.test.ts`: `as never` suppresses fixture type validation — valid.
7. `workspace-edge-sites-gateway-integration.test.ts`: `/nodes` fixture is public although production route is workspace-session — valid.
8. `workspace-node-registry-routing.test.ts`: affected affinity/routing tests still violate required naming form — valid.
9. Outside-diff `trace-persistence.test.ts`: row count does not prove event identity across reattachment — valid.

## design decisions

- Task affinity uses a bounded TTL with legacy migration semantics: old records without explicit `expiresAt` expire at `updatedAt + TTL`, so existing stored records remain usable for one bounded window instead of becoming immortal or disappearing immediately.
- `byWorkspaceTaskAffinity` becomes expiration-aware using the request's current time so stale ownership cannot block routing before another claim occurs.
- A successful task-scoped call may refresh an already-existing affinity for the same owner, but only successful `task.start` may create a new affinity.
- Once an upstream node call returns, affinity bookkeeping is advisory to that completed call. Conflict/storage/reporting failures are logged through the existing structured operational logger and the original upstream response is returned.
- Node deletion cleans matching affinities using the durable storage prefix list when available; the in-memory store performs the equivalent map cleanup. Conditional node deletion only cleans affinity after the node match succeeds.
- Pricing uses a monotonically increasing request generation so stale success and stale failure paths are both ignored. No browser AbortController dependency is required.

## Test-first contract

Before production edits:

- Add store/routing tests that expect: expired affinity is not returned and can be reclaimed by a different owner; deleting a node removes its affinity; conditional non-match preserves affinity; arbitrary `fs.read` with a new taskSession does not create affinity; a successful upstream `task.start` remains successful when affinity bookkeeping conflicts/throws and emits a safe warning.
- Add a generated Nodes-script contract that requires a pricing request generation/current-request guard and ignores stale failures.
- Change the `/nodes` integration fixture to workspace-session and add/adjust snapshot access coverage to require authentication.
- Remove `as never`, strengthen trace event identity assertions, and rename the affected affinity/routing tests as test-only review cleanup.
- Preflight the focused test files for destructive literals, then run focused tests. Capture expected red failures for expiry, owner deletion, post-upstream response precedence, task.start-only creation, and pricing request ordering before production edits.

## plan

1. Add the test-first changes above and run the focused red suite.
2. Implement typed node-list DTOs, affinity TTL/cleanup/response precedence, and Nodes pricing generation guard.
3. Run focused green suites plus MCP/node/security regressions and package syntax/typecheck.
4. Run strict review and full verify against `origin/stream/os`.
5. Push/merge PR #1895 into `stream/os`, then wait for fresh #1892 CI and CodeRabbit state.
6. If no actionable review/check failures remain, merge #1892 to `main`, confirm main contains the stream head, then clean only merged/superseded OS task branches/worktrees after previews.

## discovery

- Current `WorkspaceTaskAffinity` has `createdAt`/`updatedAt` only; durable and memory stores do not expire it.
- Current `byWorkspaceTaskAffinity` does no freshness check.
- Durable `StorageLike` supports optional prefix `list`; `StorageTransactionLike` currently exposes get/put/delete only.
- Current node deletion paths do not clean affinity; memory store mirrors that omission.
- Current MCP proxy calls upstream first, then may return 409/500 from affinity bookkeeping.
- Current affinity creation condition accepts any successful facade call with a previously unbound taskSession.
- Current generated Nodes script has no request generation/abort guard around `loadPricing()`.
- Current launcher fixture has `} as never)` and integration `/nodes` route auth is `public`.
- Current trace reattachment test asserts only row count plus one shared trace ID.

## current status

- PR #1894 (first review wave) is merged into `stream/os` and fully verified.
- Fresh stream review produced this second wave; PR #1895 is based directly on current stream head `09cf640b...`.
- Discovery and exact comment audit complete. No production edits in this task yet.

## workspace-owned: files changed

- none yet

## workspace-owned: validation evidence

- none yet for PR #1895; red suite is next.
- 2026-08-12 18:10:21 `review.run`: passed — OK
- 2026-08-12 18:11:14 `review.run`: passed — OK
- 2026-08-12 18:11:35 `verify`: passed — OK

## notes for ko

- This is the final review-cleanup pass before the stream/main merge unless a genuinely new review/check failure appears after integration.

- 2026-08-12 18:05:01 write: `.task/os/fix-remaining-stream-os-review-comments/workpad.md`

## files changed

- none yet

## workspace-owned: activity log

- 2026-08-12 18:05:01 fs.write: `.task/os/fix-remaining-stream-os-review-comments/workpad.md`
- 2026-08-12 18:11:25 fs.write: `.task/os/fix-remaining-stream-os-review-comments/workpad.md`
- 2026-08-12 18:11:45 fs.write: `.task/os/fix-remaining-stream-os-review-comments/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## implementation status

- [x] Workspace node list payload and safe node entries now have concrete exported types; launcher sanitization is type-safe.
- [x] Task affinity has a 7-day bounded TTL. Legacy records without `expiresAt` use `updatedAt + TTL`; expiration-aware reads prune stale ownership before routing.
- [x] Same-owner claims refresh `updatedAt`/`expiresAt`; stale claims can be reclaimed by a new owner.
- [x] Durable affinity owner index plus legacy prefix scan cleans affinity on normal/conditional node deletion; the memory store mirrors cleanup.
- [x] New affinity is created only by successful `task.start`; successful calls with an existing affinity refresh it.
- [x] Post-upstream affinity conflict/storage failures no longer replace a successful MCP response; they emit a safe structured warning and return the original response.
- [x] Nodes pricing uses a monotonic request generation and ignores stale success/failure responses after region changes.
- [x] Launcher fixture `as never` removed; `/nodes` integration fixture is workspace-session protected and explicitly checks unauthenticated denial.
- [x] Affected affinity/routing tests renamed to required `should ... when ...` form.
- [x] Trace persistence reattachment compares stable per-event identity keys, not just row count.

## validation evidence

- RED focused suite: 5 expected failures captured — expired affinity remained readable, deleted owner affinity remained, unbound non-start call created affinity, post-upstream conflict returned 409 instead of upstream 200, and Nodes pricing lacked a stale-request guard.
- GREEN primary focused suite: 61/61 passed, 602 assertions across Nodes UI/control plane, trace persistence, and workspace node/affinity routing.
- Workspace-edge Sites contract with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`: 14/14 passed, 117 assertions.
- MCP/auth/security regressions: 40/40 passed, 398 assertions across `mcp-gateway`, tool-scope authorization, and universal login.
- `packages/os` syntax/typecheck passed.
- Strict review initially found four local error-handling rule findings in new affinity helpers; added local fail-closed try/catch boundaries.
- Strict re-review: 0 issues / 0 blockers.

- 2026-08-12 18:11:25 append: `.task/os/fix-remaining-stream-os-review-comments/workpad.md`

## final validation before publish

- Full verify passed with `publishValid=true`, strict review 0 issues/blockers, and 0 DB risks/findings.
- One non-blocking docs opportunity was emitted because `mcp-proxy.ts` changed. No public MCP request/response/tool contract changed: this task only narrows internal affinity creation, adds bounded internal routing ownership, and preserves successful upstream responses during internal bookkeeping failure. Public MCP docs therefore do not need a behavior update for this review-remediation task.
- No deployment performed.

## acceptance completion

- [x] All still-valid second-wave CodeRabbit findings resolved.
- [x] Concrete workspace node list payload types added.
- [x] Completed upstream MCP responses are preserved across affinity bookkeeping failure.
- [x] New affinity creation restricted to successful `task.start`.
- [x] Affinity TTL, stale pruning/refresh, and owner-node deletion cleanup implemented.
- [x] Nodes pricing stale-response race guarded.
- [x] Launcher `as never` removed.
- [x] `/nodes` integration fixture uses workspace-session auth.
- [x] Affected routing/affinity tests use `should ... when ...` naming.
- [x] Trace reattachment verifies stable event identities.
- [x] Focused suites, security regressions, strict review, and full verify are green.

- 2026-08-12 18:11:45 append: `.task/os/fix-remaining-stream-os-review-comments/workpad.md`
