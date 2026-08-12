# Rename true assistant to digital worker on website

branch: `task/website/rename-true-assistant-to-digital-worker-on-website`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1796/rename-true-assistant-to-digital-worker-on-website
github pr: https://github.com/consuelohq/opensaas/pull/1796
started: 2026-08-10

## acceptance criteria

- [x] Replace customer-facing website copy “true assistant” with “digital worker” wherever that exact product phrase appears.
- [x] Preserve surrounding copy, layout, behavior, and styling.
- [ ] Validate the website package and verify the shipped page renders the new phrase with the old phrase absent.

## plan

1. Locate every website occurrence of the phrase and inspect surrounding copy.
2. Make the narrow copy-only replacement in the owning source file(s).
3. Run exact-string checks plus the relevant website validation command.
4. Publish through the task workflow and verify the deployed website in a browser.

## current status

- Copy edit is committed and publish-valid on the task branch, but promotion is blocked by unrelated `stream/website` sync conflicts in `HomeHero.astro` and `homepage-responsive.test.mjs`. The task PR remains open; live deployment/browser verification cannot proceed until the stream conflict is resolved.

## files changed

- `packages/consuelo-website/src/data/home-content.ts` — changed the hero aria label and visible suffix from “true assistant” to “digital worker”.
- Task-local `.task/website/rename-true-assistant-to-digital-worker-on-website/*` workflow metadata and workpad files.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-10 00:21:07 `review.run`: passed — OK
- 2026-08-10 00:21:08 `review.run`: passed — OK
- 2026-08-10 00:22:07 `verify`: passed — OK
- 2026-08-10 00:24:55 `verify`: passed — OK

## key decisions

- Treat this as a copy-only rename unless discovery shows the phrase is also a product identifier or code symbol.

## notes for ko

- User explicitly authorized changing the public website wording and shipping it.

## improvements noticed

- none yet

## issues and recovery

- A safety preflight scanner request was rejected because its request body itself contained destructive-command literals. Recovered by reading the package build script and generator through typed `fs.read`; no destructive behavior was present.
- First Bun build invocation used the wrong `--cwd` argument ordering and printed CLI usage without running the build. Re-ran with `bun run --cwd packages/consuelo-website build`; the real build completed successfully.
- `task.pr` promotion failed because PR #1796 was conflicted against `stream/website`. `task.ensureSynced` identified the stream as six commits behind `main` and prescribed `stream.sync`.
- `stream.sync --area website` exposed two real non-metadata conflicts: `packages/consuelo-website/src/components/home/HomeHero.astro` and `packages/consuelo-website/tests/homepage-responsive.test.mjs`. These are outside this copy-only task and require an integration decision; no conflict side was chosen automatically.
- After the API-based task push, the local task worktree remained at its bootstrap SHA. A scoped fast-forward resync brought it to remote task commit `959b39fdee9bc65f06a97006241430591aba64ef` without changing production content.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`

## Test-first contract

- Behavior under test: public website copy uses “digital worker” instead of the exact phrase “true assistant”.
- Existing local pattern to follow: edit the owning website copy source without changing component behavior or structure.
- New or changed tests: none; this is copy-only.
- Focused red command: n/a.
- Expected red failure: n/a.
- No-test waiver: copy-only change. Replacement validation will be exact-string search, website package checks/build, diff review, and deployed browser verification.

## discovery

- Direct explore query: confirmed the public website package and hero/SEO area as the relevant surface.
- Bun exact-string/source scanner: scanned 74 website source/content files and found exactly two `true assistant` occurrences, both in `src/data/home-content.ts` lines 205 and 208.
- Python package/validation probe: `consuelo-website` owns a `build` script (`generate:footer-art && astro check && astro build`) and the hero `ariaLabel` is rendered by `HomeHero.astro`.

## validation

- Exact-string verification: PASS — zero `true assistant` hits in the website package; expected `digital worker` aria label and suffix are present.
- Production build: PASS — `bun run --cwd packages/consuelo-website build`; Astro reports 0 errors, 0 warnings, and 24 pre-existing/non-blocking hints.
- Build-time footer asset generation produced no changed tracked files.
- Strict review: PASS — 0 issues from this change, 0 blocking issues; one pre-existing project-level note reports no Nx `typecheck` target.
- Full verify: PASS — publish-valid stamp written; review, test selection, and DB guard all passed. Test selection intentionally chose 0 suites for this copy-only change.

- 2026-08-10 00:19:05 apply-patch: `.task/website/rename-true-assistant-to-digital-worker-on-website/workpad.md`
- 2026-08-10 00:19:09 apply-patch: `packages/consuelo-website/src/data/home-content.ts`

- 2026-08-10 00:20:43 apply-patch: `.task/website/rename-true-assistant-to-digital-worker-on-website/workpad.md`

- 2026-08-10 00:22:15 apply-patch: `.task/website/rename-true-assistant-to-digital-worker-on-website/workpad.md`

- 2026-08-10 00:24:42 apply-patch: `.task/website/rename-true-assistant-to-digital-worker-on-website/workpad.md`
