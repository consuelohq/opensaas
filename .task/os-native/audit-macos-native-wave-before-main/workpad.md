# audit macos native wave before main

branch: `task/os-native/audit-macos-native-wave-before-main`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1667/audit-macos-native-wave-before-main
github pr: https://github.com/consuelohq/opensaas/pull/1667
started: 2026-07-27

## acceptance criteria

- [x] Independently verify Worker 19 against the master plan, Worker 18 architecture, Worker 19 brief, merged diff, reviews, and CI evidence.
- [x] The menu app has a real owner-local lifecycle endpoint in the shipped runtime, not only a mocked client contract.
- [x] The endpoint delegates mutations to the existing lifecycle authority and does not duplicate installer, updater, rollback, repair, restart, diagnostics, node, or uninstall logic.
- [x] Local IPC is framed, bounded, owner-only, fail-closed, and behaviorally tested.
- [x] User-selectable channels are limited to `dev`, `canary`, `beta`, and `stable`; internal `nightly` is not exposed by the menu.
- [x] Swift contracts, menu build, alpha packaging, native/distribution regressions, strict review, and full verify pass.
- [ ] The repair merges to `stream/os-native`; the integrated stream is promoted to `main` only after stream-level CI is green.
- [ ] Local `main` and `stream/os-native` refs are synchronized after promotion.

## plan

1. Audit Worker 19 implementation, review dispositions, CI, and dependency ownership against the plan.
2. Characterize the existing lifecycle authority and service startup path; add failing endpoint and channel-policy contracts before production changes.
3. Implement the smallest owner-local IPC adapter that delegates to existing lifecycle operations, and wire it into the installed service/runtime without a parallel authority.
4. Run focused red/green tests, Swift build/package proof, native/distribution regressions, strict review, and full verify.
5. Publish and merge the repair to `stream/os-native`, then promote the integrated stream to `main` through the normal stream PR and synchronize local refs.

## current status

- Implementation and independent validation are complete; publish verification is the remaining pre-PR gate.
- Worker 19's original Swift client and UI were substantial, but the merged stream lacked the production lifecycle socket peer, exposed internal `nightly`, and tracked the alpha packaging script without execute permission.
- The repair adds a real owner-local framed endpoint to the existing launchd-managed Bun daemon, delegates all mutations to canonical lifecycle/workspace authorities, bounds optional enrichment, returns typed redacted rejections, and starts fail-closed before the HTTP listener.
- Final TypeScript regression: 11 files, 139/139 tests passed.
- Final Swift/package gate: contract executable, debug menu build, production archive, plist validation, strict ad-hoc signature, arm64 Mach-O, binary mode 755, and archive inspection passed.
- Strict repository review: zero owned findings, zero pre-existing findings, zero blockers.
- No real-Mac install, app launch, update, restart, reset, uninstall, signing, or notarization was performed.

## files changed

- `packages/os/scripts/lib/native-lifecycle-endpoint.ts` — production owner-local framed IPC endpoint and canonical lifecycle adapter.
- `packages/os/scripts/server/main.ts` — starts the endpoint fail-closed in the existing macOS daemon.
- `packages/os/scripts/lifecycle.ts` — exports the canonical lifecycle-engine factory for the adapter.
- `packages/os/scripts/lib/native-lifecycle-client.ts` — shared typed rejected-operation response handling.
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift` — typed rejection error and user-selectable channel set.
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift` — surfaces typed rejection detail.
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift` — excludes internal `nightly` from the menu.
- `packages/os/scripts/testing/macos-alpha-package.sh` — tracked executable mode repaired to `100755`.
- `packages/os/tests/native-lifecycle-endpoint.test.ts` — real socket, delegation, permissions, framing, latency, rejection, redaction, and default-engine contracts.
- `packages/os/tests/native-lifecycle-client.test.ts` — typed rejection regression.
- `packages/os/tests/macos-platform.test.ts` — startup wiring/order, channel policy, and packaging executable contract.
- Task metadata and durable workpad under `.task/os-native/audit-macos-native-wave-before-main/`.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 02:42:23 `review.run`: passed — OK
- 2026-07-27 02:43:40 `review.run`: passed — OK
- 2026-07-27 02:48:02 `review.run`: passed — OK
- 2026-07-27 02:50:32 `verify`: passed — OK

## test-first contract

- Behavior under test: the installed local service exposes the versioned framed lifecycle protocol at the owner-only socket and routes every request to existing lifecycle authority functions; the menu exposes only launch-approved channels.
- Existing local pattern: lifecycle behavior remains in `scripts/lib/lifecycle/**`, platform service supervision remains in existing launchd/reload code, and Swift continues to consume the tagged-union contract in `native-lifecycle-client.ts`.
- Planned tests: endpoint request/response and permission/framing contracts; service-startup/runtime-bundle inclusion contract; Swift selectable-channel contract.
- Focused red command: `bun x vitest run tests/native-lifecycle-endpoint.test.ts tests/macos-platform.test.ts` from `packages/os`.
- Expected red failure: the endpoint module and production startup wiring do not exist, and the menu still derives channel choices from `ReleaseChannel.allCases`, including `nightly`.
- Observed red: the endpoint suite could not import `native-lifecycle-endpoint.ts`; both new macOS source assertions failed on the missing daemon wiring and `.allCases` channel menu. Existing packaging/docs assertions remained green.

## key decisions

- Do not promote a client-only native shell whose production IPC peer does not exist.
- Do not implement lifecycle business logic in Swift or in the socket adapter; the adapter must translate typed requests into existing engine operations.

## notes for ko

- The cancelled post-merge `congratulate` job is non-gating and not a product defect.
- No real-Mac app launch, install, update, restart, reset, or uninstall will be performed during this audit.

## improvements noticed

- The Worker 18/21 ownership wording allowed the production endpoint to fall between briefs. Future native-shell briefs should require proof of both client and shipped server peer.
- Packaging tests must assert tracked executable mode, not only script contents.

## issues and recovery

- The Worker 18 ADR assigns the authoritative endpoint to “Worker 21 native lifecycle integration,” but the actual Worker 21 brief is Windows installer/service integration and its completed implementation did not create the macOS endpoint. No later required brief clearly owns this missing runtime surface, so it must be repaired before native-stream promotion.
- Two discovery batches stopped because grep included optional absent paths. No product changes occurred in either stopped batch.
- Direct ESLint found owned function-style/import issues in the new endpoint/tests plus unrelated existing style debt in `lifecycle.ts`. The owned code and touched lifecycle factory were converted to repository-standard arrow functions; one remaining object-method shorthand was then converted after a focused rerun.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-native): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/docs/architecture/native-platform-spike.md`
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Package.swift`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/18-native-platform-spike.md`
- `packages/os/plans/consuelo-os-foundation/workers/19-macos-app-service.md`
- `packages/os/plans/consuelo-os-foundation/workers/21-windows-platform.md`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/config.ts`
- `packages/os/scripts/lib/lifecycle/diagnostics.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/package-macos-alpha.sh`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/config.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/scripts/workspace-nodes.ts`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`
- `packages/os/tests/native-lifecycle-endpoint.test.ts`
- `packages/os/tests/workspace-nodes-cli.test.ts`
- `packages/workspace/senior-engineer.md`

## final validation summary

- TDD red: missing production endpoint/wiring, `nightly` menu exposure, non-executable packaging script, HTTP-before-socket startup, untyped rejection, unbounded enrichment, and unredacted protocol errors were each reproduced before repair.
- Focused endpoint/client/macOS protocol: 24/24 passed after final changes.
- Expanded lifecycle/native/server/distribution regression: 139/139 passed.
- TypeScript syntax/typecheck: passed.
- Owned ESLint and Prettier: passed.
- Swift contract executable: passed after final protocol model changes.
- Debug menu build and unsigned production alpha packaging/archive inspection: passed.
- Strict review: zero findings and zero blockers.
