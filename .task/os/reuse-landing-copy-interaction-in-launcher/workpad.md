# reuse landing copy interaction in launcher

branch: `task/os/reuse-landing-copy-interaction-in-launcher`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1927/reuse-landing-copy-interaction-in-launcher
github pr: https://github.com/consuelohq/opensaas/pull/1927
started: 2026-08-13

## acceptance criteria

- [x] The MCP URL is one unified clickable control; clicking anywhere in the block copies the URL.
- [x] The control has one intentional outer border/tactile shadow treatment and no separately boxed Copy button.
- [x] Hover and keyboard focus invert the full control background/text, following the public landing-page install control interaction.
- [x] Successful copy changes the visible label from `COPY` to `COPIED`, then resets after the same bounded 1500ms feedback window used by the landing page.
- [x] The control remains keyboard accessible and exposes copy feedback to assistive technology.
- [x] The installed/generated launcher and the Astro launcher reference source stay behaviorally aligned.
- [x] Focused launcher tests, review, and publish verification pass before promotion to `stream/os`.

## plan

1. Treat `HomeHero.astro` as the existing interaction reference: one button wrapping value + label, clipboard guard, `COPY` → `COPIED`, 1500ms reset, full-surface hover/focus treatment.
2. Encode that contract first in launcher tests for both the generated installed launcher and the Astro launcher source.
3. Replace the launcher `code + separate button` row with one button wrapping the MCP URL and feedback label; port the landing control's tactile border/shadow/transition behavior using launcher color tokens.
4. Run focused launcher/site tests and inspect the generated HTML/CSS/JS; then run review/verify and promote into `stream/os` for the next update.

## current status

- Implementation and validation are complete. The installed launcher and Astro reference now use one semantic copy button wrapping the URL + feedback label, with landing-style tactile shadow/movement, full-surface ink/paper inversion on hover/focus, clipboard guard, `COPY` → `COPIED`, and 1500ms reset. Focused launcher/site/Astro/browser proof is green, focused test-selection ownership is in place, strict review has 0 blockers, and full verify is `publishValid: true`. Ready for normal task push and promotion to `stream/os`.

## files changed

- `packages/consuelo-website/src/pages/os/launcher.astro`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/tests/launcher-astro-source.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 00:02:53 `review.run`: passed — OK
- 2026-08-14 00:04:28 `verify`: failed — COMMAND_FAILED
- 2026-08-14 00:11:30 `review.run`: passed — OK
- 2026-08-14 00:11:53 `verify`: passed — OK

## key decisions

- Reuse the landing interaction contract rather than importing the marketing component across package/runtime boundaries. The installed launcher is self-contained generated HTML, so cross-package UI imports would create the wrong dependency direction.
- Use a semantic `<button>` for the whole MCP block so pointer click, Enter, and Space activate the same copy action without extra keyboard code.
- Preserve the launcher's cream/ink visual system: the interaction geometry/feedback comes from the landing control, while hover colors invert using launcher tokens instead of importing Hermes blue.

## notes for ko

- This change is queued for the next OS update through `stream/os`; it does not publish a release or update any installed node by itself.

## improvements noticed

- none yet

## issues and recovery

- `explore` retrieval was noisy for this UI because generic button components ranked highly; targeted source scanning located the exact launcher and landing implementations instead.
- The first post-change root-level Vitest invocation made `launcher-astro-source.test.ts` resolve its intentional package-relative path from the wrong cwd. Re-running through the package's native `bun --cwd packages/os test ...` boundary passed 6/6.
- A broader `sites-cli + install-state` run produced one pre-existing/non-copy failure in `sites-cli.test.ts` expecting the old Traces page `<h1>Traces</h1>`; the 25 install-state tests passed and all three launcher materialization tests in that same suite passed. Re-running only the launcher-owned `sites-cli` cases passed 3/3.
- An initial Astro check command put `--cwd` in the wrong Bun position and failed before Astro ran. Running `bun x astro check` with the process cwd set to `packages/consuelo-website` completed with 0 errors and 0 warnings (24 existing hints).
- The first broad publish-gate run selected the historically red OS package suite before focused launcher ownership existed; that run also generated two unrelated missing `fs.list` facade snapshots. Those test-generated snapshot additions were restored exactly from task HEAD (trace `trc_9abc383cb81c`). After restoration, changed-file selection contains only workspace selector/launcher/server-CI contracts and all 7 selected suites pass (trace `trc_1c5915964026`).

## Test-first contract

- Behavior under test: one unified MCP URL copy control owns the border and click target; it exposes a `COPY` label, changes it to `COPIED` only after successful clipboard write, resets after 1500ms, and uses whole-control hover/focus styling.
- Existing local pattern: `packages/consuelo-website/src/components/home/HomeHero.astro` (`data-copy-install`, one wrapping button, clipboard availability guard, `COPIED`, 1500ms reset, whole-button hover/focus inversion and tactile shadow/transform).
- Tests to change first: `packages/os/tests/launcher-onboarding.test.ts` for generated launcher output and `packages/os/tests/launcher-astro-source.test.ts` for the Astro reference source.
- Focused RED command: `bun x vitest run packages/os/tests/launcher-onboarding.test.ts packages/os/tests/launcher-astro-source.test.ts`.
- Expected RED: current launcher renders a separate `<code>` plus Copy button, has no `COPIED` label/reset contract, and has no unified full-control hover/focus selector.
- Safety preflight: both focused test files contain no destructive command literals (trace `trc_9c45e432e9d8`).
- Focused RED reproduced exactly: 2/2 target files failed only on the new unified-copy assertions while the other 4 launcher-onboarding cases stayed green (trace `trc_d82091f91976`).

## Validation evidence

- Focused GREEN: `bun --cwd packages/os test tests/launcher-onboarding.test.ts tests/launcher-astro-source.test.ts` → 2 files, 6/6 tests passed (trace `trc_d4c11630c114`).
- Launcher integration: `bun --cwd packages/os test tests/sites-cli.test.ts -t launcher` → 3/3 launcher materialization tests passed (trace `trc_2b0d43255f4d`).
- Website source check: Astro checked 197 files with 0 errors / 0 warnings; 24 pre-existing hints only (trace `trc_e0cc833ae7d1`).
- Browser proof on generated launcher HTML: accessibility tree exposes exactly one `button "Copy MCP URL"`; mocked clipboard click copied `https://os.consuelohq.com/mcp`, changed `COPY` → `COPIED`, and set `data-copy-status="copied"` (trace `trc_71385ab4ba05`).
- Browser style proof: default control is cream/ink with a 3px tactile shadow and -1px offset (trace `trc_679b66737561`); real hover flips the full control to ink/cream, reduces the shadow to 1px, and settles the offset to zero (trace `trc_beea4a02122d`).

## Publish-gate selector repair — test-first contract

- Full `verify` currently fails only because these launcher-owned OS files fall through to `auto:@consuelo/os:package-test`, whose broad historical facade suite is red in unrelated tool-validation/task-session cases. Review and DB gates are green; focused launcher behavior is green.
- Behavior under test: launcher source/test changes must select a critical/exclusive focused launcher contract and suppress the unrelated broad OS package suite.
- Existing local pattern: `os-managed-cloud-one-click-provisioning`, `os-lifecycle-update-handoff`, and other scoped OS rules in `packages/workspace/test-selection.rules.json` use critical/exclusive ownership plus exact executable contracts.
- Test to change first: `packages/workspace/tests/test-selection.test.js` with changed-file inputs for `launcher-onboarding.ts` and the Astro launcher source.
- Focused RED command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "launcher copy interaction"`.
- Expected RED: `os-launcher-copy-interaction` is absent and selector falls through to `auto:@consuelo/os:package-test`.
- Focused RED reproduced exactly: the selector returned only `auto:@consuelo/os:package-test`, so the new assertion failed on the missing `os-launcher-copy-interaction` rule (trace `trc_29146193f419`).
- Added critical/exclusive `os-launcher-copy-interaction` coverage for the generated launcher, Astro launcher source, and their two focused tests. Its executable contracts are the 6 launcher copy tests, the 3 launcher Sites materialization cases, and the real Consuelo website Astro check.
- Corrected the Astro command while characterizing the rule: `bun --cwd ... run astro check` only printed Bun help; the verified repository-root form is `bun run --cwd packages/consuelo-website astro -- check`, which ran Astro over 197 files with 0 errors / 0 warnings (trace `trc_5fdb9cd18220`).
- Regenerated `packages/workspace/test-selection.registry.json` from the canonical `test-selection.js generate` command (trace `trc_b82d17f034da`).
- Focused selector GREEN passed (trace `trc_1b9e11b8d592`), then the complete selector test file passed 28/28 (trace `trc_1ee1ced65283`).
- Full changed-file selector execution initially passed all 10 selected suites; after removing the unrelated snapshot artifact, the clean task selection passed all 7 selected suites and did not select `auto:@consuelo/os:package-test` (trace `trc_1c5915964026`).
- Final strict review against `origin/stream/os`: 0 blocking findings, 0 pre-existing findings, 0 documentation opportunities (trace `trc_7465ce824865`).
- Final full `verify --base origin/stream/os`: passed with `publishValid: true`; selected tests passed and the DB guard reported 0 risks/findings (trace `trc_7c1bebf70aba`).
- Stream freshness check: task HEAD is one bootstrap commit ahead of current `origin/stream/os` (`6e7813a2...`) with that stream head as its merge base; the earlier `task.ensureSynced` “behind 95” value describes the stream/main relation, not task/stream divergence (trace `trc_d4d86e7ba6f3`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/pages/os/launcher.astro`
- `packages/consuelo-website/tests/os-launcher-links.test.mjs`
- `packages/consuelo-website/tests/website-structure.test.js`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/launcher-astro-source.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-14 00:12:14 apply-patch: `.task/os/reuse-landing-copy-interaction-in-launcher/workpad.md`