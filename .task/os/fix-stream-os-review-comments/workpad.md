# fix stream os review comments

## Objective

Resolve the remaining CodeRabbit/Codex review findings on stream PR #1020, including related workspace tooling comments, not just the OS-specific changes.

## Test-first contract

Behavior under test:

- Release scripts reject contradictory flags, stream child output, handle spawn errors, and bound external HTTP verification calls.
- Task node_modules linking never follows package symlinks outside the repo and never links outside a task worktree.
- Apply-patch conflict detection canonicalizes equivalent paths and commits writes before destructive deletes.
- OS installer edge publish handles unavailable approved device bootstrap as an explicit skipped/planned state, while structured edge publish failures retain diagnostics.
- Workspace edge platform-safety error paths preserve request context for browser/JSON negotiation.
- Google OS device approval bridge fetch has a bounded timeout.
- Generated/docs/test naming review issues are fixed without hand-editing generated surfaces where a source generator owns them.

Existing patterns to follow:

- Existing workspace facade tests under `packages/workspace/tests`.
- Existing OS gateway contract env flags under `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.
- Existing install edge publisher contract tests under `packages/os/tests`.

Focused red commands:

- `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts packages/workspace/tests/task-node-modules.test.js`
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-hostname-edge-router.test.ts tests/workspace-edge-beta-smoke-contract.test.ts`
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-edge-site-publisher.test.ts tests/install-workspace-bootstrap-contract.test.ts`

Expected red failure before implementation:

- Some review assertions are missing because the comments were raised against current stream state; existing focused tests may pass before new regression assertions are added. Add or extend tests where behavior is missing.

## Review comments being addressed

- workspace release docs: document `os:release-device-auth -- --no-verify`.
- task-node-modules: constrain symlink traversal and verify package symlink targets.
- os release scripts: reject contradictory flags, stream output, handle spawn errors, add HTTP timeout.
- workspace server/facade branch policy: align taskSession plus branch handling and missing metadata error behavior.
- installer edge publish: avoid fallback dead-end; bound external calls; wrap verify network failures.
- workflow bundle manifest: replace machine-local sourceManifest path.
- fs apply-patch: canonical path conflict keys and write-before-delete commit order.
- test names: align with `should ... when ...` convention.
- docs signature: escape generated table pipe in TOOLS output through generator/source.
- workspace edge: pass request context in site snapshot catch path.
- twenty-server auth service: timeout OS approval fetch.

## Validation evidence

TBD.

- 2026-06-14 13:27:51 write: `.task/os/fix-stream-os-review-comments/workpad.md`

## files changed

- `packages/workspace/scripts/lib/task-node-modules.js`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/task-node-modules.js`

## workspace-owned: activity log

- 2026-06-14 13:27:51 fs.write: `.task/os/fix-stream-os-review-comments/workpad.md`
- 2026-06-14 13:39:23 fs.patch: `packages/workspace/scripts/lib/task-node-modules.js`
- 2026-06-14 13:39:54 fs.patch: `packages/workspace/scripts/lib/task-node-modules.js`

## workspace-owned: files read

- `packages/os/manifests/workflow-bundles.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-apply-patch.test.ts`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: validation evidence

TBD.
- 2026-06-14 13:27:51 write: `.task/os/fix-stream-os-review-comments/workpad.md`
- 2026-06-14 13:33:25 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-14 13:37:21 `checkFiles`: passed — OK
- 2026-06-14 13:39:23 patch lines 88-89: `packages/workspace/scripts/lib/task-node-modules.js`
- 2026-06-14 13:39:54 patch lines 85-103: `packages/workspace/scripts/lib/task-node-modules.js`
- 2026-06-14 13:40:51 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-14 13:43:12 `review.run`: passed — OK
- 2026-06-14 13:43:12 `review.run`: passed — OK
- 2026-06-14 13:49:57 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:49:58 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:53:28 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:53:28 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:53:28 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:53:28 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:55:15 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:55:34 `verify`: failed — COMMAND_FAILED
- 2026-06-14 13:55:47 `review.run`: passed — OK
- 2026-06-14 13:55:47 `review.run`: passed — OK
- 2026-06-14 13:55:47 `review.run`: passed — OK
- 2026-06-14 13:55:48 `review.run`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-stream-os-review-comments/current.json`, `.task/os/fix-stream-os-review-comments/evidence-log.json`, `.task/os/fix-stream-os-review-comments/read-log.json`, `.task/os/fix-stream-os-review-comments/session.json`, `.task/os/fix-stream-os-review-comments/workpad.md`, `.task/tasks/os/fix-stream-os-review-comments.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/workspace-hostname-edge-router.test.ts`, `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/generate-docs.ts`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/task-node-modules.js`, `packages/workspace/scripts/os-release-device-auth.ts`, `packages/workspace/scripts/os-release.ts`, `packages/workspace/server.py`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-apply-patch.test.ts`, `packages/workspace/tests/server_call_test.py`
- matched rules: `workspace-facade`, `workspace-audit-docs`, `twenty-server-project`, `auto:twenty-server:test`
- selected suites: `workspace facade input contracts`, `workspace audit tests`, `twenty-server affected test target`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed, `twenty-server affected test target` failed
- failed suites: `twenty-server affected test target`
