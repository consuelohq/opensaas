# match os sites launcher ui

branch: `task/os/match-os-sites-launcher-ui`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1172/match-os-sites-launcher-ui
github pr: https://github.com/consuelohq/opensaas/pull/1172
started: 2026-06-22

taskSession: `tsk_72f93dee932c`

## acceptance criteria

- [x] OS local Sites launcher visually matches the current public `sites.consuelohq.com` launcher structure.
- [x] Keep OS-local route targets for generated local pages where appropriate.
- [x] Include the Markdown-style link chrome, GTM row, writing block, public-style typography, responsive rules, and hotkeys.
- [x] Update focused Sites CLI regression coverage.
- [x] Run focused OS validation and review/verify gates.

## exploration

- Public launcher source: `packages/workspace/scripts/office.ts` `renderSitesLauncher` and `renderArchiveRootRedirect`.
- OS launcher source: `packages/os/scripts/lib/sites.ts` `baseStyles` and `buildSitesIndex`.
- OS test source: `packages/os/tests/sites-cli.test.ts` launcher coverage.
- Prior OS task: `.task/os/terminal-style-sites-launcher/workpad.md` explains why the current simplified local launcher differs.

## implementation

- Replaced the simplified OS launcher with the public Markdown-terminal presentation: `CONSUELO OS █`, `~~~` rules, profile block, Markdown-style link chrome, GTM/Sites rows, Writing block, mobile responsive CSS, and numeric hotkeys.
- Preserved OS-local route behavior for generated local pages: visible text matches public URLs while hrefs/hotkeys point to `office/`, `traces/`, `diffs/`, and `docs/`.
- Kept GTM external to `https://app.consuelohq.com/welcome` and kept the local Systems Engineer route on `/jobs` while displaying `/careers/systems-engineer` for UI parity.
- Added `buildMarkdownLink` to keep the repeated Markdown-link chrome consistent inside `packages/os/scripts/lib/sites.ts`.

## files changed

- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/sites-cli.test.ts`

## validation evidence

- Destructive literal preflight for `packages/os/tests/sites-cli.test.ts` passed with no hits; trace `trc_173ba669a4a6`.
- Red focused test after updating the contract failed on the old simplified launcher missing `CONSUELO OS █`; trace `trc_1122ef765561`.
- Green focused test: `bun --cwd packages/os test tests/sites-cli.test.ts` passed, 7 tests; trace `trc_7340b8bd1192`.
- Syntax/typecheck: `bun run --cwd packages/os typecheck` passed; trace `trc_de4f0dd638f8`.
- Render smoke generated `/tmp/consuelo-os-sites-launcher-ui-check/sites/index.html` and confirmed the new HTML preview; trace `trc_da510e278d8f`.
- Browser validation opened the rendered local file on iPhone preset and captured screenshot `/tmp/opensaas-screenshots/page-2026-06-22T21-27-08.png`; trace `trc_c930fe91265e`.
- Review gate passed with 0 issues; trace `trc_6853d41fb399`.
- Verify gate passed and wrote publish-valid stamp; trace `trc_3e36139de747`.

## notes

- `verify` selected zero additional registry suites, so the focused Sites CLI test is the behavior proof for this UI contract.
- `stream.sync` reported the stream was already up to date; its optional post-sync verify hit pre-existing dependency drift in a temporary stream worktree (`zod` resolution for workspace facade tests), unrelated to this task.

- 2026-06-22 21:28:21 write: `.task/os/match-os-sites-launcher-ui/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: activity log

- 2026-06-22 21:28:21 fs.write: `.task/os/match-os-sites-launcher-ui/workpad.md`
