# Consuelo OS Agent Guidance

## Product Boundary

- Customers install Consuelo OS without creating or connecting a Cloudflare account.
- Consuelo owns connector provisioning, DNS, Tunnel credentials, routing, and Cloudflare policy.
- Keep local node credentials and generated tunnel material private under `~/.consuelo/node/`.
- Do not weaken OAuth, request signing, WAF policy, or connector isolation to make a test pass.

## Runtime Layout

- Product state uses the flattened `~/.consuelo/` home.
- Installed code lives in versioned `runtime/releases/` directories, with `runtime/current` selecting the active release.
- LaunchAgents must never reference `/tmp`, `$TMPDIR`, a downloaded staging checkout, or a task worktree.
- Connector LaunchAgents are generated under `node/security/generated/` and installed into the signed-in user's `~/Library/LaunchAgents`.

## Test Node Triage

The current prelaunch MacBook Air is a disposable test node. An offline node is normal and must be distinguished from a broken route.

Before diagnosing Cloudflare 1033, MCP discovery, or tunnel provisioning:

1. Confirm the Mac is powered on, awake, connected to the internet, and logged into its user session.
2. Confirm Tailscale shows the node online.
3. Confirm the local Consuelo health endpoint responds.
4. Confirm the Consuelo system LaunchAgent and generated cloudflared LaunchAgent are loaded and running.
5. Confirm the assigned opaque connector hostname serves health.
6. Only then investigate central routing, D1 state, WAF policy, OAuth, or MCP proxy behavior.

Do not infer an infrastructure regression from an unreachable test Mac. Preserve redacted installer diagnostics and service logs before cleanup.
