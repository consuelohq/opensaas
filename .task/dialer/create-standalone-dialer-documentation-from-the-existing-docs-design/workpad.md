# Branch 2: Dialer documentation

## Scope and ownership
- Own packages/dialer-documentation and focused package contracts only.
- Clone the current packages/documentation presentation, responsive behavior, search, themes, Markdown pages, and runtime translation boundary. Replace OS content and navigation with Dialer user journeys and accurate SDK reference.
- Preserve existing OS documentation, website, authentication, provider callback URLs, live numbers and all parallel edits. No production custom-domain attachment, shared bindings, recording or carrier calls.
- Publish through the established stream/dialer. Branch 1 owns the Dialer website; Branch 3 owns shared deployment wiring and final domain cutover.

## Acceptance
- Independent Bun-owned Astro/Starlight package, uniquely named worker, no copied production KV namespace or secret, no active production domain routes.
- Outcome-led content for first setup, outbound, inbound, team readiness, analytics, billing, troubleshooting and developer reference. English editorial source. Explicit preview/planned boundaries for incomplete live flows.
- Internal routes, sidebar, search, translation source, Markdown actions, footer, title and metadata agree on Dialer. No inherited OS onboarding or broken product links.
- Preserve responsive navigation, theme, search, keyboard controls, short landscape and mobile behavior.
- Focused contracts and browser coverage, build/validation, strict review and full verify. Provide exact SHA and a copyable Branch 3 handoff.

## Test-first contract
behavior under test: standalone Dialer docs exposes only curated Dialer navigation/content and safe isolated deployment configuration, while preserving the existing docs shell interactions.
existing local pattern: packages/documentation tests, validation, Markdown and translation contracts, Playwright browser harness.
new or changed tests: package/content/link/deployment isolation contracts plus built-site browser checks for mobile navigation, search, themes and Markdown.
focused red command: bun test .task/dialer/create-standalone-dialer-documentation-from-the-existing-docs-design/docs-package.contract.test.ts
expected red failure: packages/dialer-documentation does not exist.
no-test waiver: copy-only prose has no individual mirrored unit tests; package-level link/content validation and rendered checks replace those.

## Research and source
- User approved Branch 2 from the alignment chat. Source from current main 03aca1b5bb80cceeaba63a23c640d17ce411d22b.
- OS memory #16, Research Bundle: Technical Writing video vT5pcc30Ffw: plain language; adjust information depth to the reader; concrete definitions; prerequisites before task steps; expected results.
- Existing AUTHORING.md: user-intent organization, task guidance separate from reference, evidence-backed public claims.
- Nx plugin discovery found web/react/js generators but no installed Astro/Starlight clone generator. A faithful package clone is the appropriate existing pattern; no generator mutation required.
- session.start timed out at transport but completed; recovered actual session from its task metadata. No duplicate task created.

## Red evidence
Focused contracts failed 0 pass / 3 fail: package manifest, navigation module and content directory absent. The implementation now clones the tested shell and replaces its product model.

## Scoped validation wiring
Added one critical test-selection rule and regenerated its registry so future package edits run contracts, content-link validation and translation checks. This is additive package ownership metadata, not shared deployment/CI workflow changes. Branch 1 must preserve this rule when joining.

## workspace-owned: validation evidence

- 2026-10-28 21:19:12 `review.run`: passed — OK

## Full-gate integration repair
The full gate automatically ran Nx test with --coverage=false, which Bun does not accept. Configure this Bun-owned Nx target not to forward unrelated Nx runner flags. The actual four package tests had already passed; no assertions or gates were removed.

## Final implementation and local evidence

- New isolated packages/dialer-documentation: 30 curated Dialer guides plus a custom 404; eight intent-based sections; cloned responsive shell, themes, Pagefind, mobile sheets, Markdown actions and translation boundary.
- Package/Worker names: consuelo-dialer-documentation / consuelo-dialer-docs. No custom domain, copied production KV binding, provider credentials or inherited OS redirects. Generated Wrangler config readback confirms routes=[] and kv_namespaces=[].
- Existing OS docs, website, auth, LeadConnector and Dialer service source unchanged. Added only a scoped test-selector rule and its generated registry outside this package.
- Frozen Bun installation passed. Package contracts: 4 pass, 0 fail, 70 assertions. Internal-link/metadata validation: 31 authored pages. Translation contracts passed. Astro build and production Pagefind index passed without warnings after the modern memory session-driver configuration and custom 404.
- Browser acceptance on actual Cloudflare-adapter preview: 30 public routes and Markdown counterparts; production search result; theme persistence; clipboard; page actions; responsive navigation at 320x568, 390x844, 568x320, 667x375, 768x1024, 1024x768 and 1440x1000; automatic Spanish client translation with a stubbed provider; real API rejects unknown translation source; WebKit 667x375. No JS errors. Screenshots: /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-dialer-docs-85174/ .
- Full verification receipt: result=pass, mode=full, publishValid=true, 2026-10-28T21:21:13.127Z. Five selected suites passed, strict review passed, database guard passed. Review reports no project typecheck target; no separate TypeScript check is claimed. Build/contract/browser evidence is explicit.
- Cloudflare OAuth account-specific API checks pass; workers.dev subdomain kokayi-90b. Existing consuelo-dialer-docs service returns 404, so there is no existing service to overwrite. Wrangler whoami's memberships API returned 10500, but the same credentials successfully read the intended account's Worker metadata. The preview is expected at https://consuelo-dialer-docs.kokayi-90b.workers.dev .

## Publication and next owner

Publish the exact task source to stream/dialer, then deploy only the isolated preview with DOCS_SITE_URL set to its workers.dev origin. Branch 3 joins Branch 1, owns final routing/redirects/shared release wiring and protects OS authentication. Preserve both branches' additive test-selection rules when resolving metadata conflicts. Do not attach docs.consuelohq.com until OS docs and URL collisions have been migrated. No carrier, recording or billing mutation is authorized by this docs task.

## Publication binary defect and repair contract

The first task.push completed remotely despite its transport timeout: local and remote SHA 4558a56dca61205e986a25f8fd599750e3ebe82e match. Readback exposed binary corruption in the publication helper: the PNG local header 89504e47 became efbfbd504e47 in the remote blob (48,666 local bytes vs 85,657 committed bytes); unused starter houston.webp also changed from 98,506 to 177,518 bytes. No preview deployment occurred from that commit.

Repair by keeping the authored SVG and generating its PNG during build (ignored output), and removing the unused starter image. This makes a clean clone reproducible with text sources and avoids publishing any binary through the defective helper. Add a focused contract requiring the generator in build before changing the build script. Do not alter the OS publisher in this docs task. The typed status helper also ignored the task session and returned stale root state; scoped code.call confirmed the real task worktree instead.

Binary-repair verification passed at 2026-10-28T21:24:37.921Z, full/publishValid. New build generates the 48,666-byte PNG from SVG; four tests/72 assertions passed. There are no intended binary source files in the task delta.
