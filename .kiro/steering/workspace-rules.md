---
description: opensaas by consuelo's workspace rules — coding standards, git hooks, and quality enforcement. read before writing any code.
inclusion: auto
---

# opensaas by consuelo's workspace rules

## repo structure

monorepo with 9 packages: cli, api, dialer, coaching, contacts, analytics, sdk, metering, workspace, logger.
branch: `phase2-code-quality` is the active dev branch. PR #4 on github.

## coding standards — MANDATORY

read `CODING-STANDARDS.md` at repo root for full details. these are the 16 rules enforced by `scripts/code-review.sh` (also `npm run review`) on all changed .ts/.tsx files across all packages:

1. **LOGGING** — never use `console.*`. use structured logger. exceptions: `packages/cli/src/output.ts` and `packages/logger/src/**/*.ts`
2. **SENTRY** — every HTTP error (4xx/5xx) and caught exception must have `Sentry.captureException()` or `Sentry.captureMessage()` within 10 lines
3. **PHONE_NORM** — all `.phone ===` or `.phoneNumber ===` comparisons must use `normalizePhone()` from `@consuelo/contacts`
4. **SQL_PARAM** — never use template literals in `.query()` calls. always parameterized: `$1, $2`
5. **ERROR_HANDLING** — every `async` function with `await` must have `try/catch` within 30 lines
6. **TYPE_SAFETY** — no `: any`, `as any`, or `<any>` without a `// HACK:` comment on the same or previous line
7. **SECRETS** — no hardcoded API keys, tokens, or passwords (skips `process.env` and type annotations)
8. **TODO_FIXME** — bare `TODO` or `FIXME` must include a ticket reference like `DEV-123`
9. **IMPORT_SAFETY** — no wildcard `import *` (except builtins like fs, path, os and Sentry)
10. **ROUTE_ORDER** — literal routes must come before param routes (`:id`) in the same prefix group
11. **CATCH_TYPING** — `catch (err)` must have `: unknown` type annotation
12. **OPTIONAL_IMPORT** — `peerDependencies` must use lazy `await import()`, never top-level `import`
13. **STUB_HANDLER** — route handlers must return real data or explicit 501, not hardcoded fakes
14. **SPEC_COMPLIANCE** — changed files must match the original prompt/spec (confirmation required)
15. **ESLINT** — all changed files must pass eslint (includes lingui/no-unlocalized-strings, no-hardcoded-colors, import restrictions, and all configured rules)
16. **TYPECHECK** — affected packages must pass `npx nx typecheck` with no errors

## git hooks (husky)

### pre-commit (`.husky/pre-commit`)
runs `npx eslint` + `tsc --noEmit` on staged `.ts` files. catches console usage, sql injection patterns, explicit any, and type errors.

### pre-push (`.husky/pre-push`)
runs `scripts/code-review.sh` — all 16 mandatory checks above against changed .ts/.tsx files vs `origin/main` across all packages. blocks push on any violation.

## eslint config (`eslint.config.js`)

flat config with `typescript-eslint`. key rules:
- `no-console: 'error'` (off for output.ts and logger)
- `no-restricted-syntax` blocks template literals in `.query()` calls and untyped catch params
- `@typescript-eslint/no-explicit-any: 'error'`
- `@typescript-eslint/no-floating-promises: 'error'`

## when writing code in this repo

- always use the structured logger, never console
- parameterize all sql queries
- wrap async functions in try/catch with sentry tracking
- normalize phone numbers before comparison or storage
- annotate any `any` type with `// HACK:` explaining why
- run `./scripts/code-review.sh` before pushing if unsure
- commit with suelo-kiro as committer: `GIT_COMMITTER_NAME="suelo-kiro[bot]" GIT_COMMITTER_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com" git commit -m "msg"`

## commit format

```
type(scope): description
```
types: feat, fix, refactor, docs, test, chore
scopes: cli, api, dialer, coaching, contacts, analytics, sdk, metering, workspace, logger
