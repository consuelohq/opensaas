# plan ast target decision engine improvements

branch: `task/workspace-agents/plan-ast-target-decision-engine-improvements`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/391
started: 2026-05-13

## acceptance criteria

- [x] Keep scope to target-aware `explore` + target-aware `decideNext` only.
- [x] Do not add fs tooling, hash anchors, patching, new commands, target-level graph edges, or a belief overhaul.
- [x] Preserve existing tree-sitter chunk identity through retrieval as structured `bestChunk` metadata.
- [x] Add compatibility-safe `target` objects to `explore` JSON results and `explore.result` evidence details.
- [x] Make `decide-next` format read recommendations with target kind/name/lines when a target is present.
- [x] Keep existing file-level fields (`symbol`, `chunk_type`, `lines`) for compatibility.
- [x] Validate syntax and smoke the actual target-aware loop.

## implementation plan

1. Read standards and current chunk/index/search/explore/decide code.
2. Add `contentHash` to `store.searchChunks()` query output so the existing chunk hash can be surfaced.
3. Preserve `bestChunk` in `retriever.mergeSearchRows()` and `hydrateGraphCandidates()` without changing ranking semantics.
4. Build an `explore` result `target` from the existing best chunk.
5. Update `decide-next` formatting/deduping to use target keys and target labels when present.
6. Validate syntax, live explore output, live decide-next recommendation, audit, review, and verify.

## files changed

- `packages/workspace/scripts/lib/index/store.js`
- `packages/workspace/scripts/lib/search/retriever.js`
- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/decide-next.js`

## key decisions

- This is not new AST infrastructure; it wires through tree-sitter chunk data that already exists.
- `explore` keeps legacy fields and adds `target` as an additive field.
- Beliefs remain file-level in v0; target-level beliefs are a later decision after observing whether target recommendations materially improve agent behavior.
- No docs/generated facade updates are needed because no new tool command or schema was added. This is an additive JSON output and recommendation formatting change.

## validation

- `checkFiles` for all four touched JS files passed after fixes.
- Direct task-worktree `explore` smoke passed: first result included `target.kind = "function"`, `target.name = "buildTarget"`, lines `120-140`, and `content_hash`.
- Direct task-worktree `decide-next` smoke with temporary clean evidence/read state passed: action was `read packages/workspace/scripts/decide-next.js target function buildRecommendation (lines 287-367)` and JSON included the target object.
- Direct task-worktree clean-state smoke restored `.task/explore-state.json`, `.task/evidence-log.json`, and `.task/read-log.json` after running.
- `workspace audit { scripts: true }` passed: 48 documented scripts, 48 actual scripts, no drift.
- `workspace review.run { base: "origin/main", noTests: true }` passed with no findings.
- `workspace verify { base: "origin/main", noDb: true }` passed.

## notes for Ko

- The narrow win is now locked in: `decideNext` can tell the agent which function/block target to read, not just which file.
- We can use tree-sitter better later by adding more precise chunk names for object properties, arrow functions, callbacks, and nested functions, but that is intentionally out of this patch.
- The typed workspace `explore` wrapper did not surface the new `target` while this branch is unmerged because it appears to run the current main workspace command surface, not the task worktree script. Direct task-worktree execution validated the branch behavior.

## errors and fixes

- A few multiline inline `fs.patch` attempts were rejected by the safety guard before writing; I switched to `tmp` content files.
- One `store.js` SQL select string initially missed a comma; `checkFiles` caught it and it was fixed.
- One `decide-next.js` helper block initially landed inside the old `buildCandidateActions` declaration. A live smoke exposed it; I rewrote the block and reran syntax + smoke.
- Temporary validation state was used only inside a shell trap and restored before command exit.

## next tree-sitter improvements to consider separately

- Improve `chunker.js` naming for arrow function assignments, object method properties, route handler objects, and nested callbacks.
- Add parent context to chunks, for example `ClassName.methodName` or `schemaRegistry.FsReadInput`.
- Preserve chunk node type in addition to normalized chunk kind, so we can distinguish `function_declaration`, `method_definition`, `lexical_declaration`, and object `pair` later.
- Add target-level graph edges only after target-level recommendations prove useful.

- 2026-05-13 07:35:33 write: `.task/workpad.md`