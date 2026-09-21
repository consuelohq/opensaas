# mac menu update badge and nodes ui

branch: `task/os/mac-menu-update-badge-and-nodes-ui`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1915/mac-menu-update-badge-and-nodes-ui
github pr: https://github.com/consuelohq/opensaas/pull/1915
started: 2026-08-13

## acceptance criteria

- [x] Show a compact update badge and target version in the Mac menu without a second updater/feed.
- [x] Keep Updating visible across the accepted lifecycle update restart, then resolve from canonical lifecycle status.
- [x] Render Nodes from `WorkspaceSnapshot.nodes` with friendly Default, Current, and presence state; hide connector/key/capability/provider internals.
- [x] Match Launcher default-node semantics: only active + online + non-default nodes can be made default via `workspace.default-node.set`.
- [x] Keep alpha Mac distribution separate from public OS install; add opt-in user-local `~/Applications` install/launch only.
- [x] Pass Swift contracts, macOS platform tests, release build/package smoke, strict review, and full verify.

## plan

1. Reuse the lifecycle socket/client and WorkspaceSnapshot; add presentation continuity only.
2. Put update/node presentation rules in `ConsueloMacCore`; keep SwiftUI thin.
3. Update the menu badge/update row/Nodes UI.
4. Add `--install`/`--launch` to the alpha packager with a user-local destination and update macOS docs.
5. Validate and promote through the normal task workflow.

## Test-first contract

- Behavior: update progress survives daemon restart; node labels/actions match Launcher; alpha install is user-local and opt-in.
- Existing pattern: `ConsueloMacContractTests/main.swift` owns core behavior; `macos-platform.test.ts` protects app/package boundaries.
- Tests first: add Swift assertions for pending update presentation and friendly node selectability; add Vitest assertions for the badge and alpha install flags.
- RED commands: `swift run --package-path packages/os/native/macos ConsueloMacContractTests` and `bun x vitest run packages/os/tests/macos-platform.test.ts`.
- Expected RED: the new pending-update/node presentation APIs and packaging flags do not exist yet.

## current status

- Implementation and publish gates are green; ready to push and promote into `stream/os`.

## validation evidence

- RED: Swift contracts failed on the missing pending-update/badge/node presentation APIs; `macos-platform.test.ts` failed on the missing UI/install markers.
- GREEN: `ConsueloMacContractTests` passed from an isolated Swift scratch path.
- GREEN: `packages/os/tests/macos-platform.test.ts` passed 4/4 after implementation and again after the final alpha-script parser cleanup.
- GREEN: release build of `ConsueloMenuBarApp` passed from an isolated Swift scratch path.
- GREEN: `bash -n packages/os/scripts/testing/macos-alpha-package.sh` passed after the final parser cleanup.
- GREEN: alpha packaging installed the ad-hoc-signed app under a temporary HOME at `/tmp/consuelo-mac-alpha-home-1915/Applications/Consuelo.app`; archive produced; app deliberately not launched.
- GREEN: test-selection contract passes 23/23, explicit rule IDs are unique, and native Mac changes avoid the broad OS package suite.
- GREEN: strict review reports 0 issues and 0 blockers.
- GREEN: full verify passes with `publishValid: true`, DB guard clean, and all 10 selected suites passing.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/tests/macos-platform.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`
- task metadata/workpad

## workspace-owned: files changed

- `packages/os/native/macos/.build` (deleted)

## workspace-owned: activity log

- 2026-08-13 20:17:04 fs.trash: `packages/os/native/macos/.build`

## workspace-owned: validation evidence

- 2026-08-13 20:18:41 `audit`: failed — COMMAND_FAILED
- 2026-08-13 20:21:18 `review.run`: passed — OK
- 2026-08-13 20:22:26 `verify`: failed — COMMAND_FAILED
- 2026-08-13 20:28:35 `review.run`: passed — OK
- 2026-08-13 20:29:19 `verify`: passed — OK

## key decisions

- Reuse the universal lifecycle endpoint as the only updater; the menu app stores only temporary presentation state for an accepted update operation.
- Reuse `WorkspaceSnapshot.nodes` and `workspace.default-node.set`; no Mac-specific node registry, routing logic, or fetch API.
- Match Launcher actionability: active + online + non-default only, with infrastructure metadata omitted from normal menu presentation.
- Keep alpha installation separate from public OS installation until Developer ID signing/notarization is available; the alpha installer is user-local only.

## notes for ko

- Alpha app command: bash packages/os/scripts/testing/macos-alpha-package.sh --install --launch
- Public OS install remains separate.
- No live install, node update, or production deployment was performed.

## improvements noticed

- Apple distribution can later replace the alpha packaging checkpoint without changing lifecycle or Nodes contracts.

## issues and recovery

- Initial Swift RED created local .build output; later runs use external scratch paths and no build output remains in git status.
- Workspace audit remains red from pre-existing repository-wide script/doc/index drift outside this task.
- Initial full verify selected the broad OS package suite and produced unrelated facade snapshot drift. That drift was reverted; a focused exclusive Mac selector was added, a duplicate lifecycle selector was removed, the registry regenerated, and full verify then passed without the broad suite.
- Transient MCP network errors recovered on bounded retries.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-13 20:30:54 apply-patch: `.task/os/mac-menu-update-badge-and-nodes-ui/workpad.md`

- 2026-08-13 20:31:01 apply-patch: `.task/os/mac-menu-update-badge-and-nodes-ui/workpad.md`