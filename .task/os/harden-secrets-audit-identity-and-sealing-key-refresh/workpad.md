# Harden secrets audit identity and sealing key refresh

branch: `task/os/harden-secrets-audit-identity-and-sealing-key-refresh`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2199/harden-secrets-audit-identity-and-sealing-key-refresh
github pr: https://github.com/consuelohq/opensaas/pull/2199
started: 2026-08-26

## acceptance criteria

- [x] Secret-install audit identity is derived from the authenticated principal, never client-supplied headers.
- [x] Failed secret installs invalidate the browser's cached sealing setup before retry.
- [x] Focused Secrets, owner-dashboard, OAuth, and security tests pass.
- [x] Static review reports no blocking issues.

## plan

1. Add focused regression tests for spoofed audit application identity and stale sealing-key retry.
2. Replace request-header audit identity with the authenticated MCP principal.
3. Invalidate cached browser sealing setup on failed install.
4. Run focused tests, security/OAuth coverage, syntax/type checks, and static review.

## current status

- Ready to publish. Both red regressions are green; the related security/OAuth slice is green; static review has zero issues.

## files changed

- packages/os/scripts/server/routes/secrets.ts
- packages/os/scripts/lib/secrets-site.ts
- packages/os/tests/secrets-hono-routes.test.ts
- packages/os/tests/secrets-surface.test.ts

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 05:01:12 fs.write: `.task/os/harden-secrets-audit-identity-and-sealing-key-refresh/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 05:09:15 `review.run`: passed — OK

## key decisions

- Treat only the authenticated principal as authoritative for audit actor and application identity.
- Generate audit correlation IDs server-side.
- Drop cached sealing setup on any failed install so rotated node keys recover without a reload.

## notes for ko

- Focused regressions: 12/12 passed.
- Related Secrets/launcher/owner-dashboard/device-auth/OAuth/security suite: 91/92 passed.
- The sole failure is unrelated: the trace endpoint test runs under Node and cannot import Bun's bun:sqlite module.
- packages/os syntax/typecheck and git diff integrity passed.
- review.run: 0 new issues, 0 blockers.

## improvements noticed

- none yet

## issues and recovery

- The workspace-gateway end-to-end trace assertion returns 500 only because its Vitest Node runtime cannot import bun:sqlite; the secret install path completed before that unrelated trace assertion.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: (1) secret mutations cannot accept client-supplied audit actor/application headers and use identity derived at the trusted Workspace Edge boundary; (2) a failed sealed-secret install clears the cached setup so the next retry fetches the current node public key.
existing local pattern: Workspace Edge already verifies signed/authenticated principals before proxying, Secrets Hono routes accept trusted audit headers, and secrets-site caches setup in a page-local promise.
new or changed tests: extend gateway/Secrets route coverage with spoofed caller headers and asserted trusted replacements; extend Secrets surface/script coverage to require cache invalidation after install failure and a fresh setup fetch on retry.
focused red command: bun run test -- tests/secrets-hono-routes.test.ts tests/secrets-surface.test.ts tests/workspace-gateway-node-end-to-end.test.ts
expected red failure: spoofed audit headers currently reach the secret route unchanged, and the browser script retains secretSetup after a failed install.
no-test waiver: not applicable.

- 2026-08-26 05:01:12 append: `.task/os/harden-secrets-audit-identity-and-sealing-key-refresh/workpad.md`
