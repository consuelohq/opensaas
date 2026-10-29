# Mount OS public pages and switch Dialer domains without auth changes

branch: `task/website/mount-os-public-pages-and-switch-dialer-domains-without-auth-changes`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2661
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

## Approved scope and frozen dependency graph

Ko selected keeping os.consuelohq.com root as the existing login. Approved target: OS marketing /about/, OS documentation /docs/, Dialer marketing consuelohq.com/www and Dialer docs docs.consuelohq.com. Preserve calls.consuelohq.com, existing Google OAuth registrations/origins/callbacks, MCP URL/audience, cookies, DO/D1 state, secrets, WAF and the auth/workspace catch-all routes. Do not initiate carrier calls. Existing queued phone test remains unapproved.

Fresh main 1e282c8e8739cd858e2dc3cb03273212002868c5; stream synced with main at d3d686b6fe961d171762e63b4eddb82586dae390 without conflicts. Sync verification returned pending and is not a full validation receipt. Begin from this task's managed worktree. DEV-1636/1637 remain open/unassigned; preserve those independent scopes where possible.

Dependency graph: base-aware public URL contracts + phase-aware deployment contracts -> OS website/docs builds and isolated deployed previews -> actual subpath navigation/assets/Markdown/search/translation/legacy URL checks -> source review/full verification/publication -> main merge with legacy phase retained -> set os-mounted phase and mount only narrow OS public namespaces -> confirm auth/MCP identity and existing connection -> activate dialer phase for root public website/docs -> verify final public routes, auth preservation and rollback receipts. Persist phase/ownership in release automation so future pushes cannot undo the split.

Own existing public package routing/configuration, focused deployment orchestration and release-plan/workflow wiring. Use separate public Worker namespace routes; do not change the auth Worker or its os.consuelohq.com/* route. Stage without production routes before activation. Preserve current translation credentials/state behind its existing service if a new OS docs deployment needs them. Unknown deployment phases fail closed.

## Test-first contract

behavior under test: public OS apps function under /about/ and /docs/ with correct links/assets/runtime endpoints; the login and MCP paths remain owned by the original authority. Each deployment phase sends the correct source package to the correct service and never redeploys auth for public-only changes.
existing local pattern: independently Bun-owned Astro website/docs packages, generated Cloudflare deployment configs, immutable preview builds, tested release selection, required real browser checks.
new or changed tests: base-path URL and rendered link checks; sidebar/breadcrumb/Markdown/translation normalization; phase release selection and provider config boundaries; legacy URL redirects and preservation of all protected/auth route families; actual deployed smoke and unchanged control-plane identities.
focused red command: new base-path and release-phase contract tests against current root-only configuration, plus existing rendered package suites with the intended base paths.
expected red failure: current docs/website output uses root paths/canonicals and release automation has no durable public-layout phases or correct final package ownership.
no-test waiver: none for behavior changes; plain operational receipts/handoffs do not require tests.

- 2026-10-29 04:15:32 append: `.task/website/mount-os-public-pages-and-switch-dialer-domains-without-auth-changes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 04:15:32 fs.write: `.task/website/mount-os-public-pages-and-switch-dialer-domains-without-auth-changes/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 04:38:12 `review.run`: passed — OK
- 2026-10-29 04:39:22 `review.run`: passed — OK
- 2026-10-29 04:47:05 `review.run`: passed — OK
- 2026-10-29 04:52:19 `verify`: passed — OK

## Implementation and focused evidence

Approved URL choice: OS login remains at root; public OS site at /about/, docs at /docs/.
All four public packages build. Release phase and subpath tests passed after expected red.
Production Dialer marketing: 9 tests passed; browser smoke verified pricing/setup, malformed plan input, 79 links and motion behavior.
OS mounted previews: website b318ee21-3f0d-442d-8d56-f14128dc4141; docs ccfaf3be-3142-4377-84a1-33377a6ed803. Both 375px and 1440px browser checks passed, including mounted navigation, images, Markdown, and desktop Pagefind search.
Auth authority remains deployment 0d8b726f-e296-439a-8fba-745d45c89176 / version 2ddfd3b1-71be-452c-938c-503b2fe5df03. Health and issuer metadata still pass.
Translation: both existing production docs and new mounted preview return the same 503 translation_provider_unconfigured; English fallback remains. No translation secret was exported.
The website preview deploy lost its OS response; provider readback proved deployment succeeded, so it was not blindly retried.

## Activation / rollback plan

Default phase legacy. Only dispatch website/docs, never all/os/dialer. Set repository variable CONSUELO_PUBLIC_SITE_PHASE=os-mounted to mount new OS namespaces. Verify root login/issuer/MCP route and namespace responses; then set dialer and dispatch website/docs individually.
Website rollback: restore Pages deployment from private baseline and phase os-mounted. Docs rollback: restore docs.consuelohq.com/* route script to null (do not delete the bypass route); original consuelo-docs Worker/custom domain remains in place. Auth route/Worker/state are outside all public deployments.

Scope pressure: full docs tests exposed stale generated skill/tool reference pages and date assertions restricted to July/August. Reconciled generated public references to committed registries, retained exact-source tests, and accepted valid ISO evidence dates. Auth/runtime source remains untouched.

Final gate investigation: the apparent background restart was a failed gate whose completed result expired after 30 seconds. Raw verify output identified stale workflow command assertions and the new translation proxy await needing a local catch. Both are fixed; 26 focused workflow/security-policy tests pass. No gate was skipped or bypassed. Structural website assertions now use current public navigation/platform installer contracts (21 pass). OS docs all 105 pass. Exact absolute legacy Markdown redirects have regression coverage.
