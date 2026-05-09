# DEV-1451 XSS security audit fixes

branch: `task/clean-up/dev-1451-xss-security-audit-fixes`
stream: `stream/clean-up`
pr: https://github.com/consuelohq/opensaas/pull/350
started: 2026-05-09

## acceptance criteria

- [ ] User-controlled href/to values in generic `twenty-ui` link components reject executable URL protocols: `javascript:`, `data:`, and `vbscript:`, including leading whitespace variants.
- [ ] Safe URLs still work: http, https, mailto, app-relative paths, hash links, and normal relative paths.
- [ ] File streaming endpoints add anti-XSS response headers before piping user-controlled content: `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`.
- [ ] Tests cover URL protocol sanitization and file-serving headers.
- [ ] `mailparser` and DOMPurify dependency findings are documented; no runtime dependency bump unless local versions are still vulnerable.
- [ ] Review/verification gates run or failures are recorded with trace IDs.

## plan

1. Add `sanitizeHref` under `packages/twenty-ui/src/navigation/link/utils` with a focused denylist matching the Twenty PR: leading whitespace followed by `javascript:`, `data:`, or `vbscript:`.
2. Apply `sanitizeHref` at generic link boundaries: `RawLink`, `ClickToActionLink`, `RoundedLink`, `ContactLink`, and `LinkChip`.
3. Add `sanitizeHref` unit tests in `twenty-ui`.
4. Add a file response security headers helper under `packages/twenty-server/src/engine/core-modules/file/utils`.
5. Call that helper from both `/files/*path` and `/files-field/:id` controllers before `fileStream.pipe(res)`.
6. Update `file.controller.spec.ts` and add `files-field.controller.spec.ts` coverage for the headers.
7. Run targeted Jest tests, typecheck/review, then publish through `task.push` and `task.pr`.

## files changed

- `packages/twenty-ui/src/navigation/link/utils/sanitizeHref.ts`
- `packages/twenty-ui/src/navigation/link/utils/__tests__/sanitizeHref.test.ts`
- `packages/twenty-ui/src/navigation/index.ts`
- `packages/twenty-ui/src/navigation/link/components/RawLink.tsx`
- `packages/twenty-ui/src/navigation/link/components/ClickToActionLink.tsx`
- `packages/twenty-ui/src/navigation/link/components/RoundedLink.tsx`
- `packages/twenty-ui/src/navigation/link/components/ContactLink.tsx`
- `packages/twenty-ui/src/components/chip/LinkChip.tsx`
- `packages/twenty-server/src/engine/core-modules/file/utils/set-file-response-security-headers.utils.ts`
- `packages/twenty-server/src/engine/core-modules/file/controllers/file.controller.ts`
- `packages/twenty-server/src/engine/core-modules/file/controllers/file.controller.spec.ts`
- `packages/twenty-server/src/engine/core-modules/file/files-field/controllers/files-field.controller.ts`
- `packages/twenty-server/src/engine/core-modules/file/files-field/controllers/files-field.controller.spec.ts`

## key decisions

- `mailparser` is already `3.9.1`, newer than the Twenty fix range, so this task will not bump it unless validation surfaces a current advisory conflict.
- DOMPurify runtime is already `3.2.6` or newer in the root lock, so this task focuses on executable-link and file-serving surfaces instead of a runtime dependency bump.
- The href sanitizer intentionally rejects `data:` for link hrefs. Do not reuse it blindly for image `src` values because image data URLs may have different product/security constraints.
- File-serving security headers are centralized in one helper to keep `/files` and `/files-field` consistent.

## notes for ko

- Task started through workspace task flow as PR 350.
- `task.start` reported `sourceBranch: main`; `stream/clean-up` was at ahead 0 / behind 0, so the effective code base was aligned.

## improvements noticed

- Existing file controllers use `as any` for `workspaceId`; left for minimal scope unless review requires cleanup.

## errors i ran into

- `fs.read` and `task.exec` facade calls require `taskSession` instead of only `branch` in this tool session. I am using task session `tsk_e811c25fa5cd` for task-scoped calls.
- Decision engine returned noisy website/security-policy results for this task; implementation targets are based on explicit Twenty diff review plus direct file reads.

---

## publish checklist

```bash
bun run task:push -- --message "fix(clean-up): harden hrefs and file streaming" --changed
bun run task:pr
bun run task:finish
```

## validation results

- PASS: `npx jest packages/twenty-ui/src/navigation/link/utils/__tests__/sanitizeHref.test.ts --config=packages/twenty-ui/jest.config.mjs --runInBand`
  - Trace: `trc_6d3bb75492cf`
  - Result: 12 tests passed.
- PASS: static file checks for changed `.ts` server and sanitizer files through `checkFiles`.
  - Trace: `trc_99d3f6313d11`
- PASS: focused grep assertions confirmed touched generic link components call `sanitizeHref`, and both file controllers call `setFileResponseSecurityHeaders`.
  - Trace: `trc_3df2b68a86aa`
- BLOCKED: server controller Jest cannot run in the current task worktree because `@nestjs/testing` cannot resolve from `node_modules`.
  - Trace: `trc_0239308f0ee4`
  - Existing server specs already import `@nestjs/testing`, so this is an environment/dependency availability blocker rather than a new test syntax failure.
- BLOCKED: workspace `review.run`, direct review script invocation, lint command, and whitespace diff check were blocked before execution by the platform safety layer.
