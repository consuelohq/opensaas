# Redirect legacy device login to canonical OS authority

branch: `task/website/redirect-legacy-device-login-to-canonical-os-authority`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2665
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

behavior under test: legacy consuelohq.com/login/device redirects to the existing canonical OS authority with its full query intact; Dialer contains no duplicate OS authentication UI.
existing local pattern: Cloudflare Pages public/_redirects; canonical authority /login/device returned 200/no-store in read-only preflight.
new or changed tests: marketing source boundary assertion; real preview request with redirects disabled verifies query preservation.
focused red command: bun test packages/dialer-website/tests/marketing-contract.test.ts -t 'device login'
expected red failure: copied OS authentication page exists and redirect configuration is absent.
no-test waiver: none.

## Scope and next action

Address Codex P1 review comment 4408835102 on PR 2663. Delete duplicated Dialer device UI, add two exact legacy path redirects. Preserve existing OS authority/routes/bindings and provider callback relay. No credentials, auth registrations, carrier or billing mutation. Review/full verify, publish, promote, resolve only fixed review threads, then wait current CI and perform phased public cutover.

- 2026-10-29 05:03:45 append: `.task/website/redirect-legacy-device-login-to-canonical-os-authority/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 05:03:45 fs.write: `.task/website/redirect-legacy-device-login-to-canonical-os-authority/workpad.md`
- 2026-10-29 05:05:07 fs.write: `.task/website/redirect-legacy-device-login-to-canonical-os-authority/workpad.md`

## Focused evidence

Red test failed because the duplicate device UI existed. After removal, source boundary passed and the preview build succeeded. Actual Cloudflare deployment 58867c8d.consuelo-dialer-website-preview.pages.dev and its main alias return HTTP 302 for both /login/device and /login/device/. Raw user_code, state, and encoded returnTo query parameters were preserved exactly, with redirect following disabled; no auth grant was initiated. Canonical OS device page was independently 200/no-store. The project's bare preview hostname still selects its older production branch, so proof uses the exact new deployment and branch alias, not that hostname.

- 2026-10-29 05:05:07 append: `.task/website/redirect-legacy-device-login-to-canonical-os-authority/workpad.md`

## Additional review finding / test-first evidence

Codex P2 4408866672 found the OS video poster outside /about/. Own this one attribute fix plus the shared mounted browser contract. Expanded the existing browser check to include video posters/source URLs and all same-origin failed requests. It failed red against the actual preview with /media/home/connect-live-session-poster.webp. Apply the existing withSiteBase helper to poster; redeploy only the isolated OS preview and rerun this browser contract before the final gate. No auth authority source changes.

## workspace-owned: validation evidence

- 2026-10-29 05:09:04 `verify`: passed — OK
