# Consuelo Sites Gateway Contract Service

## Acceptance Criteria

- Add a generic Consuelo Sites Gateway contract/service as the public boundary for all Sites.
- Keep Trace as the first registered adapter under the generic gateway.
- Preserve Trace-specific read/live layer as backend services, not the gateway itself.
- Use public Site routes like `/traces/*` for user-visible route family while routing internally to gateway service descriptors.
- Do not expose local DB, local agent, cloud runner, trace file, or raw internal targets to Sites callers.
- Preserve local-networked, cloud-compute, and local-off-network source-mode semantics generically.
- Return bridge-required/degraded state for local off-network without a bridge.
- Allow future Sites to register capabilities without changing Trace-specific code.
- No UI, GSAP, motion, commercial-tier language, or direct backend imports.

## Test-First Contract

- Behavior under test: generic all-Sites gateway identity, workspace/session resolution, entitlement, service registry/discovery, generic source-mode semantics, route result shape, and Trace-as-first-adapter registration.
- Existing pattern: pure TS modules under `packages/os/scripts/lib/*` with Vitest/Bun tests under `packages/os/tests/*`.
- Existing sources read: PR1 Trace contract, Trace read-layer, Trace live endpoints, Trace tests, AGENTS.md, CODING-STANDARDS.md.
- Added tests before implementation:
  - `packages/os/tests/consuelo-sites-gateway.test.ts`
  - `packages/os/tests/consuelo-sites-gateway-registry.test.ts`

## Red Evidence

- Command: `cd packages/os && bun test tests/consuelo-sites-gateway.test.ts tests/consuelo-sites-gateway-registry.test.ts` via task.call/package test wrapper.
- Result: expected red failure, both test files failed before implementation.
- Failure signal: missing modules `../scripts/lib/consuelo-sites-gateway` and `../scripts/lib/consuelo-sites-gateway-registry`.
- Trace: `trc_d519b6cedce6`.

## Green Evidence

- Focused command: `bun --cwd packages/os test tests/consuelo-sites-gateway.test.ts tests/consuelo-sites-gateway-registry.test.ts`.
- Result: 2 files passed, 15 tests passed, 0 failed.
- Trace: `trc_d1bc12b56f3b`.

## Validation

- `cd packages/os && bun test tests/consuelo-sites-gateway.test.ts`: 10 pass, 0 fail. Trace: `trc_cb5efe7c5fcb`.
- `cd packages/os && bun test tests/consuelo-sites-gateway-registry.test.ts`: 5 pass, 0 fail. Trace: `trc_9dc8bf6d904b`.
- `cd packages/os && bun test tests/trace-sites-gateway-contract.test.ts`: 20 pass, 0 fail. Trace: `trc_3882bdfc102f`.
- `cd packages/os && bun test tests/trace-sites-gateway-read-layer.test.ts`: 10 pass, 0 fail. Trace: `trc_194609d6c1ad`.
- `cd packages/os && bun test tests/trace-sites-gateway-live-endpoints.test.ts`: 6 pass, 0 fail. Trace: `trc_7b75f66b0f4d`.
- `cd packages/os && bun run typecheck`: passed, `workspace script syntax checks passed`. Trace: `trc_89f914db18ac`.

## Files Changed

- `packages/os/scripts/lib/consuelo-sites-gateway-registry.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway.ts`
- `packages/os/tests/consuelo-sites-gateway-registry.test.ts`
- `packages/os/tests/consuelo-sites-gateway.test.ts`

## Scope Review

- No UI files changed.
- No motion/GSAP work.
- No commercial-tier language.
- Generic gateway does not import local DB adapters directly.
- Trace read/live surfaces are registered as gateway service descriptors under the generic gateway, not as the gateway itself.

- 2026-06-13 16:27:25 write: `.task/sites/consuelo-sites-gateway-contract-service/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/consuelo-sites-gateway-registry.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway.ts`
- `packages/os/tests/consuelo-sites-gateway-registry.test.ts`
- `packages/os/tests/consuelo-sites-gateway.test.ts`

## workspace-owned: activity log

- 2026-06-13 16:27:25 fs.write: `.task/sites/consuelo-sites-gateway-contract-service/workpad.md`
