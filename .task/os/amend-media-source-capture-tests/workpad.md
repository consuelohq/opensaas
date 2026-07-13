# amend media source capture tests

branch: `task/os/amend-media-source-capture-tests`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1194
started: 2026-06-23

taskSession: `tsk_cb2daaaf2637`

## acceptance criteria

- [x] Amend media final-state tests so source capture is media-internal implementation plumbing.
- [x] Keep `source.capture`/`media.sourceCapture` out of manifests, workflows, runbooks, package scripts, and generated tool surfaces.
- [x] Make `media.ingest` the visible media ingest tool and require actual source media asset preservation.
- [x] Ensure media ingest does not shell out through `research:ingest` and does not emit research packet artifacts as its primary contract.
- [x] Leave `research.ingest` untouched.
- [x] Keep the task test-only; no production media implementation.
- [x] Validate focused tests, typecheck, expected-red full media suite, review; stream routing pending push/pr.

## Test-first contract

Behavior under test:

- `media.sourceCapture` is internal to `packages/os/scripts/lib/media/source-capture/*`.
- `media.ingest` is the public tool boundary and maps source capture output into `media.ingest-manifest.v1` and `media.asset.v1`.
- Media ingest requires a real source media asset and fails with a structured missing-asset error when only transcript text exists.
- Media ingest carries provenance, command plan, checksums, transcript refs, thumbnails, and `rights.status = needs-review`.
- Media implementation can learn from research ingest discipline, but `research.ingest` remains independent and unchanged.

Existing local pattern to follow:

- Existing media final-state suites in `packages/os/tests/media`.
- `packages/workspace/tests/research-ingest.test.js` uses fake tool binaries for deterministic ingest tests; media should use fixture/fake process patterns later without touching research ingest.

New or changed tests:

- Add `16-source-capture-internal.test.ts`.
- Add `17-media-ingest-source-capture.test.ts`.
- Shift YouTube/audio/vision/render/handoff test file numbers to keep the suite order coherent.
- Update `06-effect-architecture.test.ts`, `19-youtube-ingest.test.ts`, README, and package scripts.

Focused red command:

```bash
bun --cwd packages/os test tests/media/16-source-capture-internal.test.ts tests/media/17-media-ingest-source-capture.test.ts
```

Expected red failure:

- Tests should compile and then fail because `scripts/lib/media/source-capture/*` and `scripts/lib/media/ingest.ts` do not exist yet.

## notes

- This task intentionally amends executable contracts only.
- No production media implementation should be added.
- `research.ingest` is not in scope for edits.

## workspace-owned: files read

- `packages/os/tests/media/01-package-boundaries.test.ts`

## workspace-owned: validation evidence

- 2026-06-23 18:28:43 `review.run`: passed — OK


## implementation notes

- Added `16-source-capture-internal.test.ts` to make media source capture internal-only and absent from manifests/workflows/runbooks/scripts.
- Added `17-media-ingest-source-capture.test.ts` to make `media.ingest` the visible asset-preserving ingest boundary.
- Shifted YouTube/audio/vision/render/handoff suites from `16`-`28` to `18`-`30` so source-capture/ingest are first in the media ingest slice.
- Updated package scripts and `01-package-boundaries.test.ts` to include `media:test:ingest` plus the shifted suite numbers.
- Updated `06-effect-architecture.test.ts` to include `media/ingest.ts` and `media/source-capture/*` boundaries.
- Updated `19-youtube-ingest.test.ts` to put the ingest layout under `media.ingest`, not `media.youtube` or `research.ingest`.
- `research.ingest` script, skill, and tests were not modified.

## validation evidence

```bash
bun --cwd packages/os test tests/media/01-package-boundaries.test.ts
# pass: 1 file, 4 tests

bun run --cwd packages/os typecheck
# pass: workspace script syntax checks passed

bun --cwd packages/os test tests/media/16-source-capture-internal.test.ts tests/media/17-media-ingest-source-capture.test.ts
# expected red: 2 files, 9 tests, 1 passed, 8 failed
# failures point at missing scripts/lib/media/source-capture/* and scripts/lib/media/ingest.ts

bun run --cwd packages/os media:test:ingest
# expected red: 4 files, 15 tests, 1 passed, 14 failed
# failures point at missing media ingest/source-capture/youtube implementation

bun --cwd packages/os test tests/media
# expected red: 31 files, 97 tests, 6 passed, 91 failed
# package-boundaries suite passes; failures point at missing media implementation surfaces

review.run --base origin/stream/os
# pass: blocking issues 0
```

Destructive-literal preflight:

```txt
- focused ingest/YouTube media tests: pass, hits []
- all media test files: pass, 31 files, hits []
```

## routing

- Push pending.
- Stream PR routing pending.
