# fix code run steering examples

branch: `task/workspace-agents/fix-code-run-steering-examples`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/845/fix-code-run-steering-examples
github pr: https://github.com/consuelohq/opensaas/pull/845
started: 2026-06-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/TOOLS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: files changed

- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/TOOLS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-06-08 02:45:11 fs.write: `.task/workspace-agents/fix-code-run-steering-examples/workpad.md`
- 2026-06-08 02:47:30 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-08 02:48:18 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-08 02:48:53 fs.patch: `packages/os/skills/senior-engineer/SKILL.md`
- 2026-06-08 02:48:53 fs.patch: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- 2026-06-08 02:49:19 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-08 02:51:12 fs.patch: `packages/workspace/tooling/tool-manifest.json`
- 2026-06-08 02:51:12 fs.patch: `packages/os/tooling/dev-tool-manifest.json`
- 2026-06-08 02:51:12 fs.patch: `packages/os/manifests/core.manifest.json`
- 2026-06-08 02:51:13 fs.patch: `packages/os/manifests/core.manifest.json`
- 2026-06-08 02:51:13 fs.patch: `packages/os/manifests/tool.manifest.json`
- 2026-06-08 02:51:14 fs.patch: `packages/os/manifests/tool.manifest.json`
- 2026-06-08 02:51:21 fs.patch: `packages/workspace/TOOLS.md`
- 2026-06-08 02:51:21 fs.patch: `packages/os/TOOLS.md`
- 2026-06-08 02:51:59 fs.patch: `packages/workspace/TOOLS.md`
- 2026-06-08 02:52:00 fs.patch: `packages/os/TOOLS.md`
- 2026-06-08 02:52:00 fs.patch: `packages/workspace/tooling/tool-manifest.json`
- 2026-06-08 02:52:00 fs.patch: `packages/os/tooling/dev-tool-manifest.json`
- 2026-06-08 02:52:01 fs.patch: `packages/os/manifests/core.manifest.json`
- 2026-06-08 02:52:01 fs.patch: `packages/os/manifests/tool.manifest.json`
- 2026-06-08 02:52:52 fs.patch: `packages/os/skills/senior-engineer/SKILL.md`
- 2026-06-08 02:52:52 fs.patch: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- 2026-06-08 02:53:19 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-08 02:53:19 fs.patch: `packages/os/skills/senior-engineer/SKILL.md`
- 2026-06-08 02:53:20 fs.patch: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- 2026-06-08 02:56:53 fs.write: `.task/workspace-agents/fix-code-run-steering-examples/workpad.md`

## workspace-owned: validation evidence

- 2026-06-08 02:54:17 `review.run`: passed — OK
- 2026-06-08 02:54:55 `verify`: failed — COMMAND_FAILED
- 2026-06-08 02:56:19 `review.run`: passed — OK
- 2026-06-08 02:56:35 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/TOOLS.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/scripts/lib/codemode/tools/index.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/code-run.ts`
- `packages/workspace/tooling/tool-manifest.json`

## Test-first contract

Behavior under test:
- Steering should describe `code.run` as code-mode over workspace APIs, not merely as a tool-chain wrapper.
- Steering should clearly distinguish `code.run` from `batch`: `batch` is fixed independent fan-out; `code.run` is programmable control flow, filtering, summarization, joins, retries, and output reduction.
- Examples should demonstrate a small program that keeps noisy intermediate tool output inside code mode and returns a compact result.
- OS senior-engineer skill and its fixture should mirror the same guidance.

Existing pattern to follow:
- `packages/workspace/STEERING.md` owns workspace bootstrap steering.
- `packages/os/skills/senior-engineer/SKILL.md` owns OS senior-engineer agent behavior.
- `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md` mirrors the senior-engineer skill fixture.

Intended validation:
- Docs-only steering change; no production behavior changes.
- Use targeted grep/read validation to prove old misleading phrasing is gone and new distinctions/examples are present.
- Run relevant workspace review if practical.

No-test waiver:
- This is a steering/docs-only change. There is no runtime behavior to unit test. Validation is content-level and review-level.

- 2026-06-08 02:45:11 append: `.task/workspace-agents/fix-code-run-steering-examples/workpad.md`

- 2026-06-08 02:47:30 patch lines 252-279: `packages/workspace/STEERING.md`

- 2026-06-08 02:48:18 patch lines 250-251: `packages/workspace/STEERING.md`

- 2026-06-08 02:48:53 patch lines 19-49: `packages/os/skills/senior-engineer/SKILL.md`

- 2026-06-08 02:48:53 patch lines 19-49: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`

- 2026-06-08 02:49:19 patch lines 454-454: `packages/workspace/STEERING.md`

- 2026-06-08 02:51:12 patch lines 5031-5031: `packages/workspace/tooling/tool-manifest.json`

- 2026-06-08 02:51:12 patch lines 5036-5036: `packages/os/tooling/dev-tool-manifest.json`

- 2026-06-08 02:51:12 patch lines 125-125: `packages/os/manifests/core.manifest.json`

- 2026-06-08 02:51:13 patch lines 133-133: `packages/os/manifests/core.manifest.json`

- 2026-06-08 02:51:13 patch lines 1561-1561: `packages/os/manifests/tool.manifest.json`

- 2026-06-08 02:51:14 patch lines 1569-1569: `packages/os/manifests/tool.manifest.json`

- 2026-06-08 02:51:21 patch lines 53-53: `packages/workspace/TOOLS.md`

- 2026-06-08 02:51:21 patch lines 56-56: `packages/os/TOOLS.md`

- 2026-06-08 02:51:59 patch lines 66-66: `packages/workspace/TOOLS.md`

- 2026-06-08 02:52:00 patch lines 72-72: `packages/os/TOOLS.md`

- 2026-06-08 02:52:00 patch lines 5085-5085: `packages/workspace/tooling/tool-manifest.json`

- 2026-06-08 02:52:00 patch lines 5090-5090: `packages/os/tooling/dev-tool-manifest.json`

- 2026-06-08 02:52:01 patch lines 187-187: `packages/os/manifests/core.manifest.json`

- 2026-06-08 02:52:01 patch lines 1623-1623: `packages/os/manifests/tool.manifest.json`

- 2026-06-08 02:52:52 patch lines 58-62: `packages/os/skills/senior-engineer/SKILL.md`

- 2026-06-08 02:52:52 patch lines 58-62: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`

- 2026-06-08 02:53:19 patch lines 250-251: `packages/workspace/STEERING.md`

- 2026-06-08 02:53:19 patch lines 57-59: `packages/os/skills/senior-engineer/SKILL.md`

- 2026-06-08 02:53:20 patch lines 57-59: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`

## workspace-owned: test selection

- changed files: `.task/design/add-page-versions-to-design-wiki-publish-archive/current.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/evidence-log.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/read-log.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/session.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/verify.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/workpad.md`, `.task/design/add-wiki-revision-guard/current.json`, `.task/design/add-wiki-revision-guard/evidence-log.json`, `.task/design/add-wiki-revision-guard/read-log.json`, `.task/design/add-wiki-revision-guard/session.json`, `.task/design/add-wiki-revision-guard/verify.json`, `.task/design/add-wiki-revision-guard/workpad.md`, `.task/design/build-hardcoded-typed-reader-shell-renderer/current.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/evidence-log.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/final-validation.md`, `.task/design/build-hardcoded-typed-reader-shell-renderer/read-log.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke/index.html`, `.task/design/build-hardcoded-typed-reader-shell-renderer/session.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/verify.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`, `.task/design/recover-old-os-spec-and-document-shell-degradation/current.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/evidence-log.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/read-log.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/session.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/verify.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/workpad.md`, `.task/design/restore-rich-reader-typed-components/current.json`, `.task/design/restore-rich-reader-typed-components/direct-components-smoke.json`, `.task/design/restore-rich-reader-typed-components/direct-components-smoke/index.html`, `.task/design/restore-rich-reader-typed-components/evidence-log.json`, `.task/design/restore-rich-reader-typed-components/read-log.json`, `.task/design/restore-rich-reader-typed-components/session.json`, `.task/design/restore-rich-reader-typed-components/verify.json`, `.task/design/restore-rich-reader-typed-components/workpad.md`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/current.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/evidence-log.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/read-log.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/session.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/verify.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/workpad.md`, `.task/diff-cockpit/fix-review-page-regressions/current.json`, `.task/diff-cockpit/fix-review-page-regressions/evidence-log.json`, `.task/diff-cockpit/fix-review-page-regressions/read-log.json`, `.task/diff-cockpit/fix-review-page-regressions/session.json`, `.task/diff-cockpit/fix-review-page-regressions/verify.json`, `.task/diff-cockpit/fix-review-page-regressions/workpad.md`, `.task/diff-cockpit/homepage-cache-headers/current.json`, `.task/diff-cockpit/homepage-cache-headers/evidence-log.json`, `.task/diff-cockpit/homepage-cache-headers/read-log.json`, `.task/diff-cockpit/homepage-cache-headers/session.json`, `.task/diff-cockpit/homepage-cache-headers/verify.json`, `.task/diff-cockpit/homepage-cache-headers/workpad.md`, `.task/diff-cockpit/main-packages-code-browser/current.json`, `.task/diff-cockpit/main-packages-code-browser/evidence-log.json`, `.task/diff-cockpit/main-packages-code-browser/read-log.json`, `.task/diff-cockpit/main-packages-code-browser/session.json`, `.task/diff-cockpit/main-packages-code-browser/verify.json`, `.task/diff-cockpit/main-packages-code-browser/workpad.md`, `.task/diff-cockpit/polish-code-browser-mobile-layout/current.json`, `.task/diff-cockpit/polish-code-browser-mobile-layout/evidence-log.json`, `.task/diff-cockpit/polish-code-browser-mobile-layout/read-log.json`, `.task/diff-cockpit/polish-code-browser-mobile-layout/session.json`, `.task/diff-cockpit/polish-code-browser-mobile-layout/verify.json`, `.task/diff-cockpit/polish-code-browser-mobile-layout/workpad.md`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/current.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/evidence-log.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/read-log.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/session.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/verify.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/workpad.md`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/current.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/evidence-log.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/read-log.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/session.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/verify.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/workpad.md`, `.task/diff-cockpit/prepare-stream-merge-from-stream/current.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/evidence-log.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/read-log.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/session.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/verify.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/workpad.md`, `.task/diff-cockpit/tighten-mobile-diff-gutters/current.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/session.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/verify.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/workpad.md`, `.task/tasks/design/add-page-versions-to-design-wiki-publish-archive.json`, `.task/tasks/design/add-wiki-revision-guard.json`, `.task/tasks/design/build-hardcoded-typed-reader-shell-renderer.json`, `.task/tasks/design/recover-old-os-spec-and-document-shell-degradation.json`, `.task/tasks/design/restore-rich-reader-typed-components.json`, `.task/tasks/diff-cockpit/event-driven-cache-refresh-hooks.json`, `.task/tasks/diff-cockpit/fix-review-page-regressions.json`, `.task/tasks/diff-cockpit/homepage-cache-headers.json`, `.task/tasks/diff-cockpit/main-packages-code-browser.json`, `.task/tasks/diff-cockpit/polish-code-browser-mobile-layout.json`, `.task/tasks/diff-cockpit/polish-main-code-browser-search-and-cache.json`, `.task/tasks/diff-cockpit/polish-mobile-review-and-shared-cache.json`, `.task/tasks/diff-cockpit/prepare-stream-merge-from-stream.json`, `.task/tasks/diff-cockpit/tighten-mobile-diff-gutters.json`, `.task/tasks/workspace-agents/fix-code-run-steering-examples.json`, `.task/tasks/workspace-repair/hotfix-research-ingest-on-main.json`, `.task/workspace-agents/fix-code-run-steering-examples/current.json`, `.task/workspace-agents/fix-code-run-steering-examples/evidence-log.json`, `.task/workspace-agents/fix-code-run-steering-examples/read-log.json`, `.task/workspace-agents/fix-code-run-steering-examples/session.json`, `.task/workspace-agents/fix-code-run-steering-examples/workpad.md`, `.task/workspace-repair/hotfix-research-ingest-on-main/current.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/evidence-log.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/read-log.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/session.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/verify.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/workpad.md`, `areas/consuelo-design/AGENTS.md`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/guide.md`, `packages/consuelo-design/templates/digital-eguides/plan.md`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/consuelo-design/templates/digital-eguides/spec.md`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/skills/senior-engineer/SKILL.md`, `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`, `packages/os/tooling/dev-tool-manifest.json`, `packages/twenty-shared/src/constants/DocumentationPaths.ts`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/hooks/README.md`, `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/scripts/diff_cockpit.ts`, `packages/workspace/scripts/research-ingest.js`, `packages/workspace/scripts/task-push.js`, `packages/workspace/tests/consuelo-design-theme.test.js`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-publish-gate`, `workspace-audit-docs`, `auto:twenty-shared:test`
- selected suites: `workspace facade input contracts`, `workspace verification stamp tests`, `workspace audit tests`, `twenty-shared test`
- run results: `workspace facade input contracts` passed, `workspace verification stamp tests` passed, `workspace audit tests` passed, `twenty-shared test` failed
- failed suites: `twenty-shared test`

## Implementation notes

Updated code.run steering to describe it as code mode over workspace APIs, not just a typed-tool chaining helper. Clarified the batch/code.run split:
- batch is fixed independent fan-out/fan-in
- code.run is for programmable control flow, filtering, joining, retries, derived summaries, and output reduction

Updated examples to use context.trace filtering as a concrete high-value code.run use case, so agents keep noisy intermediate rows inside code mode and return compact aggregates.

Files updated:
- packages/workspace/STEERING.md
- packages/workspace/TOOLS.md
- packages/workspace/tooling/tool-manifest.json
- packages/os/TOOLS.md
- packages/os/tooling/dev-tool-manifest.json
- packages/os/manifests/core.manifest.json
- packages/os/manifests/tool.manifest.json
- packages/os/skills/senior-engineer/SKILL.md
- packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md

Validation:
- JSON parse validation passed for tool manifests, trace trc_255a93ac7567.
- Targeted searches showed old code.run description removed, trace trc_53680721962e.
- Targeted searches showed old trivial status example removed, trace trc_ad11ecd67a57.
- review.run passed with 0 issues in this change, trace trc_abfd5db6f718.
- verify did not publish a valid stamp; review and selected test summary passed, but the full registry gate still failed in workspace-facade/workspace-audit-docs/twenty-shared selection context, trace trc_94eb912cb0bf.

Operational note:
- I tried using code.run for this work to dogfood the steering, but current workspace code.run fails before executing user code because packages/workspace/scripts/code-run.ts imports missing ./lib/codemode/tools/index. I did not fix that runtime bug in this steering-only PR. It should be a follow-up because steering alone will not increase usage if the workspace code.run entrypoint is broken.
- I did not use python3 for the implementation. The document edits used typed fs tools and a generated-docs tool; a blocked node helper attempt was not used for final edits.

- 2026-06-08 02:56:53 append: `.task/workspace-agents/fix-code-run-steering-examples/workpad.md`
