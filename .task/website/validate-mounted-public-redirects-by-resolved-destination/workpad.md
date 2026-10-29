# Validate mounted public redirects by resolved destination

branch: `task/website/validate-mounted-public-redirects-by-resolved-destination`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2672
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

behavior under test: Mounted device redirects resolve to the canonical OS authority and preserve the complete query, whether Location is absolute or relative on the same production origin.
existing local pattern: test-public-mounts.mjs compares the raw Location header and passes on cross-origin preview but fails for Cloudflare's valid relative production redirect.
new or changed tests: Normalize only the response Location against the request URL before asserting the same canonical destination. Keep status and query checks intact.
focused red command: OS_WEBSITE_TEST_ORIGIN=https://os.consuelohq.com OS_DOCS_TEST_ORIGIN=https://os.consuelohq.com node packages/dialer-website/scripts/test-public-mounts.mjs
expected red failure: Observed ERR_ASSERTION at line 55: /login/device?... versus https://os.consuelohq.com/login/device?... . Full evidence /tmp/consuelo-os-mounted-live-browser.log.
no-test waiver: No additional tests of the test helper; run the complete existing browser contract against production and strict review/full verify.

- 2026-10-29 06:51:22 append: `.task/website/validate-mounted-public-redirects-by-resolved-destination/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 06:51:22 fs.write: `.task/website/validate-mounted-public-redirects-by-resolved-destination/workpad.md`
- 2026-10-29 06:53:39 fs.write: `.task/website/validate-mounted-public-redirects-by-resolved-destination/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 06:52:06 `review.run`: passed — OK
- 2026-10-29 06:53:27 `verify`: passed — OK

## Validation evidence

- Complete mounted public browser contract passed against https://os.consuelohq.com at 375x812 and 1440x960; includes docs search, Markdown, canonical links, all image/media paths, blog back state, RSS and both device URL variants. Evidence: /tmp/consuelo-os-mounted-live-browser-fixed.log (exit 0).
- Strict review passed with zero blockers.
- Full verify passed all four Dialer website registry suites and database guard; publishValid true at 2026-10-29T06:53:27Z.
- Production auth deployment 90ee69b5-afed-4c25-9b7c-3fa2781ba8c7 and all protected route/binding identities match the fresh current-main baseline. This change only corrects the test helper; it changes no deployed auth behavior.

- 2026-10-29 06:53:39 append: `.task/website/validate-mounted-public-redirects-by-resolved-destination/workpad.md`
