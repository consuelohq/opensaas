# Fix preview release selection and paid Dialer metadata

branch: `task/website/fix-preview-release-selection-and-paid-dialer-metadata`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2660
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

## Scope

Address two current release-readiness review findings on shared PR #2651: preview-only packages must not deploy the unchanged legacy public sites, and paid Dialer JSON-LD must not advertise a free offer. Preserve the recent CI improvements, existing Dialer release jobs, authentication origin/state/WAF, production domains and calling runtime. Remaining BFCache/setup catalog/decorative motion findings are grouped into one AFK issue; do not silently drop them or claim they are fixed. Product root/login question remains pending; no cutover.

## Test-first contract

behavior under test: preview package changes select zero production releases until dedicated delivery jobs exist; legacy public source and manual release targets still select their actual jobs. Paid marketing metadata never emits an inherited zero-price offer.
existing local pattern: tested public/OS production release plan and independently owned Dialer delivery contract suite.
new or changed tests: update preview-isolation expectations, add legacy-docs positive case, and parse JSON-LD to validate any published prices against the typed pricing catalog.
focused red command: Vitest production-release-plan tests plus Bun marketing delivery tests after a build.
expected red failure: preview package changes currently select docs/website production outputs; the rendered SoftwareApplication offer has price 0.
no-test waiver: none. Use focused red/green and full verify before publishing.

- 2026-10-29 03:22:37 append: `.task/website/fix-preview-release-selection-and-paid-dialer-metadata/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 03:22:37 fs.write: `.task/website/fix-preview-release-selection-and-paid-dialer-metadata/workpad.md`
- 2026-10-29 03:27:16 fs.write: `.task/website/fix-preview-release-selection-and-paid-dialer-metadata/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 03:25:29 `review.run`: passed — OK

## Final validation and coordination

- Red: preview-selection regression failed against the preceding classifier; rendered JSON-LD regression found inherited price 0 instead of a listed paid plan.
- Green: preview packages now select no legacy production delivery job, while legacy website/docs sources and explicit manual targets retain their jobs. Removed inherited free-offer metadata and made the software defaults Dialer-specific. Dedicated production Dialer website/docs jobs remain part of the future domain-cutover task.
- Strict review: zero findings. Full durable verify: pass, publishValid=true, mode=full, verifiedAt=2026-10-29T03:25:49.749Z. Includes package build/delivery/browser gates and release-isolation/security tests.
- Hosted Linux verification passed on prior stream SHA 704c1e905b6324c4cbc9f1247f93fefcb3ddfa8e, proving installed Linux browser detection. Require current-head hosted gates before main merge.
- Resolved only the two older GitHub threads for fragment navigation and the missing browser selector, whose published fixes passed hosted tests. New preview-delivery and free-offer threads can be resolved after this task is promoted. Three remaining UI findings are grouped as DEV-1636 (BFCache, shared setup pricing, finite decorative motion); their GitHub threads remain open because they are deferred, not fixed.
- Consolidated docs tracking: DEV-1631 then DEV-1634/DEV-1635 are canonical. DEV-1632/DEV-1633 were canceled with explicit successor mappings, preserving original descriptions and all six findings.
- Production auth source/config, OAuth origins/clients/state, MCP routes, WAF, public domain bindings and carrier runtime remain unchanged. Authenticated ChatGPT baseline was confirmed by Ko. Await the OS root/login URL choice before dependent content-routing implementation. Cutover plan is in predecessor task .task/website/repair-linux-browser-prerequisite-for-dialer-verification/cutover-plan.md; private baseline /private/tmp/consuelo-domain-cutover-preflight/baseline.json.

- 2026-10-29 03:27:16 append: `.task/website/fix-preview-release-selection-and-paid-dialer-metadata/workpad.md`
