# fix service host linux swift contract before stable

branch: `task/os/fix-service-host-linux-swift-contract-before-stable`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2578
started: 2026-09-24

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the Swift package must keep `ConsueloServiceHost` source portable enough for the Ubuntu `swift run ConsueloMacContractTests` verification path while preserving Darwin behavior on macOS.
existing local pattern: `packages/os/tests/macos-platform.test.ts` source-contract tests protect the native macOS package and service-host declarations; the release registry separately runs the Swift contract on Ubuntu.
new or changed tests: add a source contract asserting the service host does not unconditionally import/call Darwin and includes a Glibc fallback for non-Darwin Swift builds.
focused red command: `cd packages/os && bun test tests/macos-platform.test.ts`
expected red failure: current `ConsueloServiceHost/main.swift` begins with unconditional `import Darwin` and exits via `Darwin.exit`, so the new portability assertion fails before production code changes.
no-test waiver: none.

- 2026-09-24 16:51:45 append: `.task/os/fix-service-host-linux-swift-contract-before-stable/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-24 16:51:45 fs.write: `.task/os/fix-service-host-linux-swift-contract-before-stable/workpad.md`
- 2026-09-24 16:55:14 fs.write: `.task/os/fix-service-host-linux-swift-contract-before-stable/workpad.md`

## workspace-owned: files read

- `packages/os/tests/macos-platform.test.ts`

- 2026-09-24 16:52:02 apply-patch: `packages/os/tests/macos-platform.test.ts`
- 2026-09-24 16:52:43 apply-patch: `packages/os/native/macos/Sources/ConsueloServiceHost/main.swift`
- 2026-09-24 16:52:43 apply-patch: `packages/os/tests/macos-platform.test.ts`

## workspace-owned: validation evidence

- 2026-09-24 16:53:59 `review.run`: passed — OK
- 2026-09-24 16:55:25 `verify`: passed — OK

## Validation evidence

- Red: `bun test tests/macos-platform.test.ts` failed because `ConsueloServiceHost` unconditionally imported Darwin.
- Fixed with conditional Darwin/Glibc imports and unqualified `exit`, preserving identical macOS behavior while allowing Linux Swift compilation.
- Green: `cd packages/os && bun test tests/macos-platform.test.ts` => 6 passed, 0 failed, 75 assertions.
- Green: exact Swift contract command => `ConsueloMac contract tests passed`.
- Green: `swift build --product ConsueloServiceHost` completed successfully on macOS.
- Strict review => 0 blocking issues.

- 2026-09-24 16:55:14 append: `.task/os/fix-service-host-linux-swift-contract-before-stable/workpad.md`
