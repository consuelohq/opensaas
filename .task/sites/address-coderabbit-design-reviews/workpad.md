# address coderabbit design reviews

branch: `task/sites/address-coderabbit-design-reviews`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1249/address-coderabbit-design-reviews
github pr: https://github.com/consuelohq/opensaas/pull/1249
started: 2026-06-28

## acceptance criteria

- [x] Fix all four actionable CodeRabbit comments on stream/sites PR #1246.
- [x] Keep the task scoped to CodeRabbit review fixes only.
- [x] Preserve website design-system contracts and public route behavior.
- [x] Validate with focused website structure tests, website build, design check, review, and verify.

## plan

1. Add focused structure assertions that fail on the four review findings.
2. Patch the docs/CSS/layout issues minimally.
3. Run focused tests and broader website/design validation.
4. Push task branch and promote into stream/sites.

## current status

- CodeRabbit comments fixed. Focused tests, website build, consuelo-design checks, review, and verify are green. Ready to push/promote.

## Test-first contract

Behavior under test:
- `areas/consuelo-design/AGENTS.md` consistently names `office.generateDigitalEguide` and says `generate <workflow>` is headless by default unless `live: true` is explicit.
- `MarketingLayout.astro` consumes `--site-*` tokens rather than defining a parallel `--launch-*` theme system.
- `tokens.css` quotes all non-generic font family names so stylelint value-keyword-case does not fail.
- `.site-field` exposes a strong `:focus-visible` outline and does not remove focus visibility.

Existing local pattern to follow:
- `packages/consuelo-website/tests/website-structure.test.js` owns structural website/design contracts.
- Existing token/primitives files are the source of truth for website shell values.

New or changed tests:
- Extend `website-structure.test.js` with CodeRabbit contract assertions covering docs naming, token font quoting, focus-visible styles, and MarketingLayout `--launch-*` removal.

Focused red command:
- `bun test packages/consuelo-website/tests/website-structure.test.js`

Expected red failure:
- Current code should fail because `areas/consuelo-design/AGENTS.md` still mentions `consueloDesign.generateDigitalEguide` and live-session default text, `MarketingLayout.astro` still defines/uses `--launch-*`, `tokens.css` has unquoted non-generic font families, and `.site-field:focus` removes the outline.

## files changed

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/consuelo-website/src/styles/primitives.css`
- `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: `bun test packages/consuelo-website/tests/website-structure.test.js` failed after adding CodeRabbit contract assertions because the old docs, `--launch-*` layout tokens, unquoted font families, and weak field focus style were still present.
- Green: `bun test packages/consuelo-website/tests/website-structure.test.js` passed — 11 tests, 211 assertions.
- Green: `bun run --cwd packages/consuelo-website build` passed — Astro check/build completed with 0 errors and generated 94 pages.
- Green: `bun run --cwd packages/consuelo-design check` passed.
- Green: `bun run --cwd packages/consuelo-design get-design-system` passed.
- Green: `review.run --base origin/stream/sites` passed with 0 issues from this change. Existing workspace finding remains: no Nx project has a `typecheck` target.
- Green: `verify --base origin/stream/sites` passed and wrote a publish-valid stamp.
- 2026-06-28 02:43:23 `review.run`: passed — OK
- 2026-06-28 02:43:40 `verify`: passed — OK

## key decisions

- Treat all four CodeRabbit findings as valid.
- Keep compatibility class names such as `.launch-shell` for this narrow review-fix task, but remove the parallel `--launch-*` theme variables and map the shell to `--site-*` tokens.
- Add shell-only visual tokens to `tokens.css` rather than reintroducing raw palette/shadow values inside `MarketingLayout.astro`.

## notes for ko

- The MarketingLayout class namespace still has `.launch-*` class names for compatibility. The old `--launch-*` design token namespace is removed from the layout.

## improvements noticed

- none yet

## issues and recovery

- Initial inline edit failed because unescaped backticks inside a JavaScript template literal broke the code-call payload; retried with Python string editing.

---

## publish checklist

```bash
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/sites/address-coderabbit-design-reviews/current.json`, `.task/sites/address-coderabbit-design-reviews/session.json`, `.task/sites/address-coderabbit-design-reviews/workpad.md`, `.task/tasks/sites/address-coderabbit-design-reviews.json`, `areas/consuelo-design/AGENTS.md`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/styles/primitives.css`, `packages/consuelo-website/src/styles/tokens.css`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
