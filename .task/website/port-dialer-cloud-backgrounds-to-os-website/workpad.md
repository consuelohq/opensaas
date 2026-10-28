# Port dialer cloud backgrounds to OS website

branch: `task/website/port-dialer-cloud-backgrounds-to-os-website`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2609
started: 2026-09-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-website/scripts/materialize-public-assets.ts`

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

behavior under test: The OS home hero and blue preview panel use the dialer website cloud field and no longer reference the old dither cloud images.
existing local pattern: Astro home components plus the website structure test; source treatment is CloudField.astro on stream/dialer.
new or changed tests: Focused static assertions for cloud-field placement and removed legacy image references, followed by website build and viewport inspection.
focused red command: targeted static assertion against current hero and preview files before editing.
expected red failure: CloudField import/usage absent and old dither paths present.
no-test waiver: none.

- 2026-09-29 18:10:38 append: `.task/website/port-dialer-cloud-backgrounds-to-os-website/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/scripts/materialize-public-assets.ts`

## workspace-owned: activity log

- 2026-09-29 18:10:38 fs.write: `.task/website/port-dialer-cloud-backgrounds-to-os-website/workpad.md`
- 2026-09-29 18:15:37 fs.write: `.task/website/port-dialer-cloud-backgrounds-to-os-website/workpad.md`
- 2026-09-29 18:16:31 fs.write: `packages/consuelo-website/scripts/materialize-public-assets.ts`
- 2026-09-29 18:20:02 fs.write: `.task/website/port-dialer-cloud-backgrounds-to-os-website/workpad.md`

## Scope extension: social preview and image delivery

The user reported a missing X preview and requested configurable page cards plus fast hero images. The live homepage advertises `/consuelo-os-og-20260714.png`, which responds HTTP 200/image/png but starts with EF BF BD instead of the PNG signature. The focused social-card test fails decoding it. Restore the existing blue card design, carry binary assets through text-safe sources and materialize them at build/dev time, keep per-page social metadata configurable, and preload the two visible hero clouds. Verify decoded signatures, card dimensions, build output, and live response after release.

- 2026-09-29 18:15:37 append: `.task/website/port-dialer-cloud-backgrounds-to-os-website/workpad.md`

- 2026-09-29 18:16:31 write: `packages/consuelo-website/scripts/materialize-public-assets.ts`

## Validation evidence

- Focused cloud placement assertion was red before the change and passes after it.
- The existing social-card test was red on the deployed card bytes (`EF BF BD` instead of PNG) and now passes on the encoded blue card (1200x630, 55,472 bytes).
- All four decoded WebP assets exactly match the `origin/stream/dialer` source objects; combined image bytes are 871,314.
- Astro build passes with 0 errors and 0 warnings; built output contains valid PNG/WebP signatures, the new card metadata, and hero image preloads.
- Local Playwright desktop and mobile screenshots show the ported clouds and readable content.
- `website-structure.test.js` has three preexisting stale expectations unrelated to this change (including an old hero headline); 18 tests pass. No unrelated test edits made.

- 2026-09-29 18:20:02 append: `.task/website/port-dialer-cloud-backgrounds-to-os-website/workpad.md`
