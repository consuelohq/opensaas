# fix launcher links agents and config surfaces then finish broker sync age and containers

branch: `task/os/fix-launcher-links-agents-and-config-surfaces-then-finish-broker-sync-age-and-containers`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1752/fix-launcher-links-agents-and-config-surfaces-then-finish-broker-sync-age-and-containers
github pr: https://github.com/consuelohq/opensaas/pull/1752
started: 2026-08-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## scope: every item ko asked for

### launcher page
- L1 SITES links must target the workspace host (internal.consuelohq.com/artifacts, /observability,
  /diffs, /gtm), not sites.consuelohq.com
- L2 WRITING > Decision loops must link to the public blog post, identical for every workspace
- L3 "Connected to N local agents" must stay rendered; today 5 agents flash then vanish
- L4 CONTACT / LOCATION / STATUS / OPEN POSITION values must sit left-aligned under their labels

### routing
- R1 the workspace host /tracing must serve the traces surface, not bounce to a shared host

### configuration surfaces
- C1 Tools shows "Configuration unavailable" against an online home node
- C2 Environments same surface, same failure
- C3 Secrets says "not available yet" and must be backed by the credential broker

### carried over, previously not started
- W1 broker wiring: production callers of withCredential (today: zero outside lib and tests)
- W2 consuelo sync plus automatic steering sync
- W3 age swap for the hand-composed envelope
- W4 Apple containers MD

### deploy and verify
- D1 ship to the cloud node and verify there
- D2 environment variables end to end, best effort only per ko

## blocking discovery: the gateway data plane is a stub

createConsueloGatewayServiceResponse (edge router ~608) answers every /gateway/* request with a
service DESCRIPTOR, not data:

  { ok, publicBoundary, workspace, route: { serviceName, gatewayRouteFamily, ... } }

fetchUpstream is referenced once, at the os-connector branch. The gateway branch never proxies to
the node. So /gateway/traces/recent, /gateway/configuration and /gateway/environments all return a
descriptor; the dashboards cannot parse it and fall back to "unavailable".

The auth fix was necessary but is NOT sufficient. Fixing C1, C2, R1 and C3 for real requires
implementing gateway dispatch: proxy the gateway path to the workspace node connector origin under
an internal signature, mirroring the os-connector branch, including SSE for /gateway/traces/events.
