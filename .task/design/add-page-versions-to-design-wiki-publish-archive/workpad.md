# add page versions to design wiki publish archive

branch: `task/design/add-page-versions-to-design-wiki-publish-archive`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/814/add-page-versions-to-design-wiki-publish-archive
github pr: https://github.com/consuelohq/opensaas/pull/814
started: 2026-06-06

## acceptance criteria

- [x] Publishing the same design wiki page twice preserves both immutable artifacts.
- [x] The clean page URL continues to serve the current/latest artifact.
- [x] Each historical publish gets a stable version URL under the page route.
- [x] `/design-wiki` continues to show one current card per page.
- [x] Archive payload migration preserves existing version 1 entries.
- [x] The archive server can serve both current page routes and historical version routes from archive JSON.
- [x] Pagefind still indexes current wiki content.
- [x] Focused tests cover payload migration, immutable version creation, and server version-route markers.
- [ ] Work is promoted through the `stream/design` review PR.

## plan

1. Read design archive/publish code, reader-shell policy, existing archive tests, and recent design context. Done.
2. Write/extend focused tests first so the current implementation fails on missing page-version semantics. Done.
3. Implement version 2 archive schema with `pages` history while keeping `entries` as current wiki cards. Done.
4. Materialize local publishes into immutable version directories and keep a current copy for clean URLs. Done.
5. Update generated archive server to serve `/versions` and `/versions/:versionId` for page history. Done.
6. Keep `/design-wiki` current-card behavior and search data stable. Done.
7. Run focused tests, syntax/static checks, review, and publish workflow. In progress.

## current status

- Implementation complete locally.
- Focused red/green test passed.
- Runtime smoke with fake Tailscale proved two publishes create two versions and current artifact remains available.
- Need final review/verify and task promotion.

## test-first contract

Behavior under test: design wiki archive publishing must preserve immutable per-page versions while keeping the clean page URL and `/design-wiki` current-card behavior stable.

Existing local pattern to follow: `packages/workspace/tests/consuelo-design-theme.test.js` statically inspects `packages/workspace/scripts/consuelo-design.ts` for generated wiki behavior markers.

New or changed tests:
- Extended `packages/workspace/tests/consuelo-design-theme.test.js` with source-level assertions for version 2 archive schema, immutable version path helpers, migration from version 1 entries into `pages`, historical route support in the generated archive server, and update logic that appends versions instead of replacing history.

Focused red command:

```bash
bun --cwd packages/workspace test tests/consuelo-design-theme.test.js
```

Expected red failure:
- Test fails because `DesignArchivePayload` is still `version: 1`, there is no `pages` history map, no `DesignArchivePageVersion`, no version path helper, no version route handling, and `materializeArchiveTarget` currently deletes/replaces the only current artifact slot.

Red evidence:
- 2026-06-06 trace `trc_28960cbcdd3a` earlier red run failed exactly on missing `type DesignArchivePageVersion = {` while the existing theme test passed.

Green evidence:
- 2026-06-06 trace `trc_42f20aca8d77`: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed, 2 tests.

## files changed

- `.task/design/add-page-versions-to-design-wiki-publish-archive/current.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/evidence-log.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/read-log.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/session.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/workpad.md`
- `.task/tasks/design/add-page-versions-to-design-wiki-publish-archive.json`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: files changed

- `.task/design/add-page-versions-to-design-wiki-publish-archive/current.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/evidence-log.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/read-log.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/session.json`
- `.task/design/add-page-versions-to-design-wiki-publish-archive/workpad.md`
- `.task/tasks/design/add-page-versions-to-design-wiki-publish-archive.json`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: activity log

- 2026-06-06 05:59:25 fs.write: `.task/design/add-page-versions-to-design-wiki-publish-archive/workpad.md`
- 2026-06-06: Added red test for page-level versioning markers.
- 2026-06-06: Cleaned the ignored local `/version-smoke` smoke entry and directories after proof.
- 2026-06-06: Fake Tailscale publish smoke initially failed because the smoke artifact lacked an outer `<html>` element and Pagefind rejected it; cleaned scratch `/version-smoke` archive entry and reran with valid HTML.
- 2026-06-06: Implemented version 2 archive payload, page/version types, immutable version artifact paths, current artifact paths, migration from v1 payloads, generated archive server version routes, and current wiki version-count metadata.
- 2026-06-06: Ko approved implementation after exploration.
- 2026-06-06: Ran `stream.context` for design and started task from `stream/design`.
- 2026-06-06: Read `areas/consuelo-design/AGENTS.md` with task-scoped `fs.read`.
- 2026-06-06: Read `packages/workspace/scripts/consuelo-design.ts`, existing wiki test, and reader shell template sections.
- 2026-06-06: Runtime dry-run initially caught a generated string escaping bug not caught by `node --check`; fixed generated `renderVersionHistoryPage` quote escaping.

## workspace-owned: validation evidence

- Red: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` failed with one failing test on missing `type DesignArchivePageVersion = {`; trace `trc_28960cbcdd3a`.
- Green: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed with 2 tests; trace `trc_42f20aca8d77`.
- Syntax/static: `checkFiles` passed for `packages/workspace/scripts/consuelo-design.ts` and `packages/workspace/tests/consuelo-design-theme.test.js`; trace `trc_a988f2b269f1`.
- CLI dry-run: `cd packages/workspace && bun run consuelo-design publish --dry-run --target <tmpdir> --path /version-smoke --name 'Version Smoke' --template spec --json` passed and returned `versionId`; trace `trc_24a4211e656f`.
- Runtime smoke with fake Tailscale: two real publishes to ignored local archive returned payload `version: 2`, current artifact path `artifacts/current/version-smoke`, `versionCount: 2`, two version paths under `/version-smoke/versions/<versionId>`, both version artifacts existed, generated server contained `entryForVersionRoute` and `Archived versions`; trace `trc_939d4f289a80`.
- Design boundary check: `cd packages/workspace && bun run consuelo-design check --json` passed; trace `trc_15af99f4888b`.
- 2026-06-06 06:01:00 `checkFiles`: passed — OK
- 2026-06-06 06:02:07 `review.run`: passed — OK
- 2026-06-06 06:02:22 `verify`: passed — OK

## key decisions

- Use page-level versioning inside the existing design archive instead of adopting a full docs-release versioning framework.
- Keep `entries[]` as the current `/design-wiki` listing for compatibility and Pagefind card lookup.
- Add a `pages` map keyed by stable page id for page history and rollback-safe immutable versions.
- Use `artifacts/current/<page>` for clean current routes and `artifacts/versions/<page>/<versionId>` for immutable history.
- Treat rollback as a future publish of an older version into a new current version, not deletion or pointer mutation.

## notes for ko

- This task is infrastructure-only. It does not yet republish or reconstruct the old OS spec.
- The old pre-June-2 OS artifact was not present in the current archive during exploration.
- The versioning registry is Docusaurus-inspired in concept, but page-level rather than site-release-level.

## improvements noticed

- `code.run` was broken in the main checkout during exploration due to a missing `./lib/codemode/tools/index`; this task used typed fs/task tools instead.
- `bun --cwd packages/workspace run ...` printed Bun help in this environment; using `cd packages/workspace && bun run ...` was the reliable invocation.

## issues and recovery

- 2026-06-06: Initial workpad `fs.write` failed because the file already existed and the tool requires explicit overwrite; retried with force.
- 2026-06-06: `fs.patch` was called with an unsupported patch-list shape; recovered with a bounded task-scoped Python replacement.
- 2026-06-06: `node --check` passed while Bun runtime rejected an over-escaped generated server string; recovered by simplifying the generated safe-html helper and validating with Bun CLI dry-run.
- 2026-06-06: First fake-publish smoke used HTML without an outer `<html>` element, causing Pagefind failure after archive metadata write. Cleaned the scratch ignored archive entry and reran with valid HTML.

---

## publish checklist

```bash
bun run task:push -- --message "feat(design): add design wiki page versions" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: TDD green evidence

- 2026-06-06 06:00:52 `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`: passed exit 0 trace: `trc_0394a9b04dba`
  - output: → tmux: opensaas-design-add-page-versions-to-design-wiki-publish-archive-e8d04079 $ vitest run tests/consuelo-design-theme.test.js

## workspace-owned: test selection

- changed files: `.task/design/add-page-versions-to-design-wiki-publish-archive/current.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/evidence-log.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/read-log.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/session.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/workpad.md`, `.task/tasks/design/add-page-versions-to-design-wiki-publish-archive.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation update — 2026-06-06

Additional validation after cleanup:

- Focused green rerun passed: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js`, trace `trc_0394a9b04dba`.
- Static/syntax rerun passed: `checkFiles` for `packages/workspace/scripts/consuelo-design.ts` and `packages/workspace/tests/consuelo-design-theme.test.js`, trace `trc_bb7a61864a76`.
- CLI dry-run passed after cleanup and returned a `versionId`, trace `trc_e44a14637005`.
- Runtime smoke with fake Tailscale passed after cleanup: two publishes produced archive payload `version: 2`, current artifact path `artifacts/current/version-smoke`, `versionCount: 2`, two historical `/version-smoke/versions/<versionId>` paths, both version artifacts present, generated server containing `entryForVersionRoute` and `Archived versions`; trace `trc_87534b8c2930`.
- Design boundary check passed: `cd packages/workspace && bun run consuelo-design check --json`, trace `trc_75e41a0b60b7`.
- Review passed against `origin/stream/design` with zero issues from this change; one pre-existing ERROR_HANDLING finding remains in `packages/workspace/scripts/consuelo-design.ts:1087`; trace `trc_05f6f2104e2d`.
- Verify passed against `origin/stream/design` and wrote publish-valid stamp; trace `trc_f2097b303d39`.

Recovery note: a long workpad rewrite through `fs.write` was blocked by the wrapper, so this compact final validation update was appended through a task-scoped command.
