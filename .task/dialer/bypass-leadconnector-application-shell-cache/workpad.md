# Bypass LeadConnector application shell cache

branch: `task/dialer/bypass-leadconnector-application-shell-cache`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1779/bypass-leadconnector-application-shell-cache
github pr: https://github.com/consuelohq/opensaas/pull/1779
started: 2026-08-04

## acceptance criteria

- [x] `/`, `/admin`, and `/overlay` request the current application shell through a unique internal asset cache key.
- [x] Application-shell responses are `Cache-Control: no-store`; ordinary static assets retain normal cache behavior.
- [ ] Canonical GHL custom-menu and launcher URLs load the current queue-first bundle without requiring URL changes or manual cache clearing.
- [x] LeadConnector tests, typecheck, build, strict review, and publish verify pass.
- [x] No carrier call or GHL record mutation occurs.

## plan

1. Add a red Worker test for cache-busted shell asset requests and non-cacheable shell responses.
2. Update only the shell-routing boundary; preserve API proxy and static-asset behavior.
3. Run full LeadConnector validation, strict review, and verify.
4. Merge, redeploy the Worker, and prove canonical `/admin` and `/overlay` load the queue-first asset graph in authenticated GHL.

## current status

- Edge-shell implementation and full local validation complete. Strict review is clean. Pending verify, merge, Worker redeploy, and authenticated GHL proof.

## files changed

- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- task workpad/metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 23:18:32 `review.run`: passed — OK
- 2026-08-04 23:18:33 `review.run`: passed — OK
- 2026-08-04 23:19:01 `verify`: passed — OK

## key decisions

- Keep canonical GHL URLs stable. The Worker should bypass only application-shell cache entries; content-versioned JS/CSS remain cacheable.

## Test-first contract

- Behavior: shell routes rewrite to `/` with a non-empty internal `__shell` cache key and return `Cache-Control: no-store`.
- Existing pattern: `cloudflare-worker.test.ts` asserts shell routing, iframe headers, API proxy boundaries, and static assets.
- Focused red command: `bun test packages/lead-connector/src/embed/cloudflare-worker.test.ts`.
- Expected red: current asset request has no `__shell` parameter and shell response retains asset cache headers.

## validation summary

- Red: shell asset request had no `__shell` key.
- Focused edge tests: 4/4 passed after implementation.
- LeadConnector full suite: 89/89, 761 assertions.
- Typecheck and embed build passed.
- Strict review: zero findings.

## notes for ko

- The content-versioned asset hotfix was correct, but canonical `/admin` and `/overlay` still resolved an older cached HTML shell.
- Shell routes now rewrite internally to `/` with a unique `__shell` key and return `Cache-Control: no-store`. Static assets remain normally cacheable through their SHA-derived query URLs.
- GHL menu and launcher URLs do not need to change after future deployments.

## improvements noticed

- Deployment verification must inspect both the canonical shell response and every asset URL referenced by that shell.

## issues and recovery

- The first cache hotfix exposed the second layer only after production deployment: canonical shell caching. This follow-up isolates that edge behavior into a two-file task.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
