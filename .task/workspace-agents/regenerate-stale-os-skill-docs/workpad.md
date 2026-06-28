# Regenerate stale OS skill docs

## Goal
Clear the blocking docs-lint failure on `stream/workspace-agents` before merging PR #1208 to main.

## Evidence
GitHub Actions `docs-lint` failed on PR #1208:

```text
Error: packages/consuelo-docs/os/skills/office.mdx is stale. Run yarn docs:generate-os-skill-docs.
```

## Scope
Regenerate OS skill docs only. Do not change review.js behavior or unrelated docs structure.

## Validation plan
- Run `yarn docs:generate-os-skill-docs`.
- Run `yarn docs:check-os-skill-docs`.
- Inspect diff.
- Push/promote task PR into `stream/workspace-agents`.


## Validation evidence
- `yarn docs:generate-os-skill-docs`: passed, generated 13 skill docs.
- `yarn docs:check-os-skill-docs`: passed, checked 13 skill docs.
- Diff is generated OS skill docs and generated docs navigation only.

## Notes
This fixes the `docs-lint` failure on PR #1208. Remaining known red checks before this fix were Danger GitHub API flake and website CI asking for missing project `twenty-website`.
