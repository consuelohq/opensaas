# Restore release runner in signed runtime without exposing source-only distribution signing code

branch: `task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2826
started: 2026-11-19

## acceptance criteria

- [x] Reproduce installed signed runtime release CLI failure in an extracted clean production bundle.
- [x] Extract minimal runtime-safe release identity helpers, preserving signing verification bytes and excluding operator-only distribution code.
- [x] Green real runtime CLI smoke and signer compatibility tests; update required OS script parity inventory.
- [x] Pass strict review and full safety verification across all 12 selected suites including broad OS tests.
- [ ] Promote this repair into existing PR #2813; main merge, immutable release, and Mac update remain gated on new CI/review.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/lib/release-canonical-json.ts`, `release-identity.ts` (new pure runtime helpers).
- `packages/os/scripts/release.ts`, `lib/release-immutable.ts`, `lib/distribution/release-channels.ts` (runtime-safe imports and source backward-compatible reexports).
- `packages/os/tests/distribution/runtime-bundle.test.ts`, `tests/release-script-security.test.ts`, `tests/audit/fixtures/script-parity-classifications.json` (green regression and inventory contract).

## key decisions

- Keep publisher/signing code out of customer runtime; never simply whitelist all `scripts/lib/distribution/*`.
- Preserve exact canonical signature bytes and immutable release-set ID algorithm by using shared helpers.
- Use existing durable canonical release orchestrator, no hand-rolled GitHub workflow sequence.

## notes for ko

- Confirmed 0.1.150 canary installed and full Computer Use PR review/checks were green before this recovery change.
- Current recovery task full verification: passed, 12/12 selected suites; strict review 0 issues; no database risks.
- Existing `release` facade currently fails to import an intentionally excluded module; source canonical runner works and can be used while recovering the installed runtime.

## improvements noticed

- Bundled smoke prevented shipping two broken source-only imports; pure runtime-safe extraction removes both.
- Broad package audit correctly requires explicit OS-only script inventory entries.

## errors i ran into

- Initial full verify failed 1/3899 due new OS-only scripts missing from script parity baseline. Added the required classifications; targeted parity green, second full verify all suites passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/scripts/lib/release-immutable.ts`
- `packages/os/scripts/lib/release-operation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/release-script-security.test.ts`

## Release recovery: test-first contract

- **Behavior under test:** the signed/customer Consuelo OS runtime must be able to load its exposed `release` CLI (`bun scripts/release.ts --help`) without importing excluded operator distribution modules. In particular, canonical signature JSON generation must be shared with source release-signing code without shipping operator-only key management machinery.
- **Root cause observed on 0.1.150:** `bun scripts/release.ts --action start ...` in the installed signed bundle fails immediately: `Cannot find module './lib/distribution/release-channels'`. The runtime-bundle classifier intentionally labels `scripts/lib/distribution/*` source-only, while `scripts/release.ts` imports a runtime symbol from it.
- **Existing local test patterns:** production archive extraction and `bun install --production` smoke in `packages/os/tests/distribution/runtime-bundle.test.ts` (real customer closure); immutable release signing/verification tests and canonicalReleaseJson in `scripts/lib/distribution/release-channels.ts`.
- **Test addition:** in the real customer closure test, assert `scripts/release.ts` is present, `scripts/lib/distribution/release-channels.ts` remains absent, run `bun scripts/release.ts --help` in the extracted runtime and require exit 0. Add pure canonical serializer equivalence test against source-only signing function.
- **Focused red command:** `bun x vitest run tests/distribution/runtime-bundle.test.ts -t "builds the real customer closure"` from packages/os. Expected red: runtime `release.ts --help` exits nonzero from unresolved release-channels import.
- **Implementation approach:** extract pure canonical JSON serialization to `scripts/lib/release-canonical-json.ts` (runtime-safe); source-only distribution module re-exports the shared function; `release.ts` uses shared runtime-safe serializer and retains type-only imports. No expansion of signing code into customer runtime.
- **Acceptance criteria:** exact bundle smoke passes, canonical JSON regression passes, prior signing compatibility maintained, OS tests/strict review/full verify green; changes promoted to PR #2813; production release only after CI + reviews pass, with installed Mac verified to released immutable version.
- **No-test waiver:** none.

- 2026-11-19 05:49:18 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-19 05:49:18 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:49:25 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-11-19 05:49:25 apply-patch: `packages/os/tests/release-script-security.test.ts`
- 2026-11-19 05:49:44 apply-patch: `packages/os/scripts/lib/release-canonical-json.ts`
- 2026-11-19 05:49:44 apply-patch: `packages/os/scripts/lib/distribution/release-channels.ts`
- 2026-11-19 05:49:44 apply-patch: `packages/os/scripts/release.ts`
- 2026-11-19 05:50:27 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:51:02 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:51:35 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:52:20 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:54:05 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:54:19 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`
- 2026-11-19 05:54:54 fs.write: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

## Additional runtime closure finding

The first implementation removed `release.ts`'s direct source-only import, and the real bundled-runtime smoke progressed to the next failure: `scripts/lib/release-immutable.ts` still imports `releaseSetIdForBundles` and `DEFAULT_REQUIRED_RELEASE_PLATFORMS` at runtime from the excluded distribution module. The retained smoke test remains red. Extract these pure release-identity operations to `scripts/lib/release-identity.ts`, re-export from the source-only distribution module for backwards compatibility, and change `release-immutable.ts` to import the new runtime-safe module. Keep publication/signing code excluded from the bundle. Re-run the same bundled-runtime test until it loads end-to-end.

- 2026-11-19 05:50:27 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

- 2026-11-19 05:50:28 apply-patch: `packages/os/scripts/lib/release-identity.ts`
- 2026-11-19 05:50:28 apply-patch: `packages/os/scripts/lib/distribution/release-channels.ts`
- 2026-11-19 05:50:28 apply-patch: `packages/os/scripts/lib/release-immutable.ts`

## workspace-owned: validation evidence

- 2026-11-19 05:50:55 `review.run`: passed — OK
- 2026-11-19 05:52:40 `verify`: failed — COMMAND_FAILED
- 2026-11-19 05:55:50 `verify`: passed — OK

## Recovery validation evidence (2026-11-19)

- Root cause reproduced in extracted production runtime: missing `scripts/lib/distribution/release-channels` import from `scripts/release.ts`. After extracting canonical JSON, smoke found second import from `scripts/lib/release-immutable.ts`, also source-only. Both corrected via new runtime-safe pure `release-canonical-json.ts` and `release-identity.ts`, with signing/distribution publishing still excluded.
- TDD red observed for exact bundled `release --help` test, then second missing-import red, then green: real customer closure extracted, dependencies installed via production mode, CLI `--help` exited 0, source-only signing code remained absent. Test `builds the real customer closure twice...` green.
- 18 focused tests passed across release-script-security, release-immutable, release-operation and distribution release-channels CLI suites; canonical JSON signing compatibility test green. Type/syntax checks passed. `review.run(strict:true)` 0 issues/blockers.
- Plan: full verify, commit & promote to stream PR #2813; rerun current GitHub review/CI and use repo-scoped canonical release runner, since installed 0.1.150 tool is already broken until a repaired bundle is installed. No main merge, release, installation or external publish done yet.

- 2026-11-19 05:51:02 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

## Verification wait checkpoint
Wait reason: task-scoped full verification (OS package and distribution suites) running.
Duration: 15s (single bounded poll).
Resume action: workspace `verify` for taskSession tsk_286d4d99211e immediately on wake.
Expected signal: passed=true and publishValid=true; otherwise pending or failure.
Fallback: inspect failed suite logs and repair, or repeat bounded poll if still running.

- 2026-11-19 05:51:35 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

Wait checkpoint 2: Reason: full task verification remains running. Duration: 15s. Resume action: verify(taskSession=tsk_286d4d99211e). Expected: publishValid=true. Fallback: repeat bounded poll or inspect failures. Previous 15s wake observed VERIFY_PENDING; old PR head CI now all passed (before this recovery patch).

- 2026-11-19 05:52:20 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

- 2026-11-19 05:53:54 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
## Broad-suite red/green closure

- Full task verification selected 11 suites and 10 passed (including critical release/distribution tests), but auto-discovered OS package test failed 1/3899 tests. Independently reproduced: `tests/audit/script-parity-audit.test.ts` requires explicit classification for every OS script; the two new runtime helpers were unclassified.
- Added `os-only-intentional` entries with specific ownership rationale for `scripts/lib/release-canonical-json.ts` and `scripts/lib/release-identity.ts` to the script parity baseline. Targeted audit test now green 1/1. This is a required inventory contract, not a waived test.
- Rerunning the full verify gate; do not promote until all suites and publication stamp pass.

- 2026-11-19 05:54:05 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

Wait checkpoint 3: Reason: re-running full task verify after script inventory fix. Duration: 15s. Resume action: verify(taskSession=tsk_286d4d99211e). Expected publishValid=true; if pending poll again, if failed inspect exact suite.

- 2026-11-19 05:54:19 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

Wait checkpoint 4: Reason: full verification still running, no failure reported yet. Duration: 15s. Resume action: verify(taskSession=tsk_286d4d99211e). Expected publishValid=true and 11/11 green; fallback inspect any failure.

- 2026-11-19 05:54:54 append: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`

- 2026-11-19 05:56:04 apply-patch: `.task/os-computer-use/restore-release-runner-in-signed-runtime-without-exposing-source-only-distribution-signing-code/workpad.md`