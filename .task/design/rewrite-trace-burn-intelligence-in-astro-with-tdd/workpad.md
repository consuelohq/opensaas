# rewrite trace burn intelligence in astro with tdd

## goal

Replace the fragile single-file Trace Burn Intelligence runtime patch stack with a source-first Astro implementation that keeps the current UI direction and becomes a realistic prototype for the future OS traces product.

## constraints

- Use TDD.
- Preserve raw payload access for development.
- Do not edit packages/os.
- Keep pseudo-live JSON polling rather than building the full OS tracing product here.

## acceptance criteria

- [x] Red tests existed before implementation.
- [x] Stable row identity is tested and implemented with recordId / trace_id keys, not numeric feed ids.
- [x] Polling ignores generatedAt-only rewrites.
- [x] Selected trace detail persists across feed refreshes.
- [x] Time-only table labels strip dates.
- [x] Astro source owns page structure and one client module owns trace interactions.
- [x] Feed writer is included so the page remains self-contained.
- [x] Active local archive page was backed up and replaced with the Astro build.
- [x] Desktop and mobile browser checks passed.

## tracked files

- packages/consuelo-design/trace-burn-intelligence/astro.config.mjs
- packages/consuelo-design/trace-burn-intelligence/src/pages/index.astro
- packages/consuelo-design/trace-burn-intelligence/src/scripts/traceStore.ts
- packages/consuelo-design/trace-burn-intelligence/src/scripts/traceExplorer.ts
- packages/consuelo-design/trace-burn-intelligence/src/styles/trace.css
- packages/consuelo-design/trace-burn-intelligence/scripts/build.ts
- packages/consuelo-design/trace-burn-intelligence/tests/artifactContract.test.ts
- packages/consuelo-design/trace-burn-intelligence/tests/traceStore.test.ts
- scripts/operator/trace-burn-page-feed.ts
- package.json
- packages/workspace/SCRIPTS.md

## commands

```bash
bun run trace:burn-feed -- --interval 15 --limit 250
bun run trace:burn-astro:test
bun run trace:burn-astro:build
bun run trace:burn-astro:publish-local
```

## validation evidence

- red test run: trc_59d2124ad135
- green test run: trc_4684eb3736d0, 8 tests, 29 assertions
- Astro build: trc_279cc3ba1a33
- built HTML contract: trc_853510582b99
- feed writer smoke: trc_416873eed42a
- design check: trc_8abd11cec6ee
- desktop load: trc_f8248a699d6c
- live feed consumed: trc_711d7e5ce83a
- launcher opens modal: trc_712ed26822e7
- trace click opens matching detail: trc_53dd4a7fe5aa
- detail survives feed interval: trc_31cd10268869
- mobile load: trc_f593fd5d7546
- mobile full-width and exact trace selection: trc_3b296a90beac
- dashboard click does not open modal: trc_da00b0bc298c

## local runtime backup

Before replacing the active runtime artifact, the old page was backed up under:

```text
/tmp/trace-burn-intelligence-pre-astro-20260623T063940Z
```

The old index was 16,997,631 bytes with sha256 be2568ed031c7c0a64571acc59a6e675b073deda9ba9097434ec747a7135159c.

## notes

The active .od page is runtime state. The durable work is the Astro source plus feed writer in tracked files. The Astro build script uses the already-installed Astro CLI from the Consuelo website package and creates a local node_modules symlink for Astro resolution when needed.

## workspace-owned: validation evidence

- red test run: trc_59d2124ad135
- green test run: trc_4684eb3736d0, 8 tests, 29 assertions
- Astro build: trc_279cc3ba1a33
- built HTML contract: trc_853510582b99
- feed writer smoke: trc_416873eed42a
- design check: trc_8abd11cec6ee
- desktop load: trc_f8248a699d6c
- live feed consumed: trc_711d7e5ce83a
- launcher opens modal: trc_712ed26822e7
- trace click opens matching detail: trc_53dd4a7fe5aa
- detail survives feed interval: trc_31cd10268869
- mobile load: trc_f593fd5d7546
- mobile full-width and exact trace selection: trc_3b296a90beac
- dashboard click does not open modal: trc_da00b0bc298c
- 2026-06-23 06:45:12 `review.run`: passed — OK
- 2026-06-23 06:46:33 `review.run`: passed — OK
- 2026-06-23 06:48:04 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/rewrite-trace-burn-intelligence-in-astro-with-tdd/current.json`, `.task/design/rewrite-trace-burn-intelligence-in-astro-with-tdd/session.json`, `.task/design/rewrite-trace-burn-intelligence-in-astro-with-tdd/workpad.md`, `.task/tasks/design/rewrite-trace-burn-intelligence-in-astro-with-tdd.json`, `package.json`, `packages/consuelo-design/trace-burn-intelligence/.gitignore`, `packages/consuelo-design/trace-burn-intelligence/astro.config.mjs`, `packages/consuelo-design/trace-burn-intelligence/scripts/build.ts`, `packages/consuelo-design/trace-burn-intelligence/src/pages/index.astro`, `packages/consuelo-design/trace-burn-intelligence/src/scripts/traceExplorer.ts`, `packages/consuelo-design/trace-burn-intelligence/src/scripts/traceStore.ts`, `packages/consuelo-design/trace-burn-intelligence/src/styles/trace.css`, `packages/consuelo-design/trace-burn-intelligence/tests/artifactContract.test.ts`, `packages/consuelo-design/trace-burn-intelligence/tests/traceStore.test.ts`, `packages/workspace/SCRIPTS.md`, `scripts/operator/trace-burn-page-feed.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none
