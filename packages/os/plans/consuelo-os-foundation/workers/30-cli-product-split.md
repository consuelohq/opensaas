# Worker 30: Consuelo OS And Consuelo Dialer CLI Product Split

## Mandatory context

Bootstrap with `os.get_steering()`, then read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md`, this brief, Worker 04's lifecycle contract, and Worker 28's product-boundary findings. Use `os.call` with a task session from `stream/os-distribution`.

## Mission

Make `consuelo` the focused OS lifecycle CLI and preserve the existing GTM/sales CLI as `consuelo-dialer`, without deleting dialer capability or coupling OS installation to Twenty, Twilio, coaching, or GTM dependencies.

## Current behavior to verify

- `packages/cli` publishes `@consuelo/cli` with a `consuelo` binary.
- Its root command describes an AI-powered sales toolkit.
- It registers contacts, calls, queue, knowledge base, files, history, deploy, development, migration, analytics, coaching, Twenty SDK, and OS command groups.
- Its package dependencies include analytics, coaching, contacts, dialer, logger, and Twenty SDK.
- OS already has its own scripts/runtime entrypoints and the lifecycle engine from Worker 04.

## Target boundary

```text
consuelo
  install
  status
  restart
  update
  channel
  repair
  rollback
  node
  uninstall
  dev reset

consuelo-dialer
  existing sales, contacts, calls, queue, coaching, analytics,
  GTM deploy, and Twenty-backed commands
```

Use package names such as `@consuelo/os-cli` and `@consuelo/dialer-cli` only after verifying the registry and repository naming plan. Binary names are the product contract.

## Required implementation

1. Build the OS binary as a thin adapter to the shared lifecycle engine.
2. Move/preserve sales and GTM command registration under the dialer binary.
3. Separate config namespaces so OS node/workspace/channel state cannot collide with dialer credentials/config.
4. Preserve machine-readable `--json` and quiet/error behavior.
5. Add `consuelo restart` as a thin adapter to Worker 04's consolidated implementation based on the existing `consuelo-reload.js` and watchdog behavior. Do not reimplement restart in the CLI.
6. Keep the existing public curl installer unchanged.
7. Remove the old `consuelo os ...` registration after all repository consumers and tests use the final binary. Do not add a compatibility message or shim; this is a pre-launch clean cutover.
8. Do not publish or globally install either package from a worker task without approval.

The OS CLI uses the approved `~/.consuelo/consuelo.yaml` human-config boundary plus typed node/runtime stores. Preserve and migrate the current dialer CLI config through its existing loader into a clearly dialer-owned namespace; do not make the OS loader reinterpret sales credentials or silently discard existing config.

## Tests

- OS CLI dependency graph excludes dialer/Twenty/Twilio/coaching runtime packages.
- Dialer commands remain available under `consuelo-dialer` with unchanged behavior.
- OS lifecycle commands invoke the Worker 04 engine and structured output.
- Config and error/telemetry boundaries remain separate and redacted.
- `consuelo restart` handles healthy, stopped, failed, and timeout states.
- Old `consuelo os ...` registration has no remaining runtime, test, docs, or generated references before deletion.
- Runtime-bundle allowlist includes the OS CLI and excludes the dialer CLI.

## Acceptance gates

- `consuelo` is unambiguously OS.
- `consuelo-dialer` preserves existing GTM/sales capability.
- OS install/update does not pull the dialer dependency graph.
- No product CLI is deleted.
- Worker 24 can exercise install, status, restart, update, rollback, and uninstall through the final OS binary.

## Review and completion

Request CodeRabbit and run Grok 4.5 with dependency-graph evidence, diff, and tests. Record cutover decisions, package/binary names, review dispositions, and any publish checkpoint requiring Ko.
