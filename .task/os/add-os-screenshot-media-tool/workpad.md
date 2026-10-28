## Summary

- Changed: added the OS-only `media.screenshot.render` tool, local `media:screenshot` Bun script, typed facade, versioned result schema, dependency declaration, generated manifests/types/docs, and focused tests.
- Why: Ko needs a reusable local workflow that turns ordinary product screenshots into polished X-ready media without adding a hosted service or duplicating the implementation in Workspace.
- Design: FFmpeg-only because it is already installed by OS; default 1600×900 dark composition with Consuelo blue `#0000F2`, optional light theme, configurable background/accent/padding, contain/cover fit, and grid/lines/plain patterns. Screenshot pixels are not inverted or recolored.
- Validation: generated and probed a real PNG; 120 media tests passed; 511 tool-manifest expectations passed; focused facade command planning passed; package syntax/typecheck passed; generated outputs were byte-stable; strict review and publish verification passed with zero findings.
- Issues and recovery: ImageMagick was unavailable, so the renderer uses FFmpeg only. Several publication calls exposed tooling requirements around changed-file selection, branch synchronization, and exact workpad checkpoint headings; each was corrected without bypassing verification.
- Follow-up: the two reference screenshots remain in the ChatGPT sandbox and were not committed. The shipped command accepts their local equivalents once Ko saves them on the OS machine.

## Final lifecycle

- Strict task verification passed and wrote a publish-valid stamp to `.task/os/add-os-screenshot-media-tool/verify.json`.
- Review checks passed: static rules, ESLint, typecheck, and spec compliance, with zero findings.
- Test selection reported zero automatically selected suites as a warning; this is covered by the explicit 120-test media run plus focused manifest and facade validation recorded above.
- Publishing summary: this task adds one OS-owned screenshot renderer, keeps Workspace free of a second implementation, and deliberately relies on the already-installed FFmpeg binary. The generated facade, manifest, TypeScript declaration, and documentation all expose the same option set as the local Bun command.
- Final validation: real PNG generation passed; 120 media tests passed; 511 tool-manifest expectations passed; the focused facade command-plan test passed; package syntax/typecheck passed; generated outputs were byte-stable; strict verification produced a publish-valid stamp.
- Follow-up boundary: the uploaded ChatGPT screenshots live in the chat sandbox rather than the OS worktree, so this change ships the reusable local renderer and does not check those user images into the repository.
- Publish recovery: the first `task.push` call omitted the required changed-file selector and was retried with `changed: true`. The first `task.pr` attempt then required a fresh agent-authored workpad update; this section supplies that publication record before retrying.

- 2026-07-14 17:16:38 apply-patch: `.task/os/add-os-screenshot-media-tool/workpad.md`

## workspace-owned: validation evidence

- 2026-07-14 17:16:50 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/add-os-screenshot-media-tool/current.json`, `.task/os/add-os-screenshot-media-tool/evidence-log.json`, `.task/os/add-os-screenshot-media-tool/read-log.json`, `.task/os/add-os-screenshot-media-tool/session.json`, `.task/os/add-os-screenshot-media-tool/verify.json`, `.task/os/add-os-screenshot-media-tool/workpad.md`, `.task/tasks/os/add-os-screenshot-media-tool.json`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/media/dependency-catalog.ts`, `packages/os/scripts/lib/media/schema.ts`, `packages/os/scripts/lib/media/screenshot.ts`, `packages/os/scripts/media.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/media/01-package-boundaries.test.ts`, `packages/os/tests/media/03-runtime-dependency-catalog.test.ts`, `packages/os/tests/media/06-effect-architecture.test.ts`, `packages/os/tests/media/10-cli-json-envelope.test.ts`, `packages/os/tests/media/32-screenshot-render.test.ts`, `packages/os/tests/media/helpers.ts`, `packages/os/tooling/media-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## workspace-owned: files read

- `packages/workspace/scripts/task-push.js`

- 2026-07-14 17:19:07 apply-patch: `.task/os/add-os-screenshot-media-tool/workpad.md`