# restore authored os docs and proper skill rendering

branch: `task/docs-repair/restore-authored-os-docs-and-proper-skill-rendering`
stream: `stream/docs-repair`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/762/restore-authored-os-docs-and-proper-skill-rendering
github pr: https://github.com/consuelohq/opensaas/pull/762
started: 2026-06-05

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

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
bun run task:push -- --message "type(docs-repair): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-docs/docs.json`
- `packages/consuelo-docs/l/fr/os/overview.mdx`
- `packages/consuelo-docs/os/skills/consuelo-design.mdx`
- `packages/consuelo-docs/scripts/generate-docs-json.ts`
- `packages/consuelo-docs/scripts/validate-os-docs.ts`

## corrective investigation

The docs-404 patch generated placeholder pages for nav paths instead of restoring authored OS docs. The authored OS docs already existed in history under `os/overview.mdx`, `os/how-it-works.mdx`, `os/glossary.mdx`, and `os/concepts/*.mdx` from `task/os/replace-shallow-os-docs-with-real-docs`.

The mismatch was navigation pointing to paths such as `os/overview/what-is-consuelo-os`, `os/agent-interface/get-steering`, and `os/runtime/bun-runtime` without authored pages at those paths.

## corrective implementation

- Restored authored OS overview, how-it-works, glossary, and concept docs.
- Rewired OS navigation to authored docs plus generated Skills pages.
- Removed Runbooks from visible nav and kept Skills.
- Kept installed skills alphabetical and kept planned skills as planned pages.
- Replaced old placeholder routes with redirects to real docs.
- Reworked skill docs generation so skill bodies render as normal Markdown pages, not one large copy block.
- Added validation to fail if generated placeholder copy remains.

## validation

- `yarn docs:generate-os-skill-docs`
- `yarn docs:generate`
- `yarn docs:check-os-skill-docs`
- `yarn docs:validate-os-docs`
- CI-style MDX lint for English and localized OS docs
- generator/validator ESLint
- `git diff --check`
