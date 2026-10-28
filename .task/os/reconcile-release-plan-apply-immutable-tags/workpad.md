# reconcile release plan apply immutable tags

branch: `task/os/reconcile-release-plan-apply-immutable-tags`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1735/reconcile-release-plan-apply-immutable-tags
github pr: https://github.com/consuelohq/opensaas/pull/1735
started: 2026-07-29

## acceptance criteria

- [x] Apply validates the approved version against the union of authoritative R2 state tags and a fresh GitHub immutable-tag snapshot.
- [x] The publish job re-reads remote `consuelo-os-v*` tags immediately before apply and passes them through typed repeated CLI flags.
- [x] A partial provider attempt with remote tag `0.1.8` absent from state can safely publish `0.1.9`; omitting that external tag still fails closed at `0.1.8`.
- [x] Existing signature, digest, revision, provider idempotency, and protected-environment gates remain unchanged.
- [x] Focused red-green tests, full distribution tests, strict review, and verification pass before promotion.
- [ ] The fix reaches `main` and exact-main runtime publication succeeds.

## plan

1. Map plan/apply inputs, release version consensus, and workflow tag discovery.
2. Add core and workflow regression contracts first and record the red result.
3. Thread a fresh remote immutable-tag snapshot into apply validation and union it with state tags.
4. Validate, promote, exact-head review, merge to main, and monitor publication.

## current status

- Implementation and local validation are green. Exact-main run `30440761311` exposed the split-brain input: plan observed remote tag `0.1.8`, while apply used only R2 revision 6 and incorrectly demanded `0.1.8` instead of the approved `0.1.9`.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/scripts/release-channels.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/distribution/release-channels.test.ts`

## workspace-owned: files changed

- Release apply now accepts the same typed repeated `--immutable-tag` input used by planning.
- Publication consensus deduplicates the union of R2 state tags and freshly observed provider tags before allocating the expected SemVer.
- The credentialed publish step re-reads all `consuelo-os-v*` GitHub tags immediately before provider mutation.
- Regression coverage proves recovery from the partial `0.1.8` provider write and fails closed when provider state drifts beyond the approved version.

## workspace-owned: activity log

- RED: focused release tests failed in exactly two owned places before implementation: apply expected `0.1.8`, and the publish workflow lacked a fresh `gh api --paginate` tag snapshot.
- GREEN: `bun test tests/distribution/release-channels.test.ts tests/distribution/release-channel-workflows.test.ts` — 27 pass, 0 fail, 175 expectations.
- GREEN: `bun test tests/distribution` — 82 pass, 7 pre-existing todo, 0 fail, 427 expectations.
- GREEN: `bun run --cwd packages/os typecheck` — workspace script syntax checks passed.
- GREEN: strict review against `origin/stream/os` — 0 owned issues, 0 blocking issues.
- GREEN: workspace `verify` — publish-valid stamp written; review, registry-selected OS package gate, and database guard passed.

## workspace-owned: validation evidence

- 2026-07-29 09:58:21 `review.run`: passed — OK
- 2026-07-29 09:58:31 `verify`: passed — OK
- 2026-07-29 09:58:54 `verify`: passed — OK

## key decisions

- Re-read GitHub tags in the credentialed publish job rather than trusting plan output alone. This detects tag drift between plan and apply and fails closed.
- Keep pure release validation deterministic by passing the observed tag snapshot through `publishDevRelease` options, then unioning it with state tags.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-29 09:52:29 apply-patch: `.task/os/reconcile-release-plan-apply-immutable-tags/workpad.md`
- 2026-07-29 09:53:34 apply-patch: `packages/os/tests/distribution/release-channels.test.ts`
- 2026-07-29 09:53:34 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-07-29 09:54:09 apply-patch: `packages/os/scripts/lib/distribution/release-channels.ts`
- 2026-07-29 09:54:09 apply-patch: `packages/os/scripts/release-channels.ts`
- 2026-07-29 09:54:09 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-07-29 09:54:50 apply-patch: `packages/os/tests/distribution/release-channels.test.ts`

- 2026-07-29 09:57:50 apply-patch: `.task/os/reconcile-release-plan-apply-immutable-tags/workpad.md`

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-os-runtime-publish.yaml`, `.task/os/reconcile-release-plan-apply-immutable-tags/current.json`, `.task/os/reconcile-release-plan-apply-immutable-tags/session.json`, `.task/os/reconcile-release-plan-apply-immutable-tags/verify.json`, `.task/os/reconcile-release-plan-apply-immutable-tags/workpad.md`, `.task/tasks/os/reconcile-release-plan-apply-immutable-tags.json`, `packages/os/scripts/lib/distribution/release-channels.ts`, `packages/os/scripts/release-channels.ts`, `packages/os/tests/distribution/release-channel-workflows.test.ts`, `packages/os/tests/distribution/release-channels.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
