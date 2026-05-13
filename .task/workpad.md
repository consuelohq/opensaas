# polish consuelo wiki archive rows

branch: `task/workspace-agents/polish-consuelo-wiki-archive-rows`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/381
started: 2026-05-13

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

- [x] Remove visible artifact path text from Consuelo Wiki rows while preserving links through the row title href.
- [x] Keep title and date visible.
- [x] Preserve template/category data attributes for filtering.

## validation

- Read `AGENTS.md` and `CODING-STANDARDS.md`.
- Ran fake Tailscale publish and confirmed the generated index includes the link href but no visible `<p>` path row or `.post-item p` styling.
- `bun --check packages/workspace/scripts/consuelo-design.ts` passed.
- `git diff --check` passed.
- `bun run consuelo-design check --json` passed.

## live archive repair notes

- Rebuilt the broken Prospect Theory artifact from the saved Daily Deep Idea context lesson and republished it to `/daily-deep-idea/2026-05-11-prospect-theory-analysis-decision-risk`.
- Removed the broken duplicate Bayes entry at `/daily-deep-idea/2026-05-12-an-essay-towards-solving-a-problem-in-the-doctrine-of-chances` from the live archive JSON.
- Regenerated the live `/design-wiki` index to show only title and date.
