# Keep OS support links on the mounted OS documentation

branch: `task/website/keep-os-support-links-on-the-mounted-os-documentation`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2664
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: OS support and launcher documentation links must follow PUBLIC_DOCS_URL after mounting; launcher OS article link must stay in /about/.
existing local pattern: siteLinks.docs and withSiteBase own public route configuration.
new or changed tests: focused source boundary check plus mounted browser paths.
focused red command: assert support and launcher import siteLinks and use siteLinks.docs; both currently contain fixed old docs origin.
expected red failure: old direct docs origin sends OS visitors to the future Dialer docs.
no-test waiver: none.

## Scope and dependency graph

Follow-up to task 2661 / stream PR 2663. Own only OS public links and their assertions. No auth/runtime, credentials, carrier calls or provider mutation. Refresh main before final promotion/merge. Review/full verify and stream workflow remain required.

- 2026-10-29 04:57:32 append: `.task/website/keep-os-support-links-on-the-mounted-os-documentation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 04:57:32 fs.write: `.task/website/keep-os-support-links-on-the-mounted-os-documentation/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 04:58:54 `verify`: passed — OK
