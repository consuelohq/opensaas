# Worker 17: Web Security, Route Matrix, Deployment, and End-to-End Acceptance

## Dependencies

Begin after Workers 14, 15, 16, and 25 are integrated into `stream/os-web`.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full, then read all web task workpads, repository steering, and OS skills. Start an integration task from the web stream. Do not replace implemented architecture with a new framework.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Integrate, deploy safely, and prove the full browser/workspace flow without loosening MCP, connector, OAuth, WAF, or site isolation.

## Required validation matrix

Lock method, path, auth class, status, headers, storage, and destination for:

- health and OAuth metadata;
- device-code endpoints;
- Google login/callback;
- MCP authorization/token/introspection;
- central `/mcp` proxy;
- login workspace chooser;
- handoff consume/logout;
- launcher;
- `/gtm`;
- traces and trace feed;
- connector origin;
- route-not-found and unsupported-method behavior.

## Security acceptance

- OAuth redirect parameters and PKCE remain exact.
- One-hour access-token expiry renews transparently through the refresh-token grant without asking the user to reconnect.
- Refresh-token rotation is retry-safe: duplicate/concurrent refreshes, an interrupted response, or a transient persistence failure cannot invalidate the only usable credential and strand a valid ChatGPT connection.
- `WWW-Authenticate` challenges remain compliant.
- Handoff is one-time, expiring, host-bound, and replay-safe.
- Cookies are narrowly scoped.
- Protected pages return no sensitive data before auth.
- Connector traffic reaches the private tunnel and still enforces signed-edge/HMAC policy.
- WAF rules distinguish public metadata from protected MCP/connector traffic without broad bypasses.
- OpenAI/agent access policy remains explicit.
- Logs and error bodies redact credentials.
- Workspace A cannot access workspace B launcher, GTM, traces, sessions, or cache.
- Node A cannot impersonate node B, a later member node cannot replace the default route, and unavailable nodes never trigger silent cross-machine fallback.

## Operational work

- Add guarded release/migration steps using existing dedicated GitHub environment secrets.
- Do not print secrets.
- Make deployments idempotent and fail closed.
- Preserve old records/routes until new acceptance passes, then remove only explicitly retired test routes/accounts approved by Ko.
- Produce a cleanup inventory rather than deleting unknown Cloudflare resources.

## Live acceptance

After explicit deployment approval:

1. Login at `os.consuelohq.com`.
2. Resolve Ko to `internal.consuelohq.com` without hard-coded behavior.
3. Open protected launcher.
4. Navigate to `/gtm` without second login.
5. Open protected traces.
6. Connect ChatGPT to central MCP.
7. Discover `get_steering` and `call` only.
8. Run steering, tools.search, and one harmless call.
9. Force or simulate access-token expiry, complete refresh rotation, and repeat steering plus a harmless call without reconnecting the app.
10. Replay the previous refresh request and exercise an interrupted/duplicate refresh path; prove the session remains usable and rotation does not mint an unbounded credential family.
11. Verify connector and WAF logs show intended boundaries.
12. Repeat a bounded second-workspace isolation test.
13. After Ko performs the second-machine login, verify distinct node identities, default-node preservation, signed presence, explicit routing, offline state, and revocation.

## Owned files

- Web integration tests and route matrix.
- Release workflow changes specific to web deployment.
- Minimal integration fixes across completed web modules.
- Cleanup inventory/runbook.

## Forbidden scope

- Do not delete test accounts/domains before acceptance and explicit approval.
- Do not broaden provider/customer IP access casually.
- Do not require customers to own Cloudflare accounts.
- Do not alter unrelated sites or workspace products.

## Completion output

Report deployed commit/runtime bundle, migrations, route matrix, security evidence, live acceptance results, remaining cleanup items, and whether the web stream is genuinely ready to merge.
