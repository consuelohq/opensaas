# add typed browser facade primitives

branch: `task/workspace-agents/add-typed-browser-facade-primitives`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/385
started: 2026-05-13

## acceptance criteria

- [x] Add typed facade aliases for `browser.get`, `browser.find`, `browser.wait`, `browser.download`, `browser.tabs`, `browser.cookies`, `browser.network`, `browser.dialog`, `browser.trace`, and `browser.clipboard`.
- [x] Keep `browser.raw` as the escape hatch for upstream `agent-browser` commands not covered by typed aliases.
- [x] Update `browser.js` only where needed to make typed tabs/cookies semantics map cleanly to upstream commands.
- [x] Update schema registry and type signatures for the new browser inputs.
- [x] Update `SCRIPTS.md` with the new typed aliases and raw fallback doctrine.
- [x] Regenerate `TOOLS.md`, `workspace.d.ts`, and facade snapshots.
- [x] Validate dry-runs, syntax, docs/types generation, facade tests, audit, and review.

## implementation plan

1. Read browser wrapper, manifest, schema registry, generated docs/type patterns, and previous browser facade handoff.
2. Add manifest entries and Zod input schemas for the requested aliases.
3. Add small wrapper handling for `browser.tabs` and `browser.cookies` so typed `list/select` inputs map to upstream `agent-browser` syntax.
4. Regenerate generated files and run focused validation.
5. Update the browser skill canvas after code validation.

## files changed

- `packages/workspace/scripts/browser.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/SCRIPTS.md`

## key decisions

- `browser.network` stays flexible with typed `args: string[]` because upstream network commands have several sub-shapes (`requests`, `route`, `har start`, `har stop`).
- `browser.tabs` exposes semantic actions (`list`, `new`, `select`, `switch`, `close`) and `browser.js` maps them to upstream `agent-browser tab` syntax.
- `browser.cookies` exposes semantic actions (`list`, `set`, `clear`) and `browser.js` maps `list` to bare upstream `cookies`.
- `browser.raw` remains for uncommon upstream commands and experimental flags.

## validation

- `bun run generate-types` — passed; regenerated `packages/workspace/src/generated/workspace.d.ts`.
- `bun run generate-docs` — passed; regenerated `packages/workspace/TOOLS.md`.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts -u` — passed; updated facade snapshots for the new browser aliases.
- `workspace checkFiles` for `packages/workspace/scripts/browser.js` — passed; `node --check` succeeded.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts` — passed; 494 tests passed without snapshot updates.
- `bun run browser -- get title` — passed; returned `Commands | agent-browser` from the active page.
- `bun run browser -- tabs list` — passed; returned the active tab list through the new typed `tabs` alias path.
- `workspace audit { scripts: true }` — passed; documented count matched actual count with no missing or undocumented scripts.
- `workspace review.run { noTests: true }` — passed.
- `workspace verify { noReview: true }` — passed; database risk scan clean.

## notes for ko

- This change is workspace tooling only; no product runtime code is touched.
