# recover old OS spec and document shell degradation

branch: `task/design/recover-old-os-spec-and-document-shell-degradation`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/816/recover-old-os-spec-and-document-shell-degradation
github pr: https://github.com/consuelohq/opensaas/pull/816
started: 2026-06-06

## acceptance criteria

- [ ] Locate the best recoverable source for the old OS spec that Ko liked.
- [ ] Publish a recovered OS spec through the versioned design wiki route.
- [ ] Verify the recovered route and `/design-wiki` entry.
- [ ] Diagnose why the newer spec degraded relative to the old OS spec and current roadmap.
- [ ] Record shell/template follow-up requirements so future specs/docs match that form automatically.
- [ ] Avoid widening scope into a full shell rewrite in this recovery task unless absolutely necessary.
- [ ] Promote through `stream/design` review PR.

## plan

1. Read design AGENTS, DESIGN.md, spec template, reader shell, and relevant archive/publish state.
2. Search repo, archive state, context, and git history for the old OS spec source/artifact.
3. If found, copy or republish it as a recovered version at the OS spec route using the versioned publisher.
4. Validate route content, shell markers, version registry, and `/design-wiki` card.
5. Write degradation diagnosis and shell/template follow-up requirements to the workpad.
6. Run focused checks/review/verify and promote.

## current status

- Task started from `stream/design` because the new page-versioning publisher is on the stream.
- Design AGENTS, spec template, reader shell, and DESIGN.md read in full via task-scoped calls.
- Context search did not find a prior explicit old OS spec recovery note.
- Searching for the best recoverable old OS spec source now.

## test-first contract

Behavior under test: this is an artifact recovery/publish task rather than a code behavior change unless shell/template code must be patched. Validation replaces a new test unless production code changes become necessary.

No-test waiver for recovery slice:
- The intended change is publishing/recovering an archived design artifact and recording analysis, not changing runtime code.
- Replacement validation: source/artifact discovery evidence, `wiki:validate` on the recovered artifact, `design.publish` output with version id, archive JSON/version route checks, `/design-wiki` route check, and browser/fetch verification.

If shell/template code is changed in this task, add a focused red/green test before production edits.

## files changed

- `.task/design/recover-old-os-spec-and-document-shell-degradation/workpad.md`

## workspace-owned: files changed

- `.task/design/recover-old-os-spec-and-document-shell-degradation/workpad.md`

## workspace-owned: activity log

- 2026-06-06 13:54:46 fs.write: `.task/design/recover-old-os-spec-and-document-shell-degradation/workpad.md`
- 2026-06-06: Context search for old OS spec / degradation notes returned no direct hits.
- 2026-06-06: Ko asked to recover now and to reason about why the newer spec degraded.
- 2026-06-06: Ran `stream.context` for design and started task from `stream/design`.
- 2026-06-06: Read `areas/consuelo-design/AGENTS.md`, `packages/consuelo-website/DESIGN.md`, `packages/consuelo-design/templates/digital-eguides/spec.md`, and `packages/consuelo-design/templates/digital-eguides/reader-shell.md`.

## workspace-owned: validation evidence

- 2026-06-06 14:16:23 `checkFiles`: passed — OK
- 2026-06-06 14:18:12 `review.run`: passed — OK
- 2026-06-06 14:18:27 `verify`: passed — OK

## key decisions

- Keep this task focused on recovery and diagnosis.
- Put shell/template automation into a follow-up task unless recovery proves a small shell patch is mandatory.

## notes for ko

- Initial hypothesis: the degradation happened because the good artifacts had a strong authored scene/content model while the current spec path asks agents to produce too much structure and UI judgment. The fix is likely to move more UI/editorial scaffolding into the shell/typed input schema so agents provide typed scenes, not bespoke layouts.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "docs(design): recover old OS spec" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`
- `packages/consuelo-website/DESIGN.md`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: TDD red evidence

- 2026-06-06 14:06:55 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: failed exit 1 trace: `trc_90eff42ff7e5`
  - output: sts/consuelo-design-theme.test.js:[2m44:18[22m[39m [90m 42|[39m [90m 43|[39m [34mtest[39m([32m'emits valid generated version-history server strings'[39m[33m,[39m () [33m=>[39m { [90m 44|[39m expect(source).toContain(`'<li><a href="' + safe(version.path) + '">… [90m |[39m [31m^[39m [90m 45|[39m expect(source).toContain(`'<body data-version-count="' + versions.le… [90m 46|[39m })[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-06 14:09:59 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: failed exit 1 trace: `trc_adbeb2953ffd`
  - output: it(1);[39m [31m+ });[39m [31m+[39m [31m+[39m [36m [2m❯[22m tests/consuelo-design-theme.test.js:[2m49:18[22m[39m [90m 47|[39m [90m 48|[39m [34mtest[39m([32m'restarts generated archive server after rewriting it'[39m[33m,[39m () [33m=>[39m { [90m 49|[39m expect(source).toContain("writeArchiveServer(ip);\n const target = … [90m |[39m [31m^[39m [90m 50|[39m })[33m;[39m [90m 51|[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-06 14:07:41 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: failed exit 1 trace: `trc_19382b8d09da`
  - output: sts/consuelo-design-theme.test.js:[2m45:18[22m[39m [90m 43|[39m [34mtest[39m([32m'emits valid generated version-history server strings'[39m[33m,[39m () [33m=>[39m { [90m 44|[39m expect(source).toContain(`'<li><a href="' + safe(version.path) + '">… [90m 45|[39m expect(source).toContain(`'<body data-version-count="' + versions.le… [90m |[39m [31m^[39m [90m 46|[39m })[33m;[39m [90m 47|[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-06 14:08:54 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: failed exit 1 trace: `trc_2638983a6ace`
  - output: sts/consuelo-design-theme.test.js:[2m45:18[22m[39m [90m 43|[39m [34mtest[39m([32m'emits valid generated version-history server strings'[39m[33m,[39m () [33m=>[39m { [90m 44|[39m expect(source).toContain(`'<li><a href="' + safe(version.path) + '">… [90m 45|[39m expect(source).toContain(`'<body data-version-count="' + versions.le… [90m |[39m [31m^[39m [90m 46|[39m })[33m;[39m [90m 47|[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-06 14:09:23 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: passed exit 0 trace: `trc_bea31b27ddc3`
  - output: → tmux: opensaas-design-recover-old-os-spec-and-document-shell-degradati-ffa3b800 $ vitest run tests/consuelo-design-theme.test.js
- 2026-06-06 14:10:33 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: passed exit 0 trace: `trc_b7de6bc14ad0`
  - output: → tmux: opensaas-design-recover-old-os-spec-and-document-shell-degradati-ffa3b800 $ vitest run tests/consuelo-design-theme.test.js
- 2026-06-06 14:12:33 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: passed exit 0 trace: `trc_5654c53005ba`
  - output: → tmux: opensaas-design-recover-old-os-spec-and-document-shell-degradati-ffa3b800 $ vitest run tests/consuelo-design-theme.test.js

## recovery update — 2026-06-06

### recovered artifact source

Best recoverable source found:

- `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/specs/streamos-v1-spec/index.html`
- Title: `Consuelo OS V1 Spec - OS Cloud Roadmap`
- Source validation passed: `bun run wiki:validate -- --input <source>/index.html`, trace `trc_53ea9f22a150`, result `{ ok: true, missing: [] }`.
- The pre-June-2 old artifact was not recoverable from git because `.od` archive artifacts are ignored. `/tmp/streamos-v1-spec` was missing. The live local archive copy was the best recoverable source.

### live recovery performed

Recovered direct Tailnet route:

- Current route: `http://100.112.173.49:53935/specs/streamos-v1-spec`
- Version history route: `http://100.112.173.49:53935/specs/streamos-v1-spec/versions`
- Immutable recovered version: `http://100.112.173.49:53935/specs/streamos-v1-spec/versions/2026-06-06T14-02-52-793Z`
- Wiki route: `http://100.112.173.49:53935/design-wiki`

Live validation, trace `trc_82b39e394014`:

- Current route returned 28,387 bytes, title `Consuelo OS V1 Spec - OS Cloud Roadmap`, markers `Consuelo OS V1 Spec`, `ScrollSmoother`, and `smooth-wrapper`.
- History route returned 533 bytes, title `Archived versions - Consuelo OS V1 Spec`, marker `data-version-count="1"`.
- Immutable version route returned 28,387 bytes, title `Consuelo OS V1 Spec - OS Cloud Roadmap`, markers `ScrollSmoother` and `smooth-wrapper`.
- `/design-wiki` returned 31,269 bytes, title `Consuelo Wiki`, markers `Consuelo OS V1 Spec` and `Recently Updated`.

Browser validation, trace `trc_23d325bb8483`:

- URL: `http://100.112.173.49:53935/specs/streamos-v1-spec`
- Title: `Consuelo OS V1 Spec - OS Cloud Roadmap`
- Screenshot: `/tmp/opensaas-screenshots/100.112.173.49-2026-06-06T14-17-06.png`
- Accessibility snapshot included spec navigation, Back to top, H1, section links, OS Cloud/local dogfood summary, local/remote/differentiator cards, decisions, architecture, risks, and ship checklist groups.

### bugs found during recovery

Recovery exposed two real bugs in the versioned design archive publisher:

1. Generated version-history server JavaScript used invalid quote escaping and emitted code like `href="" + safe(...)`, causing Bun to fail parsing generated `server.ts`.
2. `ensureArchiveServer` could write a new `server.ts` but return early when an old server still answered `/design-wiki`, leaving stale route logic active and making `/versions` 404.

Both are now patched in `packages/workspace/scripts/consuelo-design.ts` with focused tests in `packages/workspace/tests/consuelo-design-theme.test.js`.

### test-first evidence added after bug discovery

- Red test for generated version-history strings failed before the escaping fix.
- Red test for server restart behavior failed before moving `stopArchiveServer()` ahead of the early current-wiki check.
- Green: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed, 4 tests, trace `trc_5654c53005ba`.
- Static: `checkFiles` passed for `packages/workspace/scripts/consuelo-design.ts` and `packages/workspace/tests/consuelo-design-theme.test.js`, trace `trc_8eb345a77b37`.

### degradation diagnosis

The old OS spec and current roadmap worked because they had a strong authored scene model. The artifact was not just a generic outline. It had a hero thesis, current-state summary, cards for wedge/product/differentiator, decision cards, architecture/flow sections, risk panels, and a ship checklist. The shell supplied a stable reader experience, and the content was already shaped into scenes that mapped cleanly into components.

The degraded newer spec happened because too much responsibility moved back to the generating agent. The spec template asks for broad sections, but it does not force the agent to emit a typed scene contract. That lets the agent invent hierarchy, decide which UI modules to use, and drift into generic spec prose. In OS specifically, the input also drifted from `company computer / agent-ready workspace` toward a narrower `OS Cloud roadmap` framing, so the resulting artifact became more implementation-report-like and less like the polished Consuelo strategic spec Ko liked.

The next shell/template task should make agents provide typed content, not bespoke layout. Recommended shell-owned typed input:

- `hero`: title, eyebrow, thesis, status pills.
- `summaryScene`: current state, why now, decision sentence.
- `positioningCards`: wedge, buyer, differentiator, category language.
- `decisionSet`: non-reversible decisions with rationale.
- `architectureFlow`: nodes and edges, rendered by shell.
- `requirementsMatrix`: area, requirement, why, validation.
- `riskPanels`: risk, trigger, mitigation.
- `timeline` or `sequence`: phases/checkpoints.
- `shipChecklist`: grouped work ledger with status.
- `openQuestions`: question cards.

The shell should own layout, responsive behavior, card/grid/table/details styling, nav, scroll behavior, and section ordering. Future agents should pass this typed structure into the renderer, and the renderer should produce the OS spec/current roadmap form automatically.


## workspace-owned: test selection

- changed files: `.task/design/recover-old-os-spec-and-document-shell-degradation/current.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/evidence-log.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/read-log.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/session.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/workpad.md`, `.task/tasks/design/recover-old-os-spec-and-document-shell-degradation.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation update — 2026-06-06

- Review passed against `origin/stream/design` with 0 issues from this change; one pre-existing ERROR_HANDLING finding remains at `packages/workspace/scripts/consuelo-design.ts:1087`, trace `trc_6e5eccff24e9`.
- Verify passed against `origin/stream/design` and wrote a publish-valid stamp, trace `trc_91c64d8e3821`.
- Final changed code remains scoped to `packages/workspace/scripts/consuelo-design.ts` and `packages/workspace/tests/consuelo-design-theme.test.js`.

## recovery caveat

The live `.od` archive is ignored local runtime state, not a tracked repo artifact. The direct Tailnet route is recovered now, and the PR ships the generator fixes needed so future versioned publishes do not recreate the same invalid server/stale-server failure.
