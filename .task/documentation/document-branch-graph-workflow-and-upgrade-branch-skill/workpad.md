# DEV-1611 branch graph workflow docs and skill

branch: `task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2017/document-branch-graph-workflow-and-upgrade-branch-skill
github pr: https://github.com/consuelohq/opensaas/pull/2017
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/documentation/public/images/workflows/branch-in-new-chat.jpg`
- `packages/documentation/src/content/docs/reference/workflows/branch-graph.mdx`
- `packages/documentation/src/content/docs/workflows/branch-graph.mdx`
- `packages/documentation/src/content/docs/workflows/index.mdx`

## workspace-owned: files changed

- `packages/documentation/public/images/workflows/branch-in-new-chat.jpg`
- `packages/documentation/src/content/docs/reference/workflows/branch-graph.mdx`
- `packages/documentation/src/content/docs/workflows/branch-graph.mdx`
- `packages/documentation/src/content/docs/workflows/index.mdx`

## workspace-owned: activity log

- 2026-08-15 09:01:58 fs.write: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`
- 2026-08-15 09:02:48 fs.write: `packages/documentation/src/content/docs/workflows/index.mdx`
- 2026-08-15 09:03:13 fs.write: `packages/documentation/src/content/docs/workflows/branch-graph.mdx`
- 2026-08-15 09:08:19 fs.write: `packages/documentation/src/content/docs/reference/workflows/branch-graph.mdx`
- 2026-08-15 09:12:02 fs.write: `packages/documentation/public/images/workflows/branch-in-new-chat.jpg`
- 2026-08-15 09:13:34 fs.write: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`
- 2026-08-15 09:18:26 fs.write: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`
- 2026-08-15 09:21:15 fs.write: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`
- 2026-08-15 09:31:17 fs.write: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 09:22:43 `verify`: failed — COMMAND_FAILED
- 2026-08-15 09:31:55 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/package.json`
- `packages/documentation/src/content/docs/reference/workflows/branch-graph.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/tests/navigation-memory.test.ts`
- `packages/documentation/tests/reference.test.ts`
- `packages/os/package.json`
- `packages/os/skills/branch/SKILL.md`
- `packages/os/skills/branch/skill.json`
- `packages/os/tests/branch-skill.test.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## RED evidence — 2026-08-15

focused red command:
- `cd packages/os && bunx vitest run tests/branch-skill.test.ts tests/skills-registry.test.ts`
- `cd packages/documentation && bun test tests/foundation.test.ts tests/navigation-memory.test.ts`

expected failures observed:
- Branch skill lacks the new context-management/working-memory framing, compact 1–3-letter ID convention, fresh-chat instructions, late task-PR/failing-check audit, fresh subagent review, and OS update finalization semantics.
- Branch skill metadata lacks explicit context/memory plus phase/epic/migration triggers.
- Docs navigation has no top-level Workflows section.
- `/workflows/` and `/workflows/branch-graph/` do not exist.
- Branch-in-new-chat screenshot asset is absent.

Baseline: OS skill registry tests passed; unrelated docs foundation/navigation tests remained green except for the intentionally added Workflows contracts.

- 2026-08-15 09:01:58 append: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`

- 2026-08-15 09:02:35 apply-patch: `packages/documentation/src/lib/docs-navigation.ts`
- 2026-08-15 09:02:48 write: `packages/documentation/src/content/docs/workflows/index.mdx`

- 2026-08-15 09:03:13 write: `packages/documentation/src/content/docs/workflows/branch-graph.mdx`

- 2026-08-15 09:03:37 apply-patch: `packages/os/skills/branch/SKILL.md`
- 2026-08-15 09:03:37 apply-patch: `packages/os/skills/branch/skill.json`
- 2026-08-15 09:08:19 write: `packages/documentation/src/content/docs/reference/workflows/branch-graph.mdx`

- 2026-08-15 09:11:58 apply-patch: `packages/documentation/src/content/docs/workflows/branch-graph.mdx`
- 2026-08-15 09:11:58 apply-patch: `packages/documentation/tests/navigation-memory.test.ts`
- 2026-08-15 09:12:02 write: `packages/documentation/public/images/workflows/branch-in-new-chat.jpg`

- 2026-08-15 09:13:15 apply-patch: `packages/documentation/tests/reference.test.ts`
## GREEN + integration evidence — 2026-08-15

Focused GREEN:
- `cd packages/os && bunx vitest run tests/branch-skill.test.ts tests/skills-registry.test.ts tests/skill-selection-cli.test.ts` → 3 files, 17/17 tests passed.
- `cd packages/documentation && bun test tests/foundation.test.ts tests/navigation-memory.test.ts` → 28/28 tests passed.

Generated-source checks:
- `cd packages/os && bun run generate-skills-registry` → regenerated `skills.json` for 11 bundled skills.
- `cd packages/documentation && bun run generate:skill-templates` → regenerated bundled skill-template docs, including Branch.

Broader documentation validation:
- `cd packages/documentation && bun run validate` → ok, 105 selected pages.
- `cd packages/documentation && bun test` → 100/100 tests passed after promoting the Reference-era Branch Graph contract to the top-level Workflows contract.
- `cd packages/documentation && bun run build` → Astro/Starlight build passed; both `/workflows/` and `/workflows/branch-graph/` emitted successfully.

Media:
- Added a focused crop of the user-provided ChatGPT mobile screenshot as `packages/documentation/public/images/workflows/branch-in-new-chat.jpg`; the guide uses it directly beside the Branch in new chat instructions.

How To Speak lookup:
- Located durable Library traces for `How To Speak - Communication Field Guide` and the older `task/design/expand-how-to-speak-guide` trail. The surviving source material captures the prose-as-attention-design / executable-context handoff doctrine used to tighten this guide. Artifact migration to OS remains explicitly out of scope for DEV-1611.

- 2026-08-15 09:13:34 append: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`

## Wait cycle — review transport recovery

Wait reason: strict `review.run` returned two MCP network transport failures before producing a review result.
Duration: 20 seconds.
Resume action: rerun strict `review.run` for the task branch against `stream/documentation` immediately after wake.
Expected signal: a structured review result with findings/test status.
Fallback: if transport still fails, record the limitation, run canonical task verification and GitHub review/check surfaces without weakening the already-green package validation.

- 2026-08-15 09:18:26 append: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`

Wait result: after the 20-second timed recovery wait, strict `review.run` immediately returned the same MCP network transport failure without a review payload. Proceeding with the documented fallback: canonical task verification plus GitHub task-PR review/check inspection; package validation remains green.

- 2026-08-15 09:21:15 append: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`

- 2026-08-15 09:28:59 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 09:29:30 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-15 09:29:58 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-08-15 09:30:48 apply-patch: `packages/workspace/test-selection.rules.json`
## Verification selector hardening — 2026-08-15

Canonical verify initially selected the full `@consuelo/os package test` for bundled-skill metadata/registry changes. That package-wide suite is currently red on unrelated baseline OS audit/facade drift, while the Branch/skill contracts themselves were green.

Added an explicit critical/exclusive `os-bundled-skill-contract` rule so bundled-skill instructions, metadata, registry output, and routing changes select the focused package-relative skill lifecycle suite instead of unrelated package-wide OS tests. This follows the repository's existing focused-rule pattern for historically red broad OS suites; no test was skipped or force-passed.

TDD evidence:
- RED: `packages/workspace/tests/test-selection.test.js -t 'uses focused bundled-skill contracts...'` selected only `auto:@consuelo/os:package-test` and failed the new expectation.
- GREEN: selector now matches only `os-bundled-skill-contract` for the representative skill delta and runs 5 files / 22 skill tests successfully.
- Full `packages/workspace/tests/test-selection.test.js` → 35/35 passed.
- Regenerated `packages/workspace/test-selection.registry.json` → 56 rules / 37 explicit rules.

Removed unrelated test-generated/local drift from this task (`packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, Reference browser script, and Reference claim ledger) before final verification.

- 2026-08-15 09:31:17 append: `.task/documentation/document-branch-graph-workflow-and-upgrade-branch-skill/workpad.md`
