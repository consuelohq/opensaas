# Prepare authentication-safe Dialer domain cutover

branch: `task/website/prepare-authentication-safe-dialer-domain-cutover`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2655
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-website/.gitignore`
- `packages/dialer-website/bun.lock`
- `packages/dialer-website/package.json`
- `packages/dialer-website/public/apple-touch-icon.png` (deleted)
- `packages/dialer-website/public/favicon-32x32.png` (deleted)
- `packages/dialer-website/scripts/materialize-public-assets.ts`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- `packages/dialer-website/tests/marketing-contract.test.ts`
- `packages/dialer-website/tsconfig.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/docs-production-release.test.js`
- `packages/workspace/tests/website-deploy.test.js`
- `packages/os/scripts/production-release-plan.ts`
- `packages/os/tests/production-release-plan.test.ts`


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

## Scope and dependency graph — 2026-10-28

Ko asked for Branch 3: prepare the Dialer website/docs switchover while preserving Google authentication and the main ChatGPT MCP connection. Both branch handoffs read. This task owns release integration, routing preparation and compatibility validation; production route changes remain gated on the signed-in ChatGPT baseline and passing cutover checks. Do not place carrier calls. Do not change OAuth origins, Google clients, MCP resource/audience, DO namespace, token store, signing keys, WAF policy, workspace wildcard route, or calls.consuelohq.com.

Dependency graph: current inventory + authenticated baseline -> integrate current main and website PR #2651 -> repair clean build/review/asset integrity -> classify release surfaces so website/docs changes cannot redeploy auth -> stage OS marketing and OS docs at intended paths with explicit login links -> test public-route allowlist/default authentication ownership, subpath assets/search/Markdown/translation and legacy redirects -> publish exact verified source -> cut over public content in reversible steps -> verify real ChatGPT tool call and Google login after each step -> rollback public routing on failure.

Current source: main 508441ced8a275b12d5855dec414fa17a1c92ad9; website stream 2db020bfab7a1da89248820cfb1c90ec8ad0f390. Website PR #2651 conflicts with main and its verify job fails in the clean build. Two actionable review findings: initial fragment scrolling and missing rendered-browser verification. Two committed PNG icon files have invalid signatures. Dialer docs are merged; DEV-1631/1634/1635 cover review follow-ups, while DEV-1632/1633 duplicate portions of those tasks (do not assign both sets).

Live: os.consuelohq.com/* -> consuelo-os-device-authority. Its OAuth metadata issuer is https://os.consuelohq.com, resource https://os.consuelohq.com/mcp. Google start redirects to the same origin's /login/google/callback. Workspace gateway remains separate. Anonymous Mac /mcp probes receive Cloudflare 403; that does not prove the authenticated ChatGPT path is failing. Ko has a pending baseline question. Current production workflow redeploys old OS website/docs and authority on every main push; must address before cutover.

## Test-first contract

behavior under test: publishing marketing/docs cannot replace authentication routes or redeploy the authority; the Dialer website builds from the pushed source, preserves fragment navigation and ships intact assets; public URLs use the correct product and docs base.
existing local pattern: separately owned Astro website/docs packages, Cloudflare Worker routes, scoped production release jobs, package browser contracts and task verification registry.
new or changed tests: focused build regression, fragment deep-link browser case, asset signatures, release-change classification and authentication route preservation; expand base-path browser checks if migration code is added.
focused red command: run the current Dialer website build from this managed checkout, plus new focused route/release assertions before their implementation.
expected red failure: current clean-build failure, initial fragment reset, invalid committed PNG icons, and unconditional production auth release for website/docs-only changes.
no-test waiver: none for behavior changes. Read-only preflight and workpad changes need no new tests.

- 2026-10-29 02:37:22 append: `.task/website/prepare-authentication-safe-dialer-domain-cutover/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 02:37:22 fs.write: `.task/website/prepare-authentication-safe-dialer-domain-cutover/workpad.md`
- 2026-10-29 02:58:07 fs.write: `.task/website/prepare-authentication-safe-dialer-domain-cutover/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 02:55:03 `review.run`: passed — OK

## Preflight and first repair wave

- Ko confirmed the main ChatGPT agent can complete a read-only Consuelo OS tool call. This is the pre-cutover authenticated baseline; Mac anonymous MCP probes are WAF-blocked and are not an authenticated failure.
- Ko asked to preserve the recent CI improvements. Kept the existing dialer-changes and release-dialer jobs byte-for-byte unchanged; added a separate public/OS release classifier instead. Existing CI policy contract tests pass.
- Integrated main 508441c into this task (local merge 1327048a14). Both conflicts were appended test-selector entries; retained both packages' rules and regenerated the registry.
- Reproduced CI's missing bun:test/ImportMeta types in a standalone package directory without parent node_modules. Added package-owned @types/bun, updated its lockfile through Bun, and proved an isolated frozen install/build plus five delivery tests pass.
- New icon decoder test failed against the published PNG bytes. Replaced those two binary sources with ignored build outputs generated from committed SVG; decoder checks now pass.
- New normal-motion browser deep-link test failed before the fix. Kept fragment targets during boot/pageshow; eight viewport sizes, both direct and cross-page fragment navigation, 79 internal links, pricing/setup, query handling, images and motion now pass. Browser cleanup completed.
- Added the browser contract to the critical website selector. Build generators must run in edit mode when outputs change; an initial code.call wrapper correctly reported mutation-in-verify even though all tests passed. Recovered the durable trace instead of re-running blindly.
- Focused CI/release tests: 25 pass; preserved MCP release-security tests: 3 pass. Strict review: zero issues. Full durable verification receipt: result=pass, publishValid=true, mode=full, verifiedAt=2026-10-29T02:57:02.362Z.
- No public domains, OAuth clients, auth state, WAF rules, live Dialer runtime, or carrier calls changed. Product choice pending: keep os.consuelohq.com root as login and place OS marketing at /about/, or use root for OS marketing. This affects routing preparation, not the current Google/MCP endpoint identities.

- 2026-10-29 02:58:07 append: `.task/website/prepare-authentication-safe-dialer-domain-cutover/workpad.md`
