# fix add number outline button

branch: `task/dialer/fix-add-number-outline-button`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/266
started: 2026-05-01

## acceptance criteria

- [x] Verify why the previous task still showed a filled blue Add Number button.
- [x] Change Add Number to match the Upload/Remove outline button standard.
- [x] Keep size small and preserve add-number behavior.
- [ ] Publish the task branch for review.

## plan

1. Compare `PhoneNumberSettings` against `ImageInput` button props.
2. Replace `accent=blue` with `variant=secondary` after approval.
3. Run focused formatting and diff checks.
4. Push the task PR.

## files changed

- `packages/twenty-front/src/pages/settings/consuelo/PhoneNumberSettings.tsx`

## key decisions

- The previous change used shared `Button`, but left it as implicit `variant=primary` with `accent=blue`, which intentionally renders filled blue.
- Upload and Remove use `variant=secondary`; Add Number now uses that same outline/transparent standard.

## validation

- passed: `npx prettier --check packages/twenty-front/src/pages/settings/consuelo/PhoneNumberSettings.tsx`.
- passed: `git diff --check`.
- passed: `npx eslint --config packages/twenty-front/eslint.config.mjs --rule @nx/enforce-module-boundaries: off packages/twenty-front/src/pages/settings/consuelo/PhoneNumberSettings.tsx`.

---

## publish checklist

```bash
bun run task:push -- --message fix-add-number-outline-button --changed
bun run task:pr
bun run task:finish
```
