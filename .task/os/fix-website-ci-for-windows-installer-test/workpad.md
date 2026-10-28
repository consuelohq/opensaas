# fix website ci for windows installer test

branch: `task/os/fix-website-ci-for-windows-installer-test`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2440
started: 2026-09-10

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the platform-aware homepage installer test must remain runnable under Bun while also passing the website package's `astro check` in CI.
existing local pattern: the website CI runs `bun install --frozen-lockfile` inside `packages/consuelo-website`, then `bun run --cwd packages/consuelo-website build`; Astro checks `.ts` test files as TypeScript source.
new or changed tests: keep the existing Windows/macOS/Linux assertions, but use Node's built-in test/assert types so the website package does not depend on `bun:test` TypeScript declarations.
focused red command: `bun run --cwd packages/consuelo-website build` on current stream head.
expected red failure: Astro reports missing `bun:test` type declarations plus implicit-any platform callback parameters in `tests/install-command.test.ts`.
no-test waiver: not applicable.

## CI evidence

- Stream PR #2432 exact head `2b61bdb6db2831cbf109bb7d2b0a7e5543042ef0` failed only the website job + aggregate status at this stage.
- Rendered GitHub Actions log shows three Astro errors in `packages/consuelo-website/tests/install-command.test.ts`: TS2307 for `bun:test` and TS7006 for the two `platform` callbacks.
- Product website build succeeds in the prior task's local dependency environment; this follow-up addresses CI type resolution only.

- 2026-09-10 02:26:13 append: `.task/os/fix-website-ci-for-windows-installer-test/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-10 02:26:13 fs.write: `.task/os/fix-website-ci-for-windows-installer-test/workpad.md`
- 2026-09-10 02:27:52 fs.write: `.task/os/fix-website-ci-for-windows-installer-test/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/tests/install-command.test.ts`

- 2026-09-10 02:27:11 apply-patch: `packages/consuelo-website/tests/install-command.test.ts`
## implementation evidence

- CI RED is authoritative: GitHub website build on stream PR #2432 reported TS2307 for `bun:test` plus two TS7006 callback errors in `tests/install-command.test.ts`.
- Local task dependency tree contains extra root Bun types, so once package-local Astro was linked it could not reproduce the fresh-CI type error; this environment mismatch is recorded rather than treated as contradictory evidence.
- Fix uses only built-in `node:test` and `node:assert/strict`; no dependency changes.
- Bun compatibility probe confirmed `node:test` is recognized by Bun's test runner.
- Focused runtime test: 7/7 pass with `bun test packages/consuelo-website/tests/install-command.test.ts`.
- Exact website build command passes: `bun run --cwd packages/consuelo-website build`; Astro result 0 errors / 0 warnings / 23 existing hints, then 24 pages built.
- Only product file changed is the test source; platform-selection behavior and installer implementation remain unchanged.

- 2026-09-10 02:27:52 append: `.task/os/fix-website-ci-for-windows-installer-test/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 02:28:23 `review.run`: passed — OK
- 2026-09-10 02:29:40 `verify`: passed — OK
