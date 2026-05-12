# add digital eguide template flag and docs

branch: `task/workspace-agents/add-digital-eguide-template-flag-and-docs`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/374
started: 2026-05-11

## acceptance criteria

- [x] Add an optional `template` hint to the existing `consueloDesign.generateDigitalEguide` workflow.
- [x] Keep template content out of the tool manifest; manifest only carries the template name.
- [x] Support exactly `research`, `spec`, and `plan` template names.
- [x] Store Consuelo-owned Open Design e-guide templates outside the manifest and inject only the selected template into the generated prompt.
- [x] Update design/operator docs so prepared prompts are treated as the intended operator handoff.
- [x] Update workspace facade schema/manifest, generated docs/types, and script docs.
- [x] Validate direct CLI dry-runs, typed facade dry-runs, generation, check files, audit, review, and verify where feasible.

## research basis

- Research/report templates should preserve source metadata, audience, key findings, limitations, implications, and forward-looking questions.
- Spec templates should include problem/context, goals/non-goals, requirements, design, decisions, alternatives, risks, testing, rollout, and open questions.
- Plan templates should include objective, roles, scope, milestones, dependencies, risks, validation, decision log, and status/update sections.

## implementation notes

- Use the existing digital e-guide workflow; do not add new facade commands.
- The `template` flag is a routing hint to Open Design/operator work, not a separate workflow family.
- `decision` is not a standalone template. Decisions are embedded in `spec` and `plan`.

- 2026-05-12 03:47:52 patch lines 730-730: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-12 03:48:20 patch lines 120-120: `areas/consuelo-design/AGENTS.md`
- 2026-05-12 03:48:35 patch lines 120-135: `areas/consuelo-design/AGENTS.md`
- 2026-05-12 03:48:50 patch lines 136-137: `areas/consuelo-design/AGENTS.md`
## validation

- Read `AGENTS.md` and full `CODING-STANDARDS.md`.
- Read `areas/consuelo-design/AGENTS.md`, `packages/consuelo-design/README.md`, existing Open Design `digital-eguide` skill, facade schema, manifest, generated docs/types, and `consuelo-design.ts`.
- Web-researched HTML artifact patterns using Thariq's "The unreasonable effectiveness of HTML" examples, especially implementation plan and research explainer pages.
- Web-researched spec/design-doc structure, project plan structure, and research report structure from current public references.
- Added `research`, `spec`, and `plan` template files under `packages/consuelo-design/templates/digital-eguides/`.
- Added `--template <research|spec|plan>` support for `generate digital-eguide` only.
- Added `ConsueloDesignDigitalEguideInput` so the template field appears only on `consueloDesign.generateDigitalEguide`.
- `bun --check packages/workspace/scripts/consuelo-design.ts`: passed.
- `bun --check packages/workspace/scripts/lib/facade/schemas.ts`: passed.
- Direct CLI dry-run with `--template research`: passed; pending prompt includes selected template and HTML interaction pattern.
- Typed facade dry-run with `template: "spec"`: passed; project metadata includes template and pending prompt includes spec template.
- Invalid `template: "decision"`: rejected by schema with allowed values `research`, `spec`, `plan`.
- `bun run generate-docs`: passed.
- `bun run generate-types`: passed.
- `checkFiles` on TS files: passed. The first `checkFiles` attempt included Markdown files and failed because `node --check` cannot parse `.md`; reran with TS files only.
- `consuelo-design check --json`: passed.
- `audit { scripts: true }`: passed, 48 documented / 48 actual.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts`: passed, 444 tests. Existing obsolete snapshot noise remains.
- `git diff --check`: passed.
- `review.run --base origin/stream/workspace-agents --noTests`: passed.
- `verify --base origin/stream/workspace-agents --noDb`: passed and wrote task-local stamp.
