# generate os skill docs from bundled skills

branch: `task/docs-skills/generate-os-skill-docs-from-bundled-skills`
stream: `stream/docs-skills`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/755/generate-os-skill-docs-from-bundled-skills
github pr: https://github.com/consuelohq/opensaas/pull/755
started: 2026-06-04

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`
- `packages/consuelo-docs/scripts/validate-os-docs.ts`

## workspace-owned: files changed

- `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`
- `packages/consuelo-docs/scripts/validate-os-docs.ts`

## workspace-owned: activity log

- 2026-06-04 19:39:28 fs.patch: `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`
- 2026-06-04 19:42:02 fs.patch: `packages/consuelo-docs/scripts/validate-os-docs.ts`
- 2026-06-04 19:42:45 fs.write: `packages/consuelo-docs/scripts/validate-os-docs.ts`
- 2026-06-04 19:44:38 fs.patch: `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`
- 2026-06-04 19:45:24 fs.patch: `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`

## workspace-owned: validation evidence

- 2026-06-04 19:48:46 `verify`: failed — COMMAND_FAILED
- 2026-06-04 19:51:14 `verify`: passed — OK

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
bun run task:push -- --message "type(docs-skills): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-docs/docs.json`
- `packages/consuelo-docs/navigation/base-structure.json`
- `packages/consuelo-docs/navigation/navigation.template.json`
- `packages/consuelo-docs/navigation/supported-languages.ts`
- `packages/consuelo-docs/os/agent-interface/get-steering.mdx`
- `packages/consuelo-docs/os/overview.mdx`
- `packages/consuelo-docs/os/skills/browser.mdx`
- `packages/consuelo-docs/os/skills/daily-revenue-brief.mdx`
- `packages/consuelo-docs/os/skills/planned/campaign-brief.mdx`
- `packages/consuelo-docs/package.json`
- `packages/consuelo-docs/project.json`
- `packages/consuelo-docs/scripts/generate-docs-json.ts`
- `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`
- `packages/consuelo-docs/scripts/validate-os-docs.ts`
- `packages/os/package.json`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/skills/consuelo-design-landing-page/skill.json`
- `packages/os/skills/daily-revenue-brief/skill.json`
- `packages/os/skills/skills.json`

## implementation notes

- Added `packages/consuelo-docs/scripts/generate-os-skill-docs.ts` to generate docs pages from `packages/os/skills/*/skill.json` and `SKILL.md`.
- Generated one page per bundled skill under `packages/consuelo-docs/os/skills/*`.
- For guidance skills, the generated docs page uses the full `SKILL.md` body after generated frontmatter.
- For script-only skills without `SKILL.md`, the generated docs page uses `skill.json` metadata and a fenced JSON metadata block.
- Renamed the OS nav group from `Runbooks` to `Skills` in `navigation/base-structure.json` and `navigation/navigation.template.json`.
- Preserved old runbook ideas as generated `Planned Skills` pages instead of deleting them.
- Added generated placeholder pages for missing OS nav routes so linked OS docs no longer 404 while authored pages catch up.

## validation evidence

- `bun packages/consuelo-docs/scripts/generate-os-skill-docs.ts` -> generated 11 skill docs.
- `bun packages/consuelo-docs/scripts/generate-docs-json.ts` -> regenerated `docs.json`.
- `bun packages/consuelo-docs/scripts/generate-os-skill-docs.ts --check` -> checked 11 skill docs.
- `bun packages/consuelo-docs/scripts/validate-os-docs.ts` -> validated 11 generated skill pages and verified English OS nav has no missing pages.
- `bun packages/os/scripts/generate-skills-registry.ts` -> wrote 11 skills.
- `bun test packages/os/tests/skills-registry.test.ts` -> 7 pass / 0 fail.
- `cd packages/consuelo-docs && bun run lint` -> passed.
- `git diff --check` -> passed.

## known external blocker

- `mintlify build` is not a valid command in the installed Mintlify CLI and fails before docs validation.
- `mintlify validate` currently fails inside Mintlify/React previewing with `Cannot read properties of null (reading 'useState')`; this appears to be a local Mintlify CLI/runtime issue, not an OS docs structural failure. Structural docs validation and MDX lint pass.

## notes for ko

- There is intentionally no `Installed Skills` page in this task.
- Generated skill docs are not summaries; they render the skill body where a `SKILL.md` exists.
- Generated docs remain downstream of `packages/os/skills`; future skill edits should regenerate docs instead of editing generated pages directly.

## workspace-owned: test selection

- changed files: `.task/docs-skills/generate-os-skill-docs-from-bundled-skills/current.json`, `.task/docs-skills/generate-os-skill-docs-from-bundled-skills/evidence-log.json`, `.task/docs-skills/generate-os-skill-docs-from-bundled-skills/read-log.json`, `.task/docs-skills/generate-os-skill-docs-from-bundled-skills/session.json`, `.task/docs-skills/generate-os-skill-docs-from-bundled-skills/workpad.md`, `.task/tasks/docs-skills/generate-os-skill-docs-from-bundled-skills.json`, `packages/consuelo-docs/docs.json`, `packages/consuelo-docs/navigation/base-structure.json`, `packages/consuelo-docs/navigation/navigation.template.json`, `packages/consuelo-docs/os/agent-interface/call.mdx`, `packages/consuelo-docs/os/agent-interface/get-dev-steering.mdx`, `packages/consuelo-docs/os/agent-interface/get-steering.mdx`, `packages/consuelo-docs/os/agent-interface/permissions.mdx`, `packages/consuelo-docs/os/agent-interface/steering-files.mdx`, `packages/consuelo-docs/os/agent-interface/tool-manifest.mdx`, `packages/consuelo-docs/os/data-layer/data-model-as-os-ontology.mdx`, `packages/consuelo-docs/os/data-layer/decision-engine.mdx`, `packages/consuelo-docs/os/data-layer/graphql-facades.mdx`, `packages/consuelo-docs/os/data-layer/structured-queries.mdx`, `packages/consuelo-docs/os/data-layer/vectorized-context.mdx`, `packages/consuelo-docs/os/integrations/ghl.mdx`, `packages/consuelo-docs/os/integrations/google-ads.mdx`, `packages/consuelo-docs/os/integrations/meta-ads.mdx`, `packages/consuelo-docs/os/integrations/s3-s3-files.mdx`, `packages/consuelo-docs/os/integrations/sentry-posthog.mdx`, `packages/consuelo-docs/os/integrations/stripe.mdx`, `packages/consuelo-docs/os/integrations/supabase-auth.mdx`, `packages/consuelo-docs/os/integrations/twilio.mdx`, `packages/consuelo-docs/os/overview/architecture.mdx`, `packages/consuelo-docs/os/overview/core-concepts.mdx`, `packages/consuelo-docs/os/overview/quickstart.mdx`, `packages/consuelo-docs/os/overview/what-is-consuelo-os.mdx`, `packages/consuelo-docs/os/pilot/demo-flow.mdx`, `packages/consuelo-docs/os/pilot/insurance-revenue-workspace.mdx`, `packages/consuelo-docs/os/pilot/setup-checklist.mdx`, `packages/consuelo-docs/os/pilot/success-criteria.mdx`, `packages/consuelo-docs/os/runtime/bun-runtime.mdx`, `packages/consuelo-docs/os/runtime/operator-scripts.mdx`, `packages/consuelo-docs/os/runtime/package-scripts-vs-mcp-tools.mdx`, `packages/consuelo-docs/os/runtime/sandbox-executor.mdx`, `packages/consuelo-docs/os/runtime/scheduled-runbooks.mdx`, `packages/consuelo-docs/os/skills/browser.mdx`, `packages/consuelo-docs/os/skills/consuelo-design-landing-page.mdx`, `packages/consuelo-docs/os/skills/consuelo-design.mdx`, `packages/consuelo-docs/os/skills/consuelo-workspace-snapshot.mdx`, `packages/consuelo-docs/os/skills/daily-revenue-brief.mdx`, `packages/consuelo-docs/os/skills/debugger.mdx`, `packages/consuelo-docs/os/skills/handoff.mdx`, `packages/consuelo-docs/os/skills/planned/campaign-brief.mdx`, `packages/consuelo-docs/os/skills/planned/daily-revenue-brief.mdx`, `packages/consuelo-docs/os/skills/planned/follow-up-generator.mdx`, `packages/consuelo-docs/os/skills/planned/google-ads-review.mdx`, `packages/consuelo-docs/os/skills/planned/landing-page-builder.mdx`, `packages/consuelo-docs/os/skills/planned/lead-prioritizer.mdx`, `packages/consuelo-docs/os/skills/planned/meta-ads-review.mdx`, `packages/consuelo-docs/os/skills/planned/post-call-analysis.mdx`, `packages/consuelo-docs/os/skills/planned/sales-coaching.mdx`, `packages/consuelo-docs/os/skills/planned/weekly-manager-report.mdx`, `packages/consuelo-docs/os/skills/research-ingest.mdx`, `packages/consuelo-docs/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/os/skills/skill-creator.mdx`, `packages/consuelo-docs/os/skills/task.mdx`, `packages/consuelo-docs/os/workspace-filesystem/artifacts.mdx`, `packages/consuelo-docs/os/workspace-filesystem/local-development-filesystem.mdx`, `packages/consuelo-docs/os/workspace-filesystem/overview.mdx`, `packages/consuelo-docs/os/workspace-filesystem/reports.mdx`, `packages/consuelo-docs/os/workspace-filesystem/runbook-outputs.mdx`, `packages/consuelo-docs/os/workspace-filesystem/s3-files-production-target.mdx`, `packages/consuelo-docs/package.json`, `packages/consuelo-docs/scripts/generate-os-skill-docs.ts`, `packages/consuelo-docs/scripts/validate-os-docs.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
