# Drop stale content length on routed body rewrite

branch: `task/os/drop-stale-content-length-on-routed-body-rewrite`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2283
started: 2026-08-29

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

behavior under test: when Device Authority rewrites a routed MCP POST body to remove the outer routing-only `nodeId`, the proxied request must not retain the inbound `Content-Length` for the old body; untouched request streams keep their existing header behavior.
existing local pattern: `centralMcpProxyRequest()` copies inbound headers, while `proxyCentralMcpRequest()` supplies a sanitized replacement `body` for routed POSTs.
new or changed tests: extend the routed-node sanitization integration test with a deliberately stale inbound `content-length` and assert the upstream request has no `content-length` after the body replacement.
focused red command: `bun --cwd packages/os test tests/workspace-node-registry-routing.test.ts`
expected red failure: upstream currently retains the stale inbound `content-length` even though the forwarded JSON body is shorter.
no-test waiver: not applicable.

red evidence: routed-node integration failed exactly because upstream retained `content-length: 9999` after the body rewrite.
green evidence:
- workspace node routing + Device Authority worker: 2 files / 80 tests passed.
- OS syntax gate passed.
- Device Authority Wrangler dry-run passed; no deployment performed.

review context: Codex P1 on stream PR #2277 observed that explicit routed POSTs replace the inbound request body after stripping outer `nodeId` while preserving the original `Content-Length`. The proxy now deletes `content-length` only when an explicit replacement body is supplied; original-stream proxying is unchanged. The two adjacent routing test names were also normalized to the repository `should ... when ...` convention flagged by CodeRabbit.

- 2026-08-29 04:40:06 append: `.task/os/drop-stale-content-length-on-routed-body-rewrite/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 04:40:06 fs.write: `.task/os/drop-stale-content-length-on-routed-body-rewrite/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-29 04:40:28 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-29 04:40:42 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

- 2026-08-29 04:40:59 apply-patch: `.task/os/drop-stale-content-length-on-routed-body-rewrite/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 04:41:31 `review.run`: passed — OK
- 2026-08-29 04:42:15 `verify`: passed — OK
