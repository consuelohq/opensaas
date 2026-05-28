# restore decision engine steering doctrine

## objective

Update workspace steering so agents interpret `explore` as the AI-native repo map and decision-engine prior without treating it as proof or replacing task-scoped workspace file tools.

## approved plan

Ko approved updating the existing "Exploration is mandatory" section, not adding a competing standalone doctrine. The change avoids naming non-workspace tools and keeps explore important without making it the only thing agents care about.

## changes made

- Updated the first-pass `explore` example query to target source owner, implementation, tests, and generated surfaces.
- Added an "Explore result interpretation" block inside the existing mandatory exploration section.
- Documented score/evidence-shape interpretation, `capReason`, `source_routes`, and the follow-up use of `fs.read`, `fs.search`, and `fs.list`.

## validation

- Confirmed the approved text is inside the existing `## Exploration is mandatory` section.
- Confirmed the new text names only workspace tools for follow-up operations: `explore`, `fs.read`, `fs.search`, and `fs.list`.
- `bun run audit -- --scripts --json` passed.
- `review.run` timed out through the facade and was treated as unknown state rather than failure.
- `verify --no-db` ran and failed only because full review selected pre-existing repository drift: 699 pre-existing issues and 3 failed suites; the changed file was `packages/workspace/STEERING.md`.

## workspace-owned: validation evidence

- 2026-05-28 21:36:14 `review.run`: passed — OK
- 2026-05-28 21:36:14 `review.run`: passed — OK
- 2026-05-28 21:38:36 `verify`: failed — COMMAND_FAILED
- 2026-05-28 21:38:37 `verify`: failed — COMMAND_FAILED
