# Restore raw source docs nav

branch: `task/os/restore-raw-source-docs-nav`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/775/restore-raw-source-docs-nav
github pr: https://github.com/consuelohq/opensaas/pull/775
started: 2026-06-05

## acceptance criteria

- [ ] Restore the raw OS source docs section in Mintlify navigation so the shipped pages are visible in the sidebar.
- [ ] Preserve the already-live generated pages and avoid rewriting unrelated docs content.
- [ ] Add a clear workpad warning for the next docs agent: direct routes are not enough; `docs.json` nav must keep the generated `os/tools/*` pages linked after stream/main merges.
- [ ] Validate `docs.json` parses and the raw-source docs routes are present in English OS nav.
- [ ] Smoke the live or built docs route/navigation path when available.
- [ ] Publish through task workflow and report the stream review PR.

## Test-first contract

Behavior under test:
- `packages/consuelo-docs/docs.json` contains an OS `Tools` group with `os/tools/default-steering`, `os/tools/tool-manifest`, `os/tools/scripts`, and `os/tools/decision-engine`.
- The same generated raw-source pages continue to exist and load by direct URL.

Existing local pattern to follow:
- `packages/consuelo-docs/scripts/generate-os-source-docs.ts` owns generated raw-source docs and nav insertion.
- `packages/consuelo-docs/scripts/validate-os-docs.ts` is the docs freshness/route validation path.

New or changed tests:
- No new unit test. This is a docs/nav repair and the existing validator plus a focused JSON route assertion cover the regression.

Focused red command:
- `python3 -c '<json route assertion>'` against `packages/consuelo-docs/docs.json` before the fix.

Expected red failure:
- Assertion fails because the OS tab only has `Overview`, `Concepts`, and `Skills`; the `Tools` group is missing.

No-test waiver:
- Runtime tests are not appropriate because this is Mintlify nav JSON plus generated docs visibility. Replacement validation: JSON parse, route assertion, generated docs freshness check, docs validator, and browser verification.

## next-agent warning

For raw-source docs work, do not stop after generating `.mdx` files. Mintlify direct routes can work while the sidebar is still wrong. Always verify the OS nav in `packages/consuelo-docs/docs.json` contains the generated raw-source pages, and validate the rendered docs sidebar after deploy. The specific pages are:

- `os/tools/default-steering`
- `os/tools/tool-manifest`
- `os/tools/scripts`
- `os/tools/decision-engine`

If a stream/main merge touches `packages/consuelo-docs/docs.json`, re-check this group before publishing.

## plan

1. Prove current nav regression with a focused JSON assertion.
2. Restore/adjust generator behavior if needed, then regenerate docs/nav from source.
3. Validate JSON, source-doc freshness, OS docs validation, and direct browser route/sidebar state.
4. Update final workpad evidence before push/PR.

- 2026-06-05 05:11:07 write: `.task/os/restore-raw-source-docs-nav/workpad.md`

## files changed

- `packages/consuelo-docs/package.json`

## workspace-owned: files changed

- `packages/consuelo-docs/package.json`

## workspace-owned: activity log

- 2026-06-05 05:11:07 fs.write: `.task/os/restore-raw-source-docs-nav/workpad.md`
- 2026-06-05 05:13:08 fs.patch: `packages/consuelo-docs/package.json`
- 2026-06-05 05:13:38 fs.write: `packages/consuelo-docs/package.json`
- 2026-06-05 05:22:56 fs.write: `.task/os/restore-raw-source-docs-nav/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-05 05:11:38 `python3 /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-handoffs/assert-os-tools-nav.py`: failed exit 1 trace: `trc_57f2e8060025`
  - output: → tmux: opensaas-os-restore-raw-source-docs-nav-9b4ec743 Traceback (most recent call last): File "/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-handoffs/assert-os-tools-nav.py", line 14, in <module> assert tools is not None, f"OS Tools group missing. Current groups: {[group.get('group') for group in os_tab['groups']]}" ^^^^^^^^^^^^^^^^^ AssertionError: OS Tools group missing. Current groups: ['Overview', 'Concepts', 'Skills'] error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/consuelo-docs/package.json`
- `packages/consuelo-docs/scripts/generate-docs-json.ts`
- `packages/consuelo-docs/scripts/generate-os-source-docs.ts`

## workspace-owned: TDD green evidence

- 2026-06-05 05:14:17 `python3 /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-handoffs/assert-os-tools-nav.py`: failed exit 1 trace: `trc_3f0bbb56688b`
  - output: → tmux: opensaas-os-restore-raw-source-docs-nav-9b4ec743 Traceback (most recent call last): File "/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-handoffs/assert-os-tools-nav.py", line 14, in <module> assert tools is not None, f"OS Tools group missing. Current groups: {[group.get('group') for group in os_tab['groups']]}" ^^^^^^^^^^^^^^^^^ AssertionError: OS Tools group missing. Current groups: ['Overview', 'Concepts', 'Skills'] error: script "task:exec" exited with code 1
- 2026-06-05 05:14:50 `python3 -c import json
expected=['os/tools/default-steering','os/tools/tool-manifest','os/tools/scripts','os/tools/decision-engine']
data=json.load(open('packages/consuelo-docs/docs.json'))
os=next(t for t in data['navigation']['languages'][0]['tabs'] if t.get('tab')=='OS')
tools=next((g for g in os['groups'] if g.get('group')=='Tools'),None)
assert tools and tools.get('pages')==expected
print('OS Tools nav present')`: passed exit 0 trace: `trc_2b0dfd0c62a8`
  - output: ools=next((g for g in os['groups'] if g.get('group')=='Tools'),None) assert tools and tools.get('pages')==expected print('OS Tools nav present')" → tmux: opensaas-os-restore-raw-source-docs-nav-9b4ec743 expected=['os/tools/default-steering','os/tools/tool-manifest','os/tools/scripts','os/tools/decision-engine'] data=json.load(open('packages/consuelo-docs/docs.json')) os=next(t for t in data['navigation']['languages'][0]['tabs'] if t.get('tab')=='OS') tools=next((g for g in os['groups'] if g.get('group')=='Tools'),None) assert tools and tools.get('pages')==expected print('OS Tools nav present')

## workspace-owned: validation evidence

- 2026-06-05 05:21:44 `review.run`: passed — OK
- 2026-06-05 05:21:45 `review.run`: passed — OK
- 2026-06-05 05:21:45 `review.run`: passed — OK
- 2026-06-05 05:21:45 `review.run`: passed — OK
- 2026-06-05 05:21:45 `review.run`: passed — OK
- 2026-06-05 05:25:20 `verify`: failed — COMMAND_FAILED
- 2026-06-05 05:25:20 `verify`: failed — COMMAND_FAILED
- 2026-06-05 05:27:43 `verify`: failed — COMMAND_FAILED
- 2026-06-05 05:27:43 `verify`: failed — COMMAND_FAILED
- 2026-06-05 05:28:32 `review.run`: passed — OK
- 2026-06-05 05:30:47 `review.run`: passed — OK
- 2026-06-05 05:30:48 `review.run`: passed — OK
- 2026-06-05 05:30:48 `review.run`: passed — OK

## final status

Implemented nav restoration and package-script restoration. Validation passed for the focused nav assertion, localized nav assertion, raw-source freshness check, OS docs validator, MDX lint, and diff whitespace check. Mintlify build still fails on the existing preview React useState issue outside this task.

- 2026-06-05 05:22:56 append: `.task/os/restore-raw-source-docs-nav/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/restore-raw-source-docs-nav/current.json`, `.task/os/restore-raw-source-docs-nav/evidence-log.json`, `.task/os/restore-raw-source-docs-nav/read-log.json`, `.task/os/restore-raw-source-docs-nav/session.json`, `.task/os/restore-raw-source-docs-nav/workpad.md`, `.task/tasks/os/restore-raw-source-docs-nav.json`, `packages/consuelo-docs/docs.json`, `packages/consuelo-docs/l/ar/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ar/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/cs/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/cs/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/de/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/de/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/es/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/es/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/fr/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/fr/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/it/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/it/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ja/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ja/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ko/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ko/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/pt/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/pt/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ro/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ro/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ru/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/ru/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/tr/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/tr/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/zh/os/tools/default-steering.mdx`, `packages/consuelo-docs/l/zh/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/navigation/base-structure.json`, `packages/consuelo-docs/navigation/navigation.template.json`, `packages/consuelo-docs/os/tools/default-steering.mdx`, `packages/consuelo-docs/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/package.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
