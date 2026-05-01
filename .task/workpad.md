# fix themed settings buttons

branch: `task/dialer/fix-themed-settings-buttons`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/262
started: 2026-05-01

## acceptance criteria

- [x] Replace the custom Add Number button with the shared themed `Button`.
- [x] Align image upload/remove buttons with the same small settings-button sizing.
- [x] Keep existing phone-number and image-upload behavior unchanged.
- [x] Move touched phone-number settings copy onto Lingui macros.
- [ ] Publish the task branch for review.

## plan

1. Locate the settings button implementations from the screenshots.
2. Reuse the shared `twenty-ui/input` `Button` standard.
3. Run focused formatting, lint, and diff checks.
4. Push the task PR.

## files changed

- `packages/twenty-front/src/pages/settings/consuelo/PhoneNumberSettings.tsx`
- `packages/twenty-front/src/modules/ui/input/components/ImageInput.tsx`

## key decisions

- `PhoneNumberSettings` now uses the shared `Button` with `IconPlus`, `accent=blue`, and `size=small` instead of a local styled button.
- `ImageInput` keeps the existing secondary Upload, Remove, and Abort behavior while matching the small settings-button standard.
- The phone-number action icons now import from `twenty-ui/display` instead of restricted direct Tabler imports.

## notes for ko

- Targeted typecheck is blocked by pre-existing `twenty-shared` strict type errors in relative date filter utilities.
- Targeted ESLint passes when the existing Nx module-boundaries rule is disabled; with the rule on, it reports the repo-existing `twenty-ui` import-boundary issue in these files.

## improvements noticed

- The old custom Add Number button duplicated theme logic already handled by `twenty-ui/input` `Button`.

## errors i ran into

- `stream.sync` could not force-update `stream/dialer` while the stream worktree was checked out, but `stream.context` showed `stream/dialer` was already even with remote.
- `workspace review.run` timed out before returning a structured result.

## validation

- passed: `npx prettier --check packages/twenty-front/src/pages/settings/consuelo/PhoneNumberSettings.tsx packages/twenty-front/src/modules/ui/input/components/ImageInput.tsx`.
- passed: `git diff --check`.
- passed: `npx eslint --config packages/twenty-front/eslint.config.mjs --rule @nx/enforce-module-boundaries: off packages/twenty-front/src/pages/settings/consuelo/PhoneNumberSettings.tsx packages/twenty-front/src/modules/ui/input/components/ImageInput.tsx`.
- blocked: `npx eslint --config packages/twenty-front/eslint.config.mjs ...` reports existing `@nx/enforce-module-boundaries` issues on `twenty-ui` imports in touched files.
- blocked: `npx nx typecheck twenty-front` fails in `twenty-shared` relative date filter utilities before reaching this change.

---

## publish checklist

```bash
bun run task:push -- --message fix-dialer-themed-settings-buttons --changed
bun run task:pr
bun run task:finish
```
