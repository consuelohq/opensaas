# Worker 04: Unified Install, Update, Repair, and Status Engine

## Dependencies

Begin after Workers 01 and 02 are integrated. Consume their test harness and runtime-bundle contract. Do not invent parallel formats.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md`, repository steering, and both OS engineering/task skills. Start from `stream/os-distribution`. You are not alone in the repo.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Extract one typed lifecycle engine that powers the terminal installer now and the Swift/native applications later.

## Required architecture

Use Effect for lifecycle services, typed failures, resource safety, cancellation, retries, and test injection where it matches existing OS patterns.

Separate:

- channel/runtime-bundle fetch and verification;
- install-state inspection;
- update lock;
- staging;
- migrations;
- service stop/start/reload;
- atomic activation;
- health acceptance;
- diagnostics;
- lifecycle presentation.

The public curl bootstrap shell may remain a tiny download/verification entry, but orchestration belongs in Bun/TypeScript and must not be duplicated between install and update.

## Commands

Implement the shared engine behind:

```text
consuelo status
consuelo install [--channel]
consuelo restart
consuelo update [--channel] [--check] [--yes]
consuelo channel [show|set]
consuelo updates notifications [on|off|snooze]
consuelo repair
```

Support structured JSON and quiet modes where appropriate.

## Behavioral requirements

- Detect no install, legacy install, valid install, partial install, and corrupt install.
- Existing valid installs must not repeat OAuth, workspace creation, skill selection, or agent selection.
- Preserve node identity, workspace membership, secrets, tunnel credentials, and user content.
- Verify signed channel/runtime-bundle manifests before executing downloaded code.
- Download and verify in a temporary location.
- Treat `~/.consuelo/` as the product root, activate releases only beneath `~/.consuelo/runtime/releases/<bundle-id>/`, and switch `runtime/current` atomically. Never materialize a new install at the legacy `~/.consuelo/os/` path.
- Acquire a lock with clear stale-lock recovery.
- Run platform preflight before activation.
- Activate atomically.
- Emit redacted structured events suitable for CLI, app, tests, and diagnostics.
- Expose stable typed progress events; do not make the future Swift app parse terminal text.
- Keep the existing interactive onboarding UX for a first install.
- Persist channel and update-notification preferences in the typed `~/.consuelo/consuelo.yaml` OS configuration boundary; do not put runtime state or secrets in YAML.
- Implement `restart` by adopting the proven behavior in `packages/os/scripts/consuelo-reload.js` and `packages/os/scripts/workspace-watchdog.sh`: reply-safe asynchronous reload, launchd/direct modes, conflicting-label cleanup, TERM-to-KILL escalation, bounded health acceptance, and rate-limited watchdog recovery.
- Characterize `packages/os/scripts/server.js` before changes, route service restart through the one lifecycle adapter, then retire its duplicated restart orchestration after parity is proven. Do not create another restart implementation.
- `restart` touches only Consuelo-owned services and never reinstalls or repeats onboarding.
- Update and repair never repeat Google OAuth, workspace creation, skill selection, or agent onboarding when valid state exists.

Rollback mechanics are owned by Worker 05, but this engine must expose the activation/health hooks Worker 05 needs.

## Owned files

- New lifecycle modules under `packages/os/scripts/lib/lifecycle/`.
- Lifecycle CLI entrypoint/adapters.
- Minimal bootstrap/install integration required to call the engine.
- Lifecycle-focused tests using Worker 01's harness.

## Forbidden scope

- Do not implement native UI.
- Do not change OAuth/security semantics.
- Do not implement component merge policy beyond calling its future interface.
- Do not add deprecated command aliases or path shims. Migrate the supported install state through the typed lifecycle engine and remove superseded restart orchestration in the same release after tests pass.
- Do not log secrets or full environment values.

## Required tests

- Clean install state machine.
- Existing install update bypasses onboarding.
- Concurrent update lock.
- Stale lock recovery.
- Manifest/signature/digest failure.
- Staging failure leaves current untouched.
- Typed progress order.
- JSON output stability.
- Restart success/failure and proof that onboarding is not invoked.
- Characterization and parity coverage for existing reload/watchdog behavior, including reply-safe detachment, launchd/direct execution, conflicting labels, kill escalation, health timeout, and watchdog restart-gap limiting.
- Existing lifecycle, install-state, local-port-cutover, Bun product-server, and Hono architecture tests remain green; change an assertion only for an explicit approved behavior change.
- Channel and notification preference persistence, including snooze expiry.
- Repair distinguishes regenerable state from user-owned state.

## Completion output

Report the service interfaces, state machine, CLI contract, old-to-new call flow, exact tests, and explicit hooks left for retention/rollback and managed updates.
