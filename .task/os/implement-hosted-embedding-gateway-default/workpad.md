# implement hosted embedding gateway default

branch: `task/os/implement-hosted-embedding-gateway-default`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/966

## goal

Make OS semantic search work for normal users by defaulting embeddings to a narrow Consuelo-hosted gateway. OS keeps chunking, graph/indexing, and vector storage local. The hosted gateway only turns approved code/query text into embeddings through the approved model.

## recovery note

PR #963 was merged while the workspace session was unavailable, but `stream/os` still defaults `embedding-config.js` to `openrouter`. This task re-applies the implementation on top of the current stream.

## Test-first contract

Behavior under test:
- default embedding config resolves to the Consuelo hosted gateway
- gateway payload construction uses only the approved embedding model, validates limits, carries install/repo metadata, and redacts raw text from audit metadata
- default embedder path uses the gateway client and no longer reads the private OpenRouter Keychain item
- local embeddings remain explicit opt-in
- direct OpenRouter remains explicit opt-in through an env key
- SQLite vector table dimensions follow embedding config instead of a hard-coded legacy value
- a doctor CLI reports provider, model, gateway limits, and local fallback state

Existing pattern:
- OS index tests use focused Vitest files under `packages/os/tests`
- source-level assertions are used when importing native SQLite code is too heavy
- focused package tests run with `bun --cwd packages/os test <file>`

New tests:
- `packages/os/tests/semantic-embedding-gateway.test.ts`

Focused red command:
```bash
bun --cwd packages/os test tests/semantic-embedding-gateway.test.ts
```

Expected red failure before implementation:
- default provider is still `openrouter`
- `scripts/lib/index/embedding-gateway.js` is missing
- `embedder.js` references `pi-proxy-openrouter-api-key`
- `store.js` hard-codes `VECTOR_DIMENSIONS = 1024`

- 2026-06-11 08:58:47 write: `.task/os/implement-hosted-embedding-gateway-default/workpad.md`

## files changed

- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/semantic-embeddings.js`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/semantic-embeddings.js`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

## workspace-owned: activity log

- 2026-06-11 08:58:47 fs.write: `.task/os/implement-hosted-embedding-gateway-default/workpad.md`
- 2026-06-11 08:59:06 write: `packages/os/tests/semantic-embedding-gateway.test.ts`
- 2026-06-11 08:59:06 fs.write: `packages/os/tests/semantic-embedding-gateway.test.ts`
- 2026-06-11 08:59:52 fs.write: `packages/os/scripts/lib/index/embedding-config.js`
- 2026-06-11 09:00:06 fs.write: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 09:00:29 fs.write: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 09:00:38 fs.write: `packages/os/scripts/semantic-embeddings.js`
- 2026-06-11 09:01:05 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 09:01:23 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 09:01:55 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 09:03:42 fs.patch: `packages/os/package.json`
- 2026-06-11 09:04:17 fs.patch: `packages/os/SCRIPTS.md`
- 2026-06-11 09:04:44 fs.patch: `packages/os/SCRIPTS.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/index/store.js`

## implementation notes

- Added hosted gateway client contract in `scripts/lib/index/embedding-gateway.js`.
- Changed default provider from direct `openrouter` to `consuelo-gateway`.
- Removed the private Keychain lookup path from `embedder.js`; direct OpenRouter is explicit opt-in through `CONSUELO_OPENROUTER_API_KEY`.
- Kept local embeddings as explicit `CONSUELO_EMBEDDING_PROVIDER=local` mode with the model path under `$CONSUELO_HOME/models` by default.
- Changed `store.js` vector dimensions/model id to derive from embedding config.
- Added `semantic:embeddings` doctor command and docs for gateway/local/direct-provider modes.

## recovery/tooling notes

- `fs.patch` rejected inline multiline content for `store.js`; switched to content-file patches.
- A later line-range patch corrupted the top of `store.js`; restored the file from `origin/stream/os` and applied only the intended vector-dimension replacement with a focused Python command. Reread showed the corrected top-of-file structure before validation.

## validation

- Red: `bun --cwd packages/os test tests/semantic-embedding-gateway.test.ts` failed with 7 expected failures before implementation.
- Green: `bun --cwd packages/os test tests/semantic-embedding-gateway.test.ts` passed with 7 tests.
- Smoke: `cd packages/os && bun run semantic:embeddings -- doctor --json` returned provider `consuelo-gateway`, model `qwen/qwen3-embedding-4b`, gateway URL, and limits.
- Syntax: `node --check` passed for changed JS modules.
- Typecheck/syntax suite: `cd packages/os && bun run typecheck` passed.
- Search check: no production/doc references remain to `workspace-index`, `qmd/models`, private Keychain secret, or hard-coded `const VECTOR_DIMENSIONS = 1024`; remaining matches are negative test assertions only.

## workspace-owned: validation evidence

- 2026-06-11 09:06:54 `review.run`: passed — OK
- 2026-06-11 09:07:06 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/implement-hosted-embedding-gateway-default/current.json`, `.task/os/implement-hosted-embedding-gateway-default/evidence-log.json`, `.task/os/implement-hosted-embedding-gateway-default/read-log.json`, `.task/os/implement-hosted-embedding-gateway-default/session.json`, `.task/os/implement-hosted-embedding-gateway-default/workpad.md`, `.task/tasks/os/implement-hosted-embedding-gateway-default.json`, `packages/os/SCRIPTS.md`, `packages/os/package.json`, `packages/os/scripts/lib/index/embedder.js`, `packages/os/scripts/lib/index/embedding-config.js`, `packages/os/scripts/lib/index/embedding-gateway.js`, `packages/os/scripts/lib/index/store.js`, `packages/os/scripts/semantic-embeddings.js`, `packages/os/tests/semantic-embedding-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## review and verify

- `review.run` passed: static_rules, eslint, typecheck, and spec_compliance; no must-fix issues.
- `verify` passed and wrote publish-valid stamp `.task/os/implement-hosted-embedding-gateway-default/verify.json`.
- `verify` selected zero suites automatically, but the focused semantic embedding gateway test was run manually and passed.
