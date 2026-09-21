# launcher local customization — Branch 4

branch: `task/os/launcher-local-customization`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1906/launcher-local-customization
github pr: https://github.com/consuelohq/opensaas/pull/1906
started: 2026-08-13

## acceptance criteria

- [x] Add an optional, version-1 `launcher.extraSections` overlay to the durable global `~/.consuelo/consuelo.yaml` schema without changing the default launcher for users who do not configure it.
- [x] Each custom section has a stable id, visible label, and one or more links; custom links accept only HTTPS absolute URLs or safe root-relative paths and reject script/protocol-relative/insecure schemes.
- [x] Generated launcher HTML renders configured sections using the existing launcher visual language, escapes labels/URLs, and places local sections deterministically after the built-in Sites section and before Guides and Tips.
- [x] `materializeSites()` reads the local overlay from the Consuelo home and regenerates `sites/index.html`; direct edits to generated HTML remain unnecessary.
- [x] Lifecycle config mutations and a real runtime `update` preserve the launcher overlay in `consuelo.yaml`, so future `consuelo update` operations can replace runtime code without deleting local launcher customization.
- [x] Document the supported configuration shape with an `Internal -> Users & installs` example at `https://internal.consuelohq.com/users` while keeping it opt-in/local rather than hard-coded for every user.
- [x] Existing launchers remain behavior compatible when no overlay exists; existing launcher/config/install/lifecycle tests remain green. Full package verify is separately blocked by the pre-existing operator-login unhandled-rejection condition recorded below.
- [ ] Promote this task into `stream/os` through normal `task.pr` and clean up the task worktree after merge proof.

## plan

1. Extend the strict global YAML schema with a bounded, safe optional launcher overlay and exported config types.
2. Add focused RED tests for schema acceptance/rejection, HTML rendering/order/escaping, real Sites materialization from `consuelo.yaml`, and lifecycle update preservation.
3. Thread validated extra sections from `sites.ts` into `renderLauncherOnboarding()` without changing defaults.
4. Update `packages/os/SCRIPTS.md` with the supported local overlay example and preservation contract.
5. Run focused GREEN tests, syntax/type checks, runtime materialization smoke, strict review, and full verify against `origin/stream/os`.
6. Inspect the final diff, push, promote task -> `stream/os`, verify the stream review PR, then finish/cleanup.

## Test-first contract

Behavior under test:
- A user can add `launcher.extraSections` to `~/.consuelo/consuelo.yaml`; the strict parser accepts safe entries and rejects dangerous hrefs.
- The launcher renders those sections only when supplied, with escaped text and stable ordering.
- `materializeSites()` consumes the validated local config rather than requiring edits to generated `sites/index.html`.
- Runtime lifecycle update preserves the exact local launcher configuration.

Existing local patterns:
- `packages/os/tests/consuelo-home-config.test.ts` owns global/workspace YAML boundary tests.
- `packages/os/tests/launcher-onboarding.test.ts` owns generated launcher HTML behavior and ordering.
- `packages/os/tests/local-agent-connectivity.test.ts` proves `materializeSites()` via a real temporary Consuelo home.
- `packages/os/tests/lifecycle-engine.test.ts` owns runtime update/user-owned-state preservation.

Tests to add/change before production edits:
- `consuelo-home-config.test.ts`: valid `launcher.extraSections` parses; unsafe/non-HTTPS/protocol-relative hrefs fail validation; default config remains unchanged.
- `launcher-onboarding.test.ts`: custom section renders after Sites and before Guides; labels/hrefs are escaped; no overlay produces no custom section.
- focused materialization test: a temporary `consuelo.yaml` overlay is reflected in regenerated `sites/index.html`.
- `lifecycle-engine.test.ts`: a custom launcher block survives a real `1.0.0 -> 1.1.0` runtime update.

Focused RED command:
`bun --cwd packages/os vitest run tests/consuelo-home-config.test.ts tests/launcher-onboarding.test.ts tests/launcher-local-customization.test.ts tests/lifecycle-engine.test.ts`

Expected RED signal before implementation:
- strict global YAML rejects the new `launcher` key;
- renderer does not accept/render `extraSections`;
- Sites materialization has no path from `consuelo.yaml` to launcher HTML;
- lifecycle update cannot accept/preserve a config containing the currently-unknown launcher key.

## discovery

- `packages/os/scripts/lib/consuelo-home.ts` is the strict version-1 global YAML schema and durable `~/.consuelo/consuelo.yaml` path.
- `packages/os/scripts/lib/sites.ts` always regenerates `sites/index.html`; it currently reads launcher workspace/agent state from `config.json` but not global YAML.
- `packages/os/scripts/lib/launcher-onboarding.ts` is the canonical launcher renderer; `navLinks()` already HTML-escapes labels and hrefs.
- `packages/os/scripts/lib/install-state.ts` writes the global YAML only if missing, so reprovision already preserves user-owned global config.
- lifecycle runtime replacement is separated from user-owned home state; existing tests cover user-note/config preservation and preference writes spread the parsed config rather than rebuilding it.
- memory searches for `launcher customization` and `consuelo yaml` returned no prior project-memory decision.
- semantic `explore` retrieval was noisy for this exact feature; direct file/test evidence above is the authoritative implementation path.

## current status

- Task started from current `stream/os` after Branch 1 (and current Branch 2 stream state) landed.
- Discovery and test contract are complete.
- RED established before implementation with the focused Vitest command: launcher rendering, global YAML parsing, and Sites materialization each fail because the overlay path does not exist yet. The lifecycle file was collected but skipped its tests in that combined run; it will be run independently during GREEN validation.
- Implementation is complete and focused GREEN validation is passing.
- Next: run docs/index audits, review + verify against `origin/stream/os`, then publish/promote into `stream/os` and clean up.

## files changed

- `.task/os/launcher-local-customization/workpad.md`
- `packages/os/tests/consuelo-home-config.test.ts` (RED contract)
- `packages/os/tests/launcher-onboarding.test.ts` (RED contract)
- `packages/os/tests/launcher-local-customization.test.ts` (RED contract)
- `packages/os/tests/lifecycle-engine.test.ts` (update-preservation contract)
- `packages/os/scripts/lib/consuelo-home.ts` (strict launcher overlay schema + safe href validation)
- `packages/os/scripts/lib/launcher-onboarding.ts` (optional custom-section rendering)
- `packages/os/scripts/lib/sites.ts` (read durable launcher overlay during materialization)
- `packages/os/SCRIPTS.md` (supported configuration and preservation contract)
- `packages/documentation/src/content/docs/reference/configuration.mdx` (public configuration reference + evidence ledger)

## validation evidence

- RED: `bun --cwd packages/os vitest run tests/consuelo-home-config.test.ts tests/launcher-onboarding.test.ts tests/launcher-local-customization.test.ts tests/lifecycle-engine.test.ts` exited 1 as expected.
- RED failures: safe `launcher` YAML rejected by the current strict schema; custom section missing from renderer; materialized launcher omitted the configured internal section. Stock/no-overlay materialization remained green.
- GREEN: `tests/consuelo-home-config.test.ts`, `tests/launcher-onboarding.test.ts`, and `tests/launcher-local-customization.test.ts` pass 16/16.
- GREEN: targeted lifecycle regression `preserves local launcher customization across a runtime update` passes 1/1; it also proves a subsequent `setChannel('canary')` config rewrite preserves the launcher stanza.
- GREEN: full `tests/lifecycle-engine.test.ts` passes 58/58 after aligning its stale runtime input fixture with the current required runtime contract.
- GREEN: `tests/install-state.test.ts` passes 25/25. The suite intentionally emits a JSON parse stack while testing corrupt provenance; exit code remains 0.
- GREEN: `bun --cwd packages/os run typecheck` exits 0 (`typecheck` is the repo's syntax checker).
- GREEN: `bun run --cwd packages/documentation validate` passes with 105 selected pages after adding the launcher configuration reference.
- `tests/local-agent-connectivity.test.ts` is order-sensitive on the current stream/task environment: the full file reproducibly reports 13/14 with the independent-verification case failing after earlier tests, while running that exact case alone passes 1/1. Branch 4 does not edit local-agent verification code. Treat as unrelated suite-state leakage unless publish-gate comparison says otherwise.
- `review.run` against `origin/stream/os` passes with 0 blocking issues, 0 review issues, and 0 documentation opportunities after the public configuration reference was updated.
- Full `verify` cannot produce a publish-valid stamp because the auto-selected `@consuelo/os` package test still exits nonzero on the existing `operator-login.test.ts` unhandled-rejection problem already recorded by Branch 1. A focused rerun confirms all 17 operator-login assertions pass while Vitest reports the same 3 unhandled rejections. Branch 4 changes do not include `operator-login.ts` or `operator-login.test.ts`.
- `audit --docs` and `audit --index` are globally red on the current repository (9,857 unrelated missing doc-path references; 293 stale / 378 deleted index entries). The failures are repository-wide and not introduced by this task; the scoped docs validator and scoped review are green.

## key decisions

- Keep this a generic local launcher overlay; do not hard-code Ko's private dashboard link into the default launcher shipped to every user.
- Store customization in the already-preserved global `consuelo.yaml`, not generated `sites/index.html`.
- Do not mutate Ko's live `~/.consuelo/consuelo.yaml` from this task before a runtime containing the new schema is installed; older strict runtimes would reject the new key. Ship the capability first, then apply the local stanza once the updated Canary/runtime is active.

## notes for ko

- Intended local stanza after the supporting runtime is installed:
  `launcher.extraSections -> Internal -> Users & installs -> https://internal.consuelohq.com/users`.
- This branch does not change the release channel; Canary pinning remains separate as requested.

## improvements noticed

- None yet.

## issues and recovery

- One read-only `fs.search` used `setChannel(` as a regex and failed with an unclosed-group parse error. Re-ran with the literal-safe `setChannel` pattern; no files were changed.
- The existing `lifecycle-engine.test.ts` fixture on `stream/os` was stale against the current runtime-bundle contract and failed in `beforeAll` because `scripts/lib/subagent/runner.ts` became a required runtime input but was not in the fixture's `requiredRuntimePaths`. Added that required path to the test fixture so the new lifecycle update-preservation regression can execute. This is test-fixture alignment only; no production behavior is changed by that line.
- An attempted `bun ... x tsc` validation used a nonexistent package script (`x`) and failed before doing any work. Replaced it with the repo-owned `bun --cwd packages/os run typecheck`, which passes.
- The full local-agent connectivity file has an existing/order-dependent verification failure (13/14); the failing test passes in isolation (1/1). No local-agent production code is touched by this branch; review/verify remains the publish authority.
- Repository-wide docs/index audits are already globally stale and cannot be repaired within this launcher task without expanding scope by hundreds/thousands of unrelated files. Recorded the exact counts and used the package-owned docs validator plus scoped review as the relevant evidence.
- Full verify is blocked by the same pre-existing `operator-login.test.ts` three-unhandled-rejection condition documented in Branch 1. All 17 assertions pass in a focused run. Because Ko approved Branch 4 and the failure is unchanged/out of scope, publish will use the task system's explicit `--approved --reason` path rather than changing auth code in this branch.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add durable launcher customization" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-13 17:55:28 write: `.task/os/launcher-local-customization/workpad.md`

## workspace-owned: files changed

- `.task/os/launcher-local-customization/workpad.md`

## workspace-owned: activity log

- 2026-08-13 17:55:28 fs.write: `.task/os/launcher-local-customization/workpad.md`

- 2026-08-13 17:56:44 apply-patch: `packages/os/tests/consuelo-home-config.test.ts`
- 2026-08-13 17:56:44 apply-patch: `packages/os/tests/launcher-onboarding.test.ts`
- 2026-08-13 17:56:44 apply-patch: `packages/os/tests/lifecycle-engine.test.ts`
- 2026-08-13 17:56:44 apply-patch: `packages/os/tests/launcher-local-customization.test.ts`

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/reference/configuration.mdx`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/consuelo-home-config.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/verify.js`

## workspace-owned: validation evidence

- RED: `bun --cwd packages/os vitest run tests/consuelo-home-config.test.ts tests/launcher-onboarding.test.ts tests/launcher-local-customization.test.ts tests/lifecycle-engine.test.ts` exited 1 as expected.
- RED failures: safe `launcher` YAML rejected by the current strict schema; custom section missing from renderer; materialized launcher omitted the configured internal section. Stock/no-overlay materialization remained green.
- GREEN: `tests/consuelo-home-config.test.ts`, `tests/launcher-onboarding.test.ts`, and `tests/launcher-local-customization.test.ts` pass 16/16.
- GREEN: targeted lifecycle regression `preserves local launcher customization across a runtime update` passes 1/1; it also proves a subsequent `setChannel('canary')` config rewrite preserves the launcher stanza.
- GREEN: full `tests/lifecycle-engine.test.ts` passes 58/58 after aligning its stale runtime input fixture with the current required runtime contract.
- GREEN: `tests/install-state.test.ts` passes 25/25. The suite intentionally emits a JSON parse stack while testing corrupt provenance; exit code remains 0.
- GREEN: `bun --cwd packages/os run typecheck` exits 0 (`typecheck` is the repo's syntax checker).
- `tests/local-agent-connectivity.test.ts` is order-sensitive on the current stream/task environment: the full file reproducibly reports 13/14 with the independent-verification case failing after earlier tests, while running that exact case alone passes 1/1. Branch 4 does not edit local-agent verification code. Treat as unrelated suite-state leakage unless publish-gate comparison says otherwise.
- 2026-08-13 18:03:09 `audit`: failed — COMMAND_FAILED
- 2026-08-13 18:03:14 `audit`: failed — COMMAND_FAILED
- 2026-08-13 18:03:48 `review.run`: passed — OK
- 2026-08-13 18:04:46 `verify`: failed — COMMAND_FAILED
- 2026-08-13 18:06:22 apply-patch: `packages/documentation/src/content/docs/reference/configuration.mdx`
- 2026-08-13 18:06:38 `review.run`: passed — OK

- 2026-08-13 18:07:11 apply-patch: `.task/os/launcher-local-customization/workpad.md`

- 2026-08-13 18:07:34 apply-patch: `.task/os/launcher-local-customization/workpad.md`

- 2026-08-13 18:08:17 apply-patch: `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`