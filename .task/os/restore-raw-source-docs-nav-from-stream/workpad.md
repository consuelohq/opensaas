# Restore raw source docs nav from stream

branch: `task/os/restore-raw-source-docs-nav-from-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/778/restore-raw-source-docs-nav-from-stream
github pr: https://github.com/consuelohq/opensaas/pull/778
started: 2026-06-05

## acceptance criteria

- Restore the raw OS source docs section in Mintlify navigation so the shipped pages are visible in the sidebar.
- Preserve generated raw-source docs and source-owned navigation files.
- Add a clear warning for the next docs agent.
- Validate JSON parse, raw-source freshness, OS docs validation, localized nav, lint, review, and verify.

## Test-first contract

Behavior under test: `packages/consuelo-docs/docs.json` must contain OS `Tools` with `os/tools/default-steering`, `os/tools/tool-manifest`, `os/tools/scripts`, and `os/tools/decision-engine`, including localized routes.

New tests: no unit test. This is docs/nav repair; focused JSON assertions plus existing generator/validator are the correct test surface.

Red command: focused Python nav assertion before the fix.
Expected red failure: OS Tools group missing; current groups are Overview, Concepts, Skills.

## next-agent warning

For raw-source docs work, direct URLs are not enough. Mintlify can render a page directly while the sidebar still omits it. Always verify `packages/consuelo-docs/docs.json` and the source-owned navigation files include the generated raw-source pages before publishing:

- `os/tools/default-steering`
- `os/tools/tool-manifest`
- `os/tools/scripts`
- `os/tools/decision-engine`

If a stream/main merge touches `packages/consuelo-docs/docs.json`, re-check this group before publishing.

- 2026-06-05 05:36:24 write: `.task/os/restore-raw-source-docs-nav-from-stream/workpad.md`

## files changed

- `packages/consuelo-docs/package.json`

## workspace-owned: files changed

- `packages/consuelo-docs/package.json`

## workspace-owned: activity log

- 2026-06-05 05:36:24 fs.write: `.task/os/restore-raw-source-docs-nav-from-stream/workpad.md`
- 2026-06-05 05:36:50 fs.write: `packages/consuelo-docs/package.json`
- 2026-06-05 05:44:12 fs.write: `.task/os/restore-raw-source-docs-nav-from-stream/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-05 05:36:35 `python3 -c import json
expected=['os/tools/default-steering','os/tools/tool-manifest','os/tools/scripts','os/tools/decision-engine']
data=json.load(open('packages/consuelo-docs/docs.json'))
os=next(t for t in data['navigation']['languages'][0]['tabs'] if t.get('tab')=='OS')
tools=next((g for g in os['groups'] if g.get('group')=='Tools'),None)
assert tools and tools.get('pages')==expected
print('OS Tools nav present')`: failed exit 1 trace: `trc_b1a1f311d18d`
  - output: ering','os/tools/tool-manifest','os/tools/scripts','os/tools/decision-engine'] data=json.load(open('packages/consuelo-docs/docs.json')) os=next(t for t in data['navigation']['languages'][0]['tabs'] if t.get('tab')=='OS') tools=next((g for g in os['groups'] if g.get('group')=='Tools'),None) assert tools and tools.get('pages')==expected print('OS Tools nav present') Traceback (most recent call last): File "<string>", line 6, in <module> assert tools and tools.get('pages')==expected ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ AssertionError error: script "task:exec" exited with code 1

- 2026-06-05 05:36:50 write: `packages/consuelo-docs/package.json`

## workspace-owned: TDD green evidence

- 2026-06-05 05:37:36 `python3 -c import json
expected=['os/tools/default-steering','os/tools/tool-manifest','os/tools/scripts','os/tools/decision-engine']
data=json.load(open('packages/consuelo-docs/docs.json'))
os=next(t for t in data['navigation']['languages'][0]['tabs'] if t.get('tab')=='OS')
tools=next((g for g in os['groups'] if g.get('group')=='Tools'),None)
assert tools and tools.get('pages')==expected
print('OS Tools nav present')`: passed exit 0 trace: `trc_eba3884c4133`
  - output: for g in os['groups'] if g.get('group')=='Tools'),None) assert tools and tools.get('pages')==expected print('OS Tools nav present')" → tmux: opensaas-os-restore-raw-source-docs-nav-from-stream-7e66a3c6 expected=['os/tools/default-steering','os/tools/tool-manifest','os/tools/scripts','os/tools/decision-engine'] data=json.load(open('packages/consuelo-docs/docs.json')) os=next(t for t in data['navigation']['languages'][0]['tabs'] if t.get('tab')=='OS') tools=next((g for g in os['groups'] if g.get('group')=='Tools'),None) assert tools and tools.get('pages')==expected print('OS Tools nav present')

## workspace-owned: validation evidence

- 2026-06-05 05:42:41 `review.run`: passed — OK
- 2026-06-05 05:42:42 `review.run`: passed — OK
- 2026-06-05 05:42:42 `review.run`: passed — OK

## final status

Implemented from `stream/os` after the main-based task PR conflicted with stream. Restored OS Tools nav, package scripts, source-owned navigation, generated docs, and localized fallbacks.

Validation:
- Red focused nav assertion failed before the fix.
- Green focused nav assertion passed after generation.
- Localized nav assertion passed for all docs languages.
- `check-os-source-docs` passed.
- `validate-os-docs` passed.
- `lint` passed with only the existing Node fs.Stats deprecation warning.
- `git diff --check` passed.
- `verify --base origin/stream/os --review-arg --no-tests` passed and wrote the publish-valid stamp.

- 2026-06-05 05:44:12 append: `.task/os/restore-raw-source-docs-nav-from-stream/workpad.md`
