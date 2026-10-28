
## discovery

- Inspect current screenshot renderer defaults and FFmpeg card composition.
- Inspect focused screenshot tests and CLI settings.
- Reproduce the current render plan before changing production code.

## acceptance criteria

- [x] Dark templates default to `#08080A` while light templates keep `#F5F5F5`.
- [x] Website dither dots remain enabled by default and independent from `pattern`.
- [x] The renderer adds no frame pixels or black drop shadow around the source screenshot.
- [x] The focused screenshot tests and full media suite pass.
- [x] `/Users/kokayi/Downloads/x-screenshot-1.png` renders to a verified 1600x900 PNG in Downloads.

## Test-first contract

- Behavior under test: the default dark plan uses `#08080A`, retains dots, and composes the scaled screenshot directly without `pad=iw+8`, `gblur`, or shadow filter labels.
- Existing local pattern: `packages/os/tests/media/32-screenshot-render.test.ts` checks the deterministic FFmpeg plan and executes the real CLI.
- Focused red command: `bun --cwd packages/os test tests/media/32-screenshot-render.test.ts`.
- Expected red failure: current code still defaults to `#0000F2` and includes frame and shadow filters.

## workspace-owned: files read

- `AGENTS.md`
- `packages/os/scripts/lib/media/screenshot.ts`

## issue discovered

- The prior task's PNG copies were corrupted by the text-oriented task push path (`89 50 4E 47` became UTF-8 replacement bytes). This task stores the same website PNG bytes as base64 text and materializes valid PNGs in the OS temp cache at runtime.

- 2026-07-14 18:52:29 append: `.task/os/refine-screenshot-card-styling/workpad.md`

## files changed

- `packages/os/scripts/lib/media/screenshot.ts`
- `packages/os/tests/media/32-screenshot-render.test.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/assets/media/screenshot/dither/cloud-{1,2,3,4}.png.base64`
- Removed the corrupted `packages/os/assets/media/screenshot/dither/cloud-{1,2,3,4}.png` copies.
- `AGENTS.md`

## workspace-owned: files changed

- Task metadata and evidence under `.task/os/refine-screenshot-card-styling/` and `.task/tasks/os/`.

## workspace-owned: activity log

- 2026-07-14 18:52:29 fs.write: `.task/os/refine-screenshot-card-styling/workpad.md`

- 2026-07-14 18:53:08 apply-patch: `packages/os/SCRIPTS.md`

- 2026-07-14 18:54:42 apply-patch: `AGENTS.md`

## workspace-owned: validation evidence

- Focused red test failed as expected before implementation: dark default and frame/shadow assertions failed.
- `bun --cwd packages/os test tests/media/32-screenshot-render.test.ts`: 5 tests passed.
- `bun run --cwd packages/os media:test`: 120 tests passed across 33 files.
- `bun run --cwd packages/os typecheck`: passed.
- Rendered `/Users/kokayi/Downloads/x-screenshot-1-dark-dots-clean.png`: 1600x900 RGBA PNG, 203,045 bytes.
- 2026-07-14 18:55:16 `review.run`: passed — OK
- 2026-07-14 18:55:30 `verify`: passed — OK
- 2026-07-14 18:56:02 `verify`: passed — OK

## current status

- Implementation, tests, local render, review, and verification are complete. Ready to publish and merge into `stream/os`.

## workspace-owned: test selection

- changed files: `.task/os/refine-screenshot-card-styling/current.json`, `.task/os/refine-screenshot-card-styling/evidence-log.json`, `.task/os/refine-screenshot-card-styling/read-log.json`, `.task/os/refine-screenshot-card-styling/session.json`, `.task/os/refine-screenshot-card-styling/workpad.md`, `.task/tasks/os/refine-screenshot-card-styling.json`, `AGENTS.md`, `packages/os/SCRIPTS.md`, `packages/os/assets/media/screenshot/dither/cloud-1.png`, `packages/os/assets/media/screenshot/dither/cloud-1.png.base64`, `packages/os/assets/media/screenshot/dither/cloud-2.png`, `packages/os/assets/media/screenshot/dither/cloud-2.png.base64`, `packages/os/assets/media/screenshot/dither/cloud-3.png`, `packages/os/assets/media/screenshot/dither/cloud-3.png.base64`, `packages/os/assets/media/screenshot/dither/cloud-4.png`, `packages/os/assets/media/screenshot/dither/cloud-4.png.base64`, `packages/os/scripts/lib/media/screenshot.ts`, `packages/os/tests/media/32-screenshot-render.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
