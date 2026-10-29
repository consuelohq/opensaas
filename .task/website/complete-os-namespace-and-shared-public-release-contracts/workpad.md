# Complete OS namespace and shared public release contracts

branch: `task/website/complete-os-namespace-and-shared-public-release-contracts`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2666
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

behavior under test: shared public release-script edits schedule both public jobs in every phase; all legacy device URLs redirect to the existing authority without marketing auth UI or sitemap entries; mounted RSS channel points to /about/.
existing local pattern: explicit phase classifier, site base helper, Pages/Worker Assets redirect files.
new or changed tests: per-phase classifier regression; OS structure URL-preservation contract; actual mounted artifacts and route-free Worker preview probes.
focused red command: vitest production-release-plan test for shared orchestration; inspect existing mounted sitemap/RSS artifacts for root authority leakage.
expected red failure: docs=false on shared script edits; mounted device UI and sitemap entry exist; RSS channel points at auth root.
no-test waiver: none.

## Scope / dependencies

Address PR 2663 threads PRRT_kwDORPzu_c6xbHKl, PRRT_kwDORPzu_c6xbHjw, PRRT_kwDORPzu_c6xbHj8, PRRT_kwDORPzu_c6xbHkC (shared classifier finding duplicated). Own public classifier/tests, OS marketing device redirect/RSS and asset preparation only. Do not change authority implementation, state bindings, credentials, MCP/WAF, Dialer runtime, calls or billing. Review/full verify then publish/promote before main merge and phased activation.

- 2026-10-29 05:16:17 append: `.task/website/complete-os-namespace-and-shared-public-release-contracts/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 05:16:17 fs.write: `.task/website/complete-os-namespace-and-shared-public-release-contracts/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 05:21:42 `verify`: failed — COMMAND_FAILED
- 2026-10-29 05:24:07 `verify`: passed — OK

## Gate contract migration

Full verification selected the canonical device identity suite and correctly exposed its obsolete dependency on the marketing copy. Updated only oauth-device-page-contract.test.ts to require canonical 302 redirects from both public packages and forbid duplicate auth UI. Installer live-session, browser-opening sanitization/fallback and doctor-command invariants remain unchanged; authority implementation and other canonical identity/install/Google approval tests remain in the full gate. Real Worker preview 4ee65acd-e2f0-4bcb-866c-23f64cbfa10c passed mounted 302 query preservation, RSS channel, sitemap exclusion, media and docs/search at 375px/1440px.
