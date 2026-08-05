# Handoff: OS launcher, gateway surfaces, and carried-over work

Branch: `task/os/fix-launcher-links-agents-and-config-surfaces-then-finish-broker-sync-age-and-containers`
PR: #1752 (open). Task session: `tsk_80d1f59d2b7d`.
All work below is one PR, per Ko.

## Ko's intent

Ordered list, as stated:

1. Green L2/L3/L4, redeploy the launcher snapshot (fixes L1)
2. C1/C2/C3 - Tools, Environments, Secrets config surfaces
3. W1 broker wiring - C3 and W1 are the same job
4. W2 consuelo sync, W3 age swap, W4 Apple containers MD
5. Deploy to cloud-1 and verify; env vars best-effort

Standing constraints from Ko:

- Write the tests first, for everything, so nothing gets skipped.
- Tests must fail if the work is not done. They hold the intent.
- Do not cut corners, and do not loosen security, quality, or judgement already
  established in the codebase.
- Work on the cloud node so it can be tested there.

## The items, as defined

| id | item |
| --- | --- |
| L1 | Launcher SITES links must target the workspace host, not sites.consuelohq.com |
| L2 | WRITING > Decision loops links to the published blog post, same for everyone |
| L3 | "Connected to N local agents" must not flash and disappear |
| L4 | CONTACT / LOCATION / STATUS / OPEN POSITION values align under their labels |
| R1 | internal.consuelohq.com/tracing must show traces, not "gateway unavailable" |
| C1 | Tools page must load configuration |
| C2 | Environments page must load |
| C3 | Secrets page must be backed by the credential broker |
| W1 | Broker wiring: production callers of withCredential |
| W2 | consuelo sync plus automatic steering sync |
| W3 | age swap for the hand-composed envelope |
| W4 | Apple containers MD |
| D1 | Deploy to cloud-1 and verify |
| D2 | Environment variables end to end, best effort |

## Completed

### L2, L3, L4 - commit 8c17a56cba
`packages/os/scripts/lib/launcher-onboarding.ts`

- L2: Decision loops now points to
  https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/#the-future-interface-is-what-should-we-do-next
- L3: two changes. The client probes agent status only on the host the launcher was built
  for (`launcherWorkspaceHost`), instead of any `*.consuelohq.com`; and the `.catch` no
  longer calls `listElement.replaceChildren()`, which was erasing the rendered list.
- L4: `.meta-value { margin: 0; }` resets the browser default `dd` inline-start margin.

Tests: `packages/os/tests/launcher-workspace-surface.test.ts` (new).
64 tests pass across launcher-workspace-surface, launcher-onboarding, launcher-astro-source,
local-agent-connectivity, sites-cli, install-state.

Not done, deliberately: server-rendering agent names into the launcher HTML. An existing
test forbids it (`expect(html).not.toContain('<li>Codex</li>')`) because that document is
cacheable and served on the workspace host.

### Gateway auth - commit 8873116768

`auth: 'required'` appears only in the type union in
`packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`. No branch handles it, so a
route marked `required` never checks a browser session and falls through to a branch that
demands an internal HMAC signature. Browsers cannot produce one, so every dashboard fetch
to `/gateway/*` returned 503 WORKSPACE_EDGE_AUTH_REQUIRED.

Changes:
- Ten `consuelo-gateway-service` routes seeded as `workspace-session` in
  `workspace-edge-route-seed.ts`. `/mcp` left on `required` (agent-facing, bearer auth).
- Router dispatches gateway-service targets when auth is `workspace-session`, after
  `authorizeWorkspaceSession` has passed. Mirrors the `site-snapshot` branch above it.
- Unauthenticated still fails closed. Internally signed service calls unchanged.
- 10 assertions in `workspace-edge-route-seed-contract.test.ts` updated from `required`
  to `workspace-session`.

Tests: 61/61 pass, but only with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`. Without
that env var these 61 tests are skipped under both vitest and bun.

### C3 Secrets surface - commit 7110e56f48

- New `packages/os/scripts/lib/consuelo-sites-secrets-adapter.ts` registering
  `secrets-sites-read-endpoints` (capability `secrets-read`, families `/gateway/secrets/*`
  and `/secrets/*`).
- `secrets-sites-read-endpoints` added to the serviceName unions in
  `workspace-cloudflare-d1-route-registry.ts` and `workspace-cloudflare-edge-router.ts`.
- `/gateway/secrets` seeded as `workspace-session`.
- `settings-site.ts`: the "Secret connections are not available yet" placeholder is
  replaced by `renderSecretsContent()` plus `secretsClientScript()`, which fetches
  `/gateway/secrets/bindings` and renders Binding / Node / Status / Updated.
  No value column and no reveal control.

`listSealedCredentials` in `node-sealed-credential-store.ts` already returns metadata-only
descriptors and is the intended source for that endpoint.

Tests: `packages/os/tests/secrets-surface.test.ts` (new). 12 pass with the gateway suite.

## Remaining

### Blocker for C1, C2, R1 and the Secrets data: gateway dispatch is not implemented

`createConsueloGatewayServiceResponse` (`workspace-cloudflare-edge-router.ts`, ~line 608)
answers every `/gateway/*` request with a service descriptor:

    { ok, publicBoundary, workspace, route: { serviceName, gatewayRouteFamily, ... } }

`fetchUpstream` is referenced once in that file, at the os-connector branch (~line 1021).
The gateway branch never proxies to the node. `/gateway/traces/recent`,
`/gateway/configuration`, `/gateway/environments` and `/gateway/secrets/bindings` all
return the descriptor, so the pages cannot parse a payload and show "unavailable".

The auth fix removes the 503. It does not produce data. C1, C2, R1 and the Secrets table
stay unavailable until dispatch exists.

To finish: proxy `/gateway/<family>/*` to the workspace node connector origin under an
internal signature, mirroring the os-connector branch, including SSE for
`/gateway/traces/events`; and implement the node-side handlers per service
(traces, configuration, environments, secrets -> `listSealedCredentials`).

### L1 launcher snapshot: needs release and republish

The repo already emits workspace-host links; six tests in
`launcher-workspace-surface.test.ts` assert it and pass unmodified. What is deployed at
`internal.consuelohq.com` is an older snapshot with `sites.consuelohq.com` baked in and
old paths (`/office`, `/tracing` in place of `/artifacts`, `/observability`).

Publish path, from `packages/os/scripts/lib/install-edge-site-publisher.ts`:

1. Release OS so the node carries the new launcher code.
2. Update the node; `buildSitesIndex` regenerates `$CONSUELO_HOME/sites/`.
3. Run the publisher: `versionId` = sha256 of the launcher HTML, uploads to R2 bucket
   `consuelo-sites-snapshots`, upserts the D1 route registry
   (`consuelo-workspace-route-registry`).

Current deployed version id: `sha256-2094f19b293208ae`.
Note: `snapshotSites` in the publisher has no `/tracing` entry, though the live registry
has a `/tracing` route.

### W1 broker wiring

`withCredential` / `withCredentialEnvironment` in
`packages/os/scripts/lib/credential-broker.ts` still have zero callers outside the library
and its tests. Verified by grep across `packages/os`.

### W2, W3, W4

- W2 `consuelo sync` plus automatic steering sync: not started. No sync path exists in
  `packages/os/scripts`.
- W3 age swap: not started. No `age` usage in the tree; the envelope is still the
  hand-composed X25519 + HKDF + AES-GCM in `node-credential-sealing.ts`.
- W4 Apple containers MD: not started. No file exists.

### D1, D2 deploy and verify

Not started for this PR. Nothing in this branch is released or deployed.

## Current environment state

- Stable channel: 0.1.20, bundle `sha256:341d267f468de75da96bbfd3b3a4a95f54b032913901e0bc1be3ebeb11ccdf61`,
  from commit `7c6a27ad31`. Published and promoted dev -> canary -> beta -> stable.
- cloud-1 (`consuelo-ko-cloud-1`, us-east1-b): enrolled, running 0.1.20, presence online,
  reachable at `https://c-900ef5576e792a90d4dc893fb9fd413b.consuelohq.com/health` (200).
  Caddy 2.11.4 installed by hand; the provisioning script used for it is not in the repo.
- Hand-added files moved out of the runtime path to
  `/var/tmp/consuelo-removed-patches/` on cloud-1.
- cloud-2 and its data disk: deleted. Its registry entry is `state: revoked`.
- `defaultNodeId` for workspace_internal is `node_F3Wsfd-vJrKkYlfi` (the Mac), not cloud-1.

## Repo notes relevant to the remaining work

- Many `packages/os` tests import `bun:sqlite` and fail under vitest but pass under
  `bun test`. Repo-wide vitest baseline: 13 failed files / 62 failed tests, unchanged by
  this branch.
- `auth: 'required'` in the edge router means "internal signature only", not "login
  required". Renaming it would remove a real footgun.
- The OS facade rejects `rm` through `mac.call`, and its secret scanner false-positives on
  long hyphenated repo paths (`"branch":"[REDACTED_SECRET]"`), which silently rejects
  some calls.

## Status summary

| id | status |
| --- | --- |
| L1 | code correct and tested; deployed snapshot is stale. Needs release + republish |
| L2 | done |
| L3 | done |
| L4 | done |
| R1 | auth fixed; blocked on gateway dispatch |
| C1 | auth fixed; blocked on gateway dispatch |
| C2 | auth fixed; blocked on gateway dispatch |
| C3 | route, service and page done; data blocked on gateway dispatch |
| W1 | not started |
| W2 | not started |
| W3 | not started |
| W4 | not started |
| D1 | not started |
| D2 | not started |

## Commits on this branch

- `de62c54cde` test: red suite for launcher links, agent list, meta alignment
- `8c17a56cba` fix: launcher agents, blog link, meta alignment (L2, L3, L4)
- `8873116768` fix: workspace session reaches dashboard gateway routes
- `7110e56f48` feat: Secrets surface read-only broker route (C3)

## How to run the tests

    cd packages/os
    npx vitest run tests/launcher-workspace-surface.test.ts tests/launcher-onboarding.test.ts \
      tests/secrets-surface.test.ts tests/workspace-session-gateway-access.test.ts
    CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test \
      tests/workspace-edge-sites-gateway-integration.test.ts \
      tests/workspace-edge-route-seed-contract.test.ts \
      tests/cloudflare-edge-router.test.ts tests/workspace-hostname-edge-router.test.ts \
      tests/cloudflare-d1-route-registry.test.ts
