# Add structured unknown tool recovery

## Objective

Redo the OS facade unknown-tool recovery work on a fresh task branch without force-pushing the previous empty PR.

Task session: `tsk_a6c8b545ab78`
Branch: `task/os/add-structured-unknown-tool-recovery`
PR: #811
Base: `stream/os`

## Changes

- Added structured `NOT_FOUND` recovery metadata in `packages/os/scripts/lib/facade/executor.ts`.
- Added safe alias suggestions for high-confidence aliases such as `mac.run` and `mac.shell` to `mac.call`.
- Added ambiguous candidate guidance for short aliases such as `run`, `exec`, `shell`, `read`, and `write`.
- Reused the in-process `tools.search` scorer for non-alias near misses, with docs and embeddings disabled for bounded local recovery.
- Added focused coverage in `packages/os/tests/facade/not-found-recovery.test.ts`.
- Documented the recovery contract in `packages/os/skills.md`.

## Validation

- `bun --cwd packages/os test tests/facade/not-found-recovery.test.ts` passed: 3 tests.
- `bun --cwd packages/os test tests/facade/facade.test.ts tests/facade/not-found-recovery.test.ts` passed: 539 tests across 2 files.
- `checkFiles` passed for changed TypeScript files; it failed only when asked to run `node --check` against the Markdown doc, which is expected and not a code syntax failure.
- `review.run --base stream/os --no-tests` passed with 0 blocking issues and only the pre-existing `twenty-shared` typecheck finding.

## Notes

- Old PR #783 exists but has no changed files and does not contain the implementation.
- This branch intentionally avoids force-pushing over #783.

- 2026-06-05 20:06:57 write: `.task/os/add-structured-unknown-tool-recovery/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-05 20:06:57 fs.write: `.task/os/add-structured-unknown-tool-recovery/workpad.md`

## workspace-owned: validation evidence

- 2026-06-05 20:07:28 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: `.task/os/add-structured-unknown-tool-recovery/current.json`, `.task/os/add-structured-unknown-tool-recovery/evidence-log.json`, `.task/os/add-structured-unknown-tool-recovery/read-log.json`, `.task/os/add-structured-unknown-tool-recovery/session.json`, `.task/os/add-structured-unknown-tool-recovery/workpad.md`, `.task/os/package-consuelo-os-as-installed-product-root/current.json`, `.task/os/package-consuelo-os-as-installed-product-root/evidence-log.json`, `.task/os/package-consuelo-os-as-installed-product-root/read-log.json`, `.task/os/package-consuelo-os-as-installed-product-root/session.json`, `.task/os/package-consuelo-os-as-installed-product-root/verify.json`, `.task/os/package-consuelo-os-as-installed-product-root/workpad.md`, `.task/os/polish-agent-context-docs/assert-agent-context-docs.py`, `.task/os/polish-agent-context-docs/current.json`, `.task/os/polish-agent-context-docs/evidence-log.json`, `.task/os/polish-agent-context-docs/read-log.json`, `.task/os/polish-agent-context-docs/session.json`, `.task/os/polish-agent-context-docs/verify.json`, `.task/os/polish-agent-context-docs/workpad.md`, `.task/os/productize-os-office-surface/current.json`, `.task/os/productize-os-office-surface/evidence-log.json`, `.task/os/productize-os-office-surface/read-log.json`, `.task/os/productize-os-office-surface/session.json`, `.task/os/productize-os-office-surface/verify.json`, `.task/os/productize-os-office-surface/workpad.md`, `.task/os/restore-raw-source-docs-nav-from-stream/current.json`, `.task/os/restore-raw-source-docs-nav-from-stream/evidence-log.json`, `.task/os/restore-raw-source-docs-nav-from-stream/read-log.json`, `.task/os/restore-raw-source-docs-nav-from-stream/session.json`, `.task/os/restore-raw-source-docs-nav-from-stream/verify.json`, `.task/os/restore-raw-source-docs-nav-from-stream/workpad.md`, `.task/tasks/os/add-structured-unknown-tool-recovery.json`, `.task/tasks/os/package-consuelo-os-as-installed-product-root.json`, `.task/tasks/os/polish-agent-context-docs.json`, `.task/tasks/os/productize-os-office-surface.json`, `.task/tasks/os/restore-raw-source-docs-nav-from-stream.json`, `packages/consuelo-docs/docs.json`, `packages/consuelo-docs/l/ar/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/ar/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ar/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/ar/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ar/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ar/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/cs/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/cs/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/cs/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/cs/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/cs/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/cs/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/de/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/de/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/de/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/de/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/de/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/de/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/es/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/es/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/es/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/es/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/es/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/es/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/fr/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/fr/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/fr/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/fr/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/fr/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/fr/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/it/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/it/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/it/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/it/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/it/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/it/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ja/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/ja/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ja/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/ja/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ja/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ja/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ko/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/ko/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ko/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/ko/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ko/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ko/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/pt/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/pt/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/pt/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/pt/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/pt/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/pt/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ro/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/ro/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ro/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/ro/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ro/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ro/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ru/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/ru/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ru/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/ru/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ru/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ru/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/tr/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/tr/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/tr/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/tr/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/tr/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/tr/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/zh/os/agent-context/decision.mdx`, `packages/consuelo-docs/l/zh/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/zh/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/zh/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/zh/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/zh/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/navigation/base-structure.json`, `packages/consuelo-docs/navigation/navigation.template.json`, `packages/consuelo-docs/os/agent-context/decision.mdx`, `packages/consuelo-docs/os/agent-context/scripts.mdx`, `packages/consuelo-docs/os/agent-context/steering.mdx`, `packages/consuelo-docs/os/agent-context/tools.mdx`, `packages/consuelo-docs/os/tools/default-steering.mdx`, `packages/consuelo-docs/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/package.json`, `packages/consuelo-docs/scripts/generate-os-source-docs.ts`, `packages/os/TOOLS.md`, `packages/os/package.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/generate-docs.ts`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/artifacts.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/office-pages.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/scripts/os.ts`, `packages/os/skills.md`, `packages/os/skills/office/SKILL.md`, `packages/os/skills/office/skill.json`, `packages/os/skills/skills.json`, `packages/os/tests/artifacts.test.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/facade/not-found-recovery.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/office-cli.test.ts`, `packages/twenty-shared/src/constants/DocumentationPaths.ts`
- matched rules: `auto:twenty-shared:test`
- selected suites: `twenty-shared test`
- run results: `twenty-shared test` failed
- failed suites: `twenty-shared test`
