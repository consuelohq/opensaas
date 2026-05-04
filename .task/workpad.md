# move website animations stream doc

branch: task/workspace-agents/move-website-animations-stream-doc
stream: stream/workspace-agents
pr: https://github.com/consuelohq/opensaas/pull/310
started: 2026-05-04

## acceptance criteria

- [x] Move packages/consuelo-website/animations.md to areas/website/animations.md.
- [x] Update design tooling and docs references to the new stream doc path.
- [x] Preserve design tooling checks after the move.

## plan

1. Find current animation doc references.
2. Move the file into the website stream docs folder.
3. Replace old package path references with areas/website/animations.md.
4. Validate syntax, design boundary checks, diff cleanliness, review, and verify.

## files changed

- pending task:push update

## key decisions

- animations.md belongs with areas/website because it is website stream context, matching the prior AGENTS.md move.
- Design tooling still consumes the animation guide as website-specific context, just from the stream docs path.

## notes for ko

- This only moves the doc and updates references. stream.context still needs a follow-up to surface or inject area docs.

## improvements noticed

- Follow-up: stream context should list area doc files so moves like this are visible immediately to agents.

## errors i ran into

- First inline move/reference/workpad command partially executed and damaged the workpad because shell quoting stripped markdown backticks. Repaired references and rewrote this workpad without shell-sensitive markdown.

## validation

- pending
- Confirmed no old packages/consuelo-website/animations.md references remain.
- Confirmed new areas/website/animations.md references in design tooling, README, and area design docs.
- git diff --check passed.
- workspace checkFiles passed for packages/consuelo-design/src/index.ts and packages/workspace/scripts/consuelo-design.ts.
- bun packages/workspace/scripts/consuelo-design.ts check --json passed and reports website-motion-design path as areas/website/animations.md.
- workspace review.run passed with explicit branch and base stream/workspace-agents.
- bun packages/workspace/scripts/verify.js --base stream/workspace-agents --no-db --json passed and wrote .task/verify.json.
