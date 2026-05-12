# redesign consuelo wiki index

branch: `task/workspace-agents/redesign-consuelo-wiki-index`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/379
started: 2026-05-12

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [x] Redesign `/design-wiki` as a narrow Astro Paper-style Consuelo Wiki index.
- [x] Keep filter behavior while moving filters into the compact hero row.
- [x] Hide research-packet entries from the home index while preserving archive routes and metadata.
- [x] Remove visible category/template pills from artifact list rows.
- [x] Clean Daily Deep Idea display titles to show the paper title only.
- [x] Use dotted underline hover states for titles, nav links, and filter controls.
- [x] Rename user-facing wiki copy to Consuelo Wiki.

## files changed

- `packages/workspace/scripts/consuelo-design.ts`
- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/README.md`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/research.md`
- `packages/consuelo-design/templates/digital-eguides/plan.md`

## validation

- Read `AGENTS.md` and `CODING-STANDARDS.md` before editing.
- Read `packages/workspace/scripts/consuelo-design.ts` archive generation and publish flow.
- Ran fake Tailscale publish against a sample Daily Deep Idea artifact; generated index included `Consuelo Wiki`, stripped the Daily Deep Idea prefix, omitted visible template/category pills, and included dotted underline CSS.
- `bun --check packages/workspace/scripts/consuelo-design.ts` passed.
- `git diff --check` passed.
- `bun run consuelo-design check --json` passed.
