# Consolidate Office into OS Artifacts

branch: `task/os/consolidate-office-into-os-artifacts`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1516/consolidate-office-into-os-artifacts
github pr: https://github.com/consuelohq/opensaas/pull/1516
started: 2026-07-15

## acceptance criteria

- [x] `packages/os` owns the canonical Artifacts catalog, publisher, renderer, CLI, skill, workflow, and Hono gateway surface.
- [x] The proven Office archive behavior is preserved: stable route paths, current and historical copies, categories/templates, search data, revision guards, and integrity checks.
- [x] Existing archive data can be imported once with count/hash parity and no runtime dependency on `packages/workspace` or vendored Open Design archive paths.
- [x] The user-facing product is named **Consuelo Artifacts**, served at `/artifacts`, and includes Consuelo branding plus basic SEO metadata.
- [x] Hono exposes signed Artifacts read/control routes while durable artifact pages remain materialized static output for local and edge serving.
- [x] The old SQLite artifact implementation, unused cloud adapter, Office site generator, Office/Wiki commands, tools, skills, workflows, and runtime aliases are removed after parity is proven.
- [x] No dual writes or fallback reads remain; legacy `/office` and `/design-wiki` compatibility is limited to explicit edge redirects only.
- [x] Focused tests, Hono route tests, migration parity tests, negative legacy-contract scans, review, and verify pass.

## plan

1. Capture the existing Office archive model and fixtures as the migration source of truth.
2. Write failing OS tests for the canonical Artifacts catalog, renderer, CLI, migration, `/artifacts` paths, and Hono route policy.
3. Port the proven archive domain into focused `packages/os/scripts/lib/artifacts/` modules and make `scripts/artifacts.ts` the sole command router.
4. Import and verify existing archive data with entry/page/version/file/hash parity.
5. Add the Artifacts Hono service/routes and Consuelo Sites gateway adapter; wire local and edge route contracts.
6. Rename tools, workflow, skills, schemas, generated manifests/types, launcher copy, SEO, and logo treatment to Artifacts.
7. Migrate remaining OS writers, cut over serving, then delete dormant artifact/cloud/Office/workspace fallback code.
8. Run focused and broad validation, exact negative scans, review, verify, push, and promote to `stream/os`.

## test-first contract

- Behavior under test: publishing a local file/directory creates or updates one route-addressed artifact with immutable versions, base-version protection, integrity metadata, and a generated `sites/artifacts` index; Hono returns the same catalog through signed `/gateway/artifacts` routes.
- Existing local pattern: workspace Office archive tests for version paths/search/chrome plus OS Hono route-policy and gateway-adapter tests.
- New or changed tests: replace `packages/os/tests/artifacts.test.ts` with canonical catalog/publish/history/rollback tests; add renderer/SEO assertions, migration parity fixtures, Hono route tests, edge route tests, and negative Office/Wiki dependency scans.
- Focused red command: `bunx vitest run tests/artifacts.test.ts tests/artifacts-hono-routes.test.ts` from `packages/os`.
- Expected red failure: missing route-addressed Artifacts publisher/catalog modules, missing `/artifacts` materialization, and missing Hono Artifacts routes.
- No-test waiver: none; this is a behavioral and storage-boundary migration.

## current status

- Implementation complete, reviewed, and verified with a publish-valid stamp.
- Canonical route-addressed Artifacts domain, Hono routes, edge registration, skills/tools/workflow, installer integration, and OS-only command surface are implemented.
- Superseded SQLite, cloud adapter, Office/Wiki, workspace publisher, root aliases, and design passthroughs are removed.
- Real legacy archive import parity passed: 20 visible artifacts, 30 versions, 29 materialized versions, 1 external reference, 206 files, zero hash/target mismatches, and 1 hidden malformed orphan explicitly reported.

## files changed

- `packages/consuelo-design/scripts/consuelo-design.ts` (deleted)
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/design/artifacts-landing-page.ts` (deleted)
- `packages/os/scripts/design/office-landing-page.ts` (deleted)
- `packages/os/scripts/design/office.ts` (deleted)
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/cloud-artifacts.ts` (deleted)
- `packages/os/scripts/lib/consuelo-sites-artifacts-adapter.ts`
- `packages/os/scripts/lib/office-pages.ts` (deleted)
- `packages/os/scripts/office.ts` (deleted)
- `packages/os/scripts/revenue/daily-revenue-brief.ts`
- `packages/os/scripts/server/routes/artifacts.ts`
- `packages/os/scripts/server/services/artifacts-gateway.ts`
- `packages/os/skills/artifacts/references/agents.md`
- `packages/os/skills/artifacts/skill.json`
- `packages/os/skills/artifacts/SKILL.md`
- `packages/os/skills/office` (deleted)
- `packages/os/skills/office-landing-page` (deleted)
- `packages/os/skills/sites/skill.json`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/artifacts-edge-redirect.test.ts`
- `packages/os/tests/artifacts-hono-routes.test.ts`
- `packages/os/tests/artifacts-legacy-contract.test.ts`
- `packages/os/tests/artifacts-skill.test.ts`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/cloud-artifacts.test.ts` (deleted)
- `packages/os/tests/consuelo-sites-artifacts-adapter.test.ts`
- `packages/os/tests/office-landing-page.test.ts` (deleted)
- `packages/os/tests/office-skill.test.ts` (deleted)
- `packages/workspace/scripts/office.ts` (deleted)
- `packages/workspace/tests/office-theme.test.js` (deleted)

## workspace-owned: files changed

- `packages/consuelo-design/scripts/consuelo-design.ts` (deleted)
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/design/artifacts-landing-page.ts` (deleted)
- `packages/os/scripts/design/office-landing-page.ts` (deleted)
- `packages/os/scripts/design/office.ts` (deleted)
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/cloud-artifacts.ts` (deleted)
- `packages/os/scripts/lib/consuelo-sites-artifacts-adapter.ts`
- `packages/os/scripts/lib/office-pages.ts` (deleted)
- `packages/os/scripts/office.ts` (deleted)
- `packages/os/scripts/revenue/daily-revenue-brief.ts`
- `packages/os/scripts/server/routes/artifacts.ts`
- `packages/os/scripts/server/services/artifacts-gateway.ts`
- `packages/os/skills/artifacts/references/agents.md`
- `packages/os/skills/artifacts/skill.json`
- `packages/os/skills/artifacts/SKILL.md`
- `packages/os/skills/office` (deleted)
- `packages/os/skills/office-landing-page` (deleted)
- `packages/os/skills/sites/skill.json`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/artifacts-edge-redirect.test.ts`
- `packages/os/tests/artifacts-hono-routes.test.ts`
- `packages/os/tests/artifacts-legacy-contract.test.ts`
- `packages/os/tests/artifacts-skill.test.ts`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/cloud-artifacts.test.ts` (deleted)
- `packages/os/tests/consuelo-sites-artifacts-adapter.test.ts`
- `packages/os/tests/office-landing-page.test.ts` (deleted)
- `packages/os/tests/office-skill.test.ts` (deleted)
- `packages/workspace/scripts/office.ts` (deleted)
- `packages/workspace/tests/office-theme.test.js` (deleted)

## workspace-owned: activity log

- 2026-07-15 18:42:11 fs.write: `packages/os/tests/artifacts.test.ts`
- 2026-07-15 18:42:44 fs.write: `packages/os/tests/artifacts-hono-routes.test.ts`
- 2026-07-15 18:45:21 fs.write: `packages/os/scripts/lib/artifacts.ts`
- 2026-07-15 18:45:59 fs.write: `packages/os/scripts/server/services/artifacts-gateway.ts`
- 2026-07-15 18:46:13 fs.write: `packages/os/scripts/server/routes/artifacts.ts`
- 2026-07-15 18:47:44 fs.write: `packages/os/scripts/artifacts.ts`
- 2026-07-15 18:50:24 fs.write: `packages/os/scripts/revenue/daily-revenue-brief.ts`
- 2026-07-15 18:53:23 fs.write: `packages/os/skills/artifacts/skill.json`
- 2026-07-15 18:53:44 fs.write: `packages/os/skills/artifacts/SKILL.md`
- 2026-07-15 18:53:52 fs.write: `packages/os/skills/sites/skill.json`
- 2026-07-15 18:54:05 fs.write: `packages/os/skills/sites/SKILL.md`
- 2026-07-15 18:54:33 fs.write: `packages/os/skills/artifacts/references/agents.md`
- 2026-07-15 19:00:29 fs.write: `packages/os/tests/consuelo-sites-artifacts-adapter.test.ts`
- 2026-07-15 19:00:41 fs.write: `packages/os/scripts/lib/consuelo-sites-artifacts-adapter.ts`
- 2026-07-15 19:02:29 fs.write: `packages/os/tests/artifacts-edge-redirect.test.ts`
- 2026-07-15 19:03:16 fs.write: `packages/os/tests/artifacts-skill.test.ts`
- 2026-07-15 19:03:31 fs.trash: `packages/os/scripts/office.ts`
- 2026-07-15 19:03:31 fs.trash: `packages/os/scripts/design/office.ts`
- 2026-07-15 19:03:32 fs.trash: `packages/os/scripts/design/office-landing-page.ts`
- 2026-07-15 19:03:32 fs.trash: `packages/os/scripts/lib/cloud-artifacts.ts`
- 2026-07-15 19:03:32 fs.trash: `packages/os/scripts/lib/office-pages.ts`
- 2026-07-15 19:03:32 fs.trash: `packages/os/skills/office`
- 2026-07-15 19:03:33 fs.trash: `packages/os/skills/office-landing-page`
- 2026-07-15 19:03:33 fs.trash: `packages/os/tests/office-skill.test.ts`
- 2026-07-15 19:03:33 fs.trash: `packages/os/tests/office-landing-page.test.ts`
- 2026-07-15 19:03:33 fs.trash: `packages/os/tests/cloud-artifacts.test.ts`
- 2026-07-15 19:03:46 fs.trash: `packages/os/scripts/design/artifacts-landing-page.ts`
- 2026-07-15 19:18:36 fs.write: `packages/os/tests/artifacts-legacy-contract.test.ts`
- 2026-07-15 19:20:13 fs.trash: `packages/workspace/scripts/office.ts`
- 2026-07-15 19:20:13 fs.trash: `packages/workspace/tests/office-theme.test.js`
- 2026-07-15 19:21:40 fs.trash: `packages/consuelo-design/scripts/consuelo-design.ts`

## workspace-owned: validation evidence

- 2026-07-15 19:32:13 `review.run`: passed — OK
- 2026-07-15 19:32:34 `review.run`: passed — OK
- 2026-07-15 19:32:52 `verify`: passed — OK

## key decisions

- The active workspace Office archive, not the dormant SQLite store, is the behavioral source of truth.
- Preserve useful provenance/hash/version invariants, but do not preserve the old SQLite schema or ID-addressed user-facing storage contract.
- Keep one Artifacts domain split into focused modules rather than one monolithic file.
- Hono owns catalog/control APIs; materialized static files remain the durable page delivery format.
- No OS runtime dependency or fallback to `packages/workspace` after import.
- Visible legacy archive entries are authoritative; hidden page records absent from the visible catalog are reported as orphans rather than imported or fabricated.
- External artifact references remain explicit external records backed by deterministic redirect pages; the importer never pretends external bytes were stored locally.
- Legacy URL compatibility is edge-only via 308 redirects for `/office` and `/design-wiki`.

## notes for ko

- `task.start` resolved the requested `sites` workflow to the legacy `office` bundle. This task will replace that mapping rather than retain it.
- The active archive includes one hidden malformed duplicate page whose historical bytes no longer exist. It is excluded from the 20 visible artifacts and written to the migration report for auditability.

## improvements noticed

- The OS manifest currently advertises `design.publish`, but the OS-local command does not implement `publish`; consolidation will repair this stale generated contract.
- Generic OS facade tests expose a pre-existing media schema mismatch: `origin/main` advertises inputs such as `MediaAngleMeasureInput` without defining them in the facade schema registry. This task did not create or modify that mismatch; Artifacts-specific and changed-surface suites pass independently.

## issues and recovery

- Initial full workflow read was ambiguous because unrelated task worktrees were active. Recovered by starting the approved task first and reading with its `taskSession`.
- The first archive parity pass assumed route-derived historical storage paths. Real data showed three legacy layouts plus one external target; the importer was corrected to honor explicit `artifactPath`/`target` metadata.
- The real archive contains one hidden orphan page absent from the visible entries and missing its historical bytes. The importer now reports and skips it rather than failing or fabricating history.
- A combined Vitest process produced transient full-server module state and ambient task-state interference. Production Bun imports passed, the Hono architecture suite passed in isolation, and changed-surface suites were rerun in isolated processes.
- `packages/workspace` has no `typecheck` script; attempted validation returned `Script not found "typecheck"`. Workspace validation is covered by its manifest, workflow, and facade suites.

## validation evidence

- OS migration suite: 17 files, 132 tests passed.
- OS Hono architecture suite: 15 tests passed in isolation; production Bun imports for app, Artifacts, Settings, and Traces passed.
- Workspace manifest/workflow/facade suite: 38 tests passed.
- Cron jobs: 12 tests passed.
- Consuelo reader shell: 19 tests passed.
- OS syntax/typecheck script passed.
- Strict legacy contract tests pass and prohibit Office tools/skills/workflows, SQLite artifact storage, cloud adapter duplication, workspace fallbacks, and internal legacy aliases.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `cron_jobs/index.ts`
- `cron_jobs/sites_launcher/cron.json`
- `cron_jobs/tests/cron_jobs.test.ts`
- `package.json`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/scripts/consuelo-design.ts`
- `packages/os/manifests/manifest.config.json`
- `packages/os/package.json`
- `packages/os/scripts/artifacts-design.ts`
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/design/artifacts-landing-page.ts`
- `packages/os/scripts/design/artifacts.ts`
- `packages/os/scripts/design/office-landing-page.ts`
- `packages/os/scripts/design/office.ts`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/consuelo-sites-settings-adapter.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/office.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/revenue/daily-revenue-brief.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/skills.md`
- `packages/os/skills/artifacts/subskills/digital-eguide.json`
- `packages/os/skills/artifacts/subskills/landing-page.json`
- `packages/os/skills/daily-revenue-brief/skill.json`
- `packages/os/skills/office/SKILL.md`
- `packages/os/skills/office/skill.json`
- `packages/os/skills/office/subskills/landing-page.json`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/skills/sites/skill.json`
- `packages/os/skills/skills.json`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/consuelo-sites-settings-adapter.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/office-landing-page.test.ts`
- `packages/os/tests/office-skill.test.ts`
- `packages/os/tests/onboarding-skills.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/settings-hono-routes.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tooling/tool-manifest.json`
- `packages/os/tooling/workflows.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/generate-types.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/office-theme.test.js`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tests/workflow-intent.test.ts`
- `packages/workspace/tooling/workflows.json`

## workspace-owned: test selection

- changed files: `.task/os/consolidate-office-into-os-artifacts/current.json`, `.task/os/consolidate-office-into-os-artifacts/evidence-log.json`, `.task/os/consolidate-office-into-os-artifacts/read-log.json`, `.task/os/consolidate-office-into-os-artifacts/session.json`, `.task/os/consolidate-office-into-os-artifacts/workpad.md`, `.task/tasks/os/consolidate-office-into-os-artifacts.json`, `areas/consuelo-design/AGENTS.md`, `cron_jobs/index.ts`, `cron_jobs/sites_launcher/cron.json`, `cron_jobs/tests/cron_jobs.test.ts`, `package.json`, `packages/consuelo-design/package.json`, `packages/consuelo-design/scripts/consuelo-design.ts`, `packages/consuelo-design/templates/digital-eguides/README.md`, `packages/consuelo-design/templates/digital-eguides/plan.md`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/consuelo-design/templates/digital-eguides/research.md`, `packages/consuelo-design/templates/digital-eguides/spec.md`, `packages/os/TOOLS.md`, `packages/os/assets/consuelo-mark.png`, `packages/os/docs/skills.md`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/artifact-render.ts`, `packages/os/scripts/artifact-validate.ts`, `packages/os/scripts/artifacts-design.ts`, `packages/os/scripts/artifacts.ts`, `packages/os/scripts/design/artifacts.ts`, `packages/os/scripts/design/office-landing-page.ts`, `packages/os/scripts/design/office.ts`, `packages/os/scripts/lib/artifacts.ts`, `packages/os/scripts/lib/cloud-artifacts.ts`, `packages/os/scripts/lib/consuelo-sites-artifacts-adapter.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/office-pages.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/office.ts`, `packages/os/scripts/os.ts`, `packages/os/scripts/revenue/daily-revenue-brief.ts`, `packages/os/scripts/server/app.ts`, `packages/os/scripts/server/route-policies.ts`, `packages/os/scripts/server/routes/artifacts.ts`, `packages/os/scripts/server/services/artifacts-gateway.ts`, `packages/os/scripts/task-intent.js`, `packages/os/scripts/task-start.js`, `packages/os/skills.md`, `packages/os/skills/artifacts/SKILL.md`, `packages/os/skills/artifacts/references/agents.md`, `packages/os/skills/artifacts/skill.json`, `packages/os/skills/artifacts/subskills/digital-eguide.json`, `packages/os/skills/artifacts/subskills/html-email.json`, `packages/os/skills/artifacts/subskills/hyperframes.json`, `packages/os/skills/artifacts/subskills/landing-page.json`, `packages/os/skills/artifacts/subskills/motion-frame.json`, `packages/os/skills/artifacts/subskills/plan.json`, `packages/os/skills/artifacts/subskills/research-guide.json`, `packages/os/skills/artifacts/subskills/spec.json`, `packages/os/skills/daily-revenue-brief/skill.json`, `packages/os/skills/office-landing-page/skill.json`, `packages/os/skills/office/SKILL.md`, `packages/os/skills/office/references/agents.md`, `packages/os/skills/office/skill.json`, `packages/os/skills/office/subskills/digital-eguide.json`, `packages/os/skills/office/subskills/html-email.json`, `packages/os/skills/office/subskills/hyperframes.json`, `packages/os/skills/office/subskills/landing-page.json`, `packages/os/skills/office/subskills/motion-frame.json`, `packages/os/skills/office/subskills/plan.json`, `packages/os/skills/office/subskills/research-guide.json`, `packages/os/skills/office/subskills/spec.json`, `packages/os/skills/sites/SKILL.md`, `packages/os/skills/sites/skill.json`, `packages/os/skills/skills.json`, `packages/os/skills/teach/SKILL.md`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/artifacts-edge-redirect.test.ts`, `packages/os/tests/artifacts-hono-routes.test.ts`, `packages/os/tests/artifacts-legacy-contract.test.ts`, `packages/os/tests/artifacts-skill.test.ts`, `packages/os/tests/artifacts.test.ts`, `packages/os/tests/cloud-artifacts.test.ts`, `packages/os/tests/consuelo-sites-artifacts-adapter.test.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/fixtures/skills/teach-workspace.SKILL.md`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/local-os-server-hono-architecture.test.ts`, `packages/os/tests/office-landing-page.test.ts`, `packages/os/tests/office-skill.test.ts`, `packages/os/tests/onboarding-skills.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/os/tooling/tool-manifest.json`, `packages/os/tooling/workflows.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/office.ts`, `packages/workspace/scripts/os-release-device-auth.ts`, `packages/workspace/scripts/task-intent.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/office-theme.test.js`, `packages/workspace/tests/workflow-intent.test.ts`, `packages/workspace/tooling/tool-manifest.json`, `packages/workspace/tooling/workflows.json`, `yarn.lock`
- matched rules: `workspace-facade`, `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace task session tests`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none

- 2026-07-15 19:33:22 apply-patch: `.task/os/consolidate-office-into-os-artifacts/workpad.md`