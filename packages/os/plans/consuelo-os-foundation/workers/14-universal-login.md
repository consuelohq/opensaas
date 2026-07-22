# Worker 14: Universal Login, Membership Resolution, and Workspace Session Handoff

## Dependencies

Begin after Worker 13's contract tests and Worker 25's node/session contract are integrated into `stream/os-web`.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full, then read Worker 13's design evidence, repository steering, and both OS skills. Start from the updated web stream. You are not alone in the codebase.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Implement `os.consuelohq.com` as the universal browser login and workspace resolver with a single-use handoff to the authenticated workspace host.

## Required implementation

- Reuse existing Hono application composition and existing Google OAuth/grant/membership services.
- Add typed workspace-resolution behavior for zero, one, and multiple memberships.
- Add a durable or appropriately scoped handoff store with atomic one-time consumption.
- Bind handoff to user, workspace, audience host, return path, issued time, expiry, and nonce.
- Validate the destination against the server-resolved workspace route, not browser input.
- Establish a host-scoped workspace session at the workspace edge.
- Preserve existing device authorization and MCP OAuth behavior.
- For a verified account with an existing launch workspace, resolve that workspace before prompting for a name and register the computer as a distinct node through Worker 25's contract.
- Never replace the home/default node merely because a later install completed.
- Keep error responses deterministic and redacted.
- Add static/sanitized pre-auth presentation support without exposing protected launcher data.

## Membership behavior

- Zero memberships: account-safe onboarding/no-workspace state.
- One membership: automatic workspace selection.
- Multiple memberships: explicit workspace chooser; never infer from arbitrary URL parameters.
- Revoked/inactive membership: deny and do not issue handoff.
- Existing workspace on a second computer: join as a member node without workspace creation or renaming.

## Session behavior

- Single-use handoff.
- Short expiry.
- Host-bound audience.
- Secure, HttpOnly, host-scoped session cookie.
- Explicit logout and session expiry.
- Preserve only validated relative return paths.

## Owned files

- Device-authority Hono auth routes/services/stores required by the contract.
- Workspace-edge handoff consumption and session middleware.
- Schema/migration changes for handoff state if required.
- Contract and implementation tests.

## Forbidden scope

- Do not alter MCP tool schemas or connector transport.
- Do not require a Cloudflare account from users.
- Do not use CSS blur as authorization.
- Do not establish a broad parent-domain cookie.
- Do not hard-code Ko's account or workspace.

## Required tests

Make every Worker 13 implementation test pass, plus concurrency/replay tests proving only one handoff consumer succeeds and same-account second-node tests proving the existing workspace/default route is preserved. Run the complete existing device-authority and workspace-edge suites.

## Live validation

Prepare a non-destructive production-like smoke plan with test memberships. Ko performs any real browser login or machine install; do not mutate production routes or accounts without explicit approval.

## Completion output

Report exact route changes, storage schema, cookie properties, replay proof, regression results, and deployment/migration steps for the web integration worker.
