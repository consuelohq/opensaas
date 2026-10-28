# Align footer assertion for image removal

branch: `task/website/align-footer-assertion-for-image-removal`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2608
started: 2026-09-29

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Follow-up scope and Test-first contract
- Behavior: the website footer source no longer includes the removed art, and existing assertions reflect the remaining footer signature placement.
- Existing pattern: `homepage-responsive.test.mjs` source assertions for `HomeCloudCta.astro`.
- Test change: update the one stale assertion that expected `bottom: 0` from the removed illustration.
- Focused red command and local check: waived under Ko's explicit instruction to skip checks for immediate website deployment. Expected old assertion would fail because the art CSS was removed.
- No-test waiver: no additional test file for this one-line correction; inspect the exact diff before promotion.

- 2026-09-29 18:00:44 append: `.task/website/align-footer-assertion-for-image-removal/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 18:00:44 fs.write: `.task/website/align-footer-assertion-for-image-removal/workpad.md`
- 2026-09-29 18:01:00 fs.write: `.task/website/align-footer-assertion-for-image-removal/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/tests/homepage-responsive.test.mjs`

- 2026-09-29 18:00:49 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
## Result
- Changed one assertion in `homepage-responsive.test.mjs` from the removed art's `bottom: 0` to the retained signature position.
- Typed `git.diff` confirms one product test line changed, plus scoped task metadata.
- Local tests/review/verify intentionally skipped under Ko's hotfix instruction; CI and production release paths may still enforce their own gates.

- 2026-09-29 18:01:00 append: `.task/website/align-footer-assertion-for-image-removal/workpad.md`
