# Worker 13: Universal Login and Workspace Session-Handoff Contract

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` completely, repository steering, and both OS engineering/task skills. Start a task from `stream/os-web`. Do not revert concurrent changes.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Lock the authentication and routing behavior in tests before changing production routes. Define how `os.consuelohq.com` authenticates a user, resolves workspace membership, and hands the browser to a protected workspace host without weakening MCP, connector, or site security.

This task owns contract analysis and failing/characterization tests, not the full implementation.

## Required investigation

- Read all device-authority Hono routes, Google OAuth, MCP OAuth, grants, memberships, nodes, connector proxying, workspace-edge routing, cookies, and D1 storage.
- Inventory every public/protected endpoint and exact method/path/status/header behavior.
- Verify current `internal.consuelohq.com`, test-host, and legacy sites assumptions.
- Identify whether a domain-wide cookie exists and how workspace sessions are currently established.
- Preserve the existing OAuth/PKCE and MCP contracts already proven in production.
- Characterize the current first-node `home` and later-node `member` behavior, including the one-workspace route record that Worker 25 must replace with explicit per-node routing.

## Target contract

1. User enters through `https://os.consuelohq.com`.
2. Pre-auth HTML may use a static sanitized launcher preview; it must not fetch protected workspace data.
3. Google OAuth authenticates the user.
4. Platform membership lookup resolves zero, one, or multiple workspaces.
5. One workspace redirects automatically; multiple workspaces require an explicit chooser.
6. Platform issues a short-lived, single-use, audience-bound handoff code.
7. Browser redirects to `https://<workspace>.consuelohq.com/auth/consume?...`.
8. Workspace edge validates and consumes the code exactly once, establishes a host-scoped secure session, and redirects to the requested protected path.
9. The workspace host never trusts a user-provided hostname without membership validation.

## Security properties

- State, nonce, PKCE, redirect allowlist, audience, expiry, and one-time use are mandatory.
- Avoid `.consuelohq.com` cookies when host-scoped sessions suffice.
- Cookies are Secure, HttpOnly, SameSite-appropriate, and narrowly pathed.
- Login CSRF and open redirects fail closed.
- Workspace enumeration does not leak membership.
- Existing MCP OAuth and connector HMAC behavior remains unchanged.
- No customer requires a Cloudflare account.

## Required tests

Add a route matrix and behavioral tests for:

- public metadata/health/login routes;
- protected launcher, `/gtm`, traces, and MCP routes;
- zero/one/multiple workspace membership;
- inactive/revoked membership;
- safe return-path handling;
- invalid/expired/replayed/wrong-audience handoff;
- cross-workspace handoff rejection;
- cookie scope/flags;
- OAuth state/nonce/PKCE preservation;
- exact bearer challenges and error shapes;
- no protected data in pre-auth preview;
- unchanged device-code and ChatGPT MCP flows.
- same-account repeat installation resolves the existing workspace before any workspace-name prompt and hands node registration to the node contract rather than replacing the workspace route.

Keep existing behavior assertions. Do not rewrite tests to bless an architectural regression.

## Owned files

- New auth contract/test fixtures under OS web/Cloudflare tests.
- Minimal test seams needed for deterministic clocks, membership stores, and handoff stores.
- An approved design note under OS docs if useful.

## Forbidden scope

- Do not implement the full new login/session flow.
- Do not alter live WAF rules.
- Do not broaden cookie scope.
- Do not hard-code `internal` as the product workspace.
- Do not touch provider tools or lifecycle code.

## Completion output

Report the route matrix, session/handoff schema, threat model, failing implementation tests and their owners, unchanged regression suite results, and exact files Worker 14 should implement.
