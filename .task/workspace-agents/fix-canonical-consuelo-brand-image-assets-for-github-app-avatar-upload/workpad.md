# Fix canonical Consuelo brand image assets for GitHub App avatar upload

branch: `task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2221/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload
github pr: https://github.com/consuelohq/opensaas/pull/2221
started: 2026-08-26

## acceptance criteria

- [x] Canonical generated raster assets decode as valid images.
- [x] Existing canonical visual-contract test passes after regeneration.
- [x] GitHub serves the regenerated image as the Consuelo OS App avatar.
- [x] Public GitHub sign-in shows `Consuelo OS`, not the old App name.

## plan

1. Prove whether GitHub is rejecting the file or the App configuration.
2. Resolve the canonical Astro brand source from its generator rather than trusting legacy filenames.
3. Reproduce the raster corruption, regenerate canonical outputs, and validate decoded image bytes.
4. Upload the regenerated app icon and verify the public unauthenticated GitHub install flow.

## current status

- Implementation and live verification complete; validating for publish.

## files changed

- `packages/consuelo-website/public/apple-touch-icon-800x800.png`
- `packages/consuelo-website/public/apple-touch-icon.png`
- `packages/consuelo-website/public/favicon-192x192.png`
- `packages/consuelo-website/public/favicon-32x32.png`
- `packages/consuelo-website/public/favicon-512x512.png`
- `packages/consuelo-website/public/favicon.ico`

## workspace-owned: files changed

- `packages/consuelo-website/public/apple-touch-icon-800x800.png`
- `packages/consuelo-website/public/apple-touch-icon.png`
- `packages/consuelo-website/public/favicon-192x192.png`
- `packages/consuelo-website/public/favicon-32x32.png`
- `packages/consuelo-website/public/favicon-512x512.png`
- `packages/consuelo-website/public/favicon.ico`

## workspace-owned: activity log

- 2026-08-26 15:09:22 fs.write: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`
- 2026-08-26 15:17:01 fs.write: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`
- 2026-08-26 15:22:00 fs.write: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 15:21:37 `review.run`: passed — OK
- 2026-08-26 15:21:37 `review.run`: passed — OK
- 2026-08-26 15:23:52 `verify`: passed — OK

## key decisions

- `packages/consuelo-website/scripts/generate-brand-assets.ts` is the brand source of truth for app icons; stale logo filenames are not.
- The generator/source mark was correct. The tracked raster files were corrupt, so regeneration is the narrow repair; no new logo implementation is needed.
- The unrelated documentation favicon assertion mismatch found by the full brand-assets test stays out of this task.

## notes for ko

- GitHub App is now named `Consuelo OS`; its public slug is `/apps/consuelo-os`. The old `/apps/consuelo-source-control` slug returns 404 rather than redirecting.
- Repo-wide exact search found no real hardcoded old GitHub App URL; remaining `consuelo-source-control` matches are temporary test-directory names.
- The `Overview` copy from the screenshot is not part of GitHub's login HTML. The exact unauthenticated install page contains the GitHub sign-in UI and Consuelo OS branding but none of that Overview copy.

## improvements noticed

- Keep the separate headed-browser concurrency/profile repair out of this brand-assets PR.

## issues and recovery

- Initial avatar upload returned HTTP 422 `content_mismatch`; local `sharp` independently rejected the same file, proving corrupt binary bytes rather than a GitHub image-policy issue.
- Regeneration restored the correct PNG signature and GitHub accepted the new 512x512 upload with HTTP 201; `Set new avatar` completed GitHub's second-stage association.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: canonical generated Consuelo PNG brand assets are valid decodable PNG images matching the canonical black mark on a rounded white tile, so external consumers such as GitHub App avatars can accept them.
existing local pattern: packages/consuelo-website/scripts/generate-brand-assets.ts is the single brand generator; packages/consuelo-website/tests/brand-assets.test.mjs validates generated SVG/PNG outputs with sharp.
new or changed tests: no new test needed initially; the existing brand-assets test is expected to expose the corrupt generated PNG bytes. Strengthen only if regeneration alone does not preserve the invariant.
focused red command: bun test packages/consuelo-website/tests/brand-assets.test.mjs
expected red failure: sharp rejects favicon-32x32.png and/or apple-touch-icon.png as unsupported image format because the tracked binary starts with UTF-8 replacement bytes instead of the PNG signature.
no-test waiver: not applicable; existing focused test covers this regression.

## Acceptance criteria
- Canonical generated PNG outputs are valid images and pass the existing brand-assets test.
- GitHub accepts the freshly generated canonical app icon as the Consuelo OS GitHub App avatar.
- The source-of-truth generator remains unchanged unless evidence proves it is faulty.

- 2026-08-26 15:09:22 append: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

## workspace-owned: files read

- none yet

## Completion update
- Canonical raster outputs regenerated from the existing website brand generator.
- GitHub App renamed to `Consuelo OS`; regenerated avatar uploaded and associated successfully.
- Public unauthenticated GitHub login verifies the new name/avatar and contains no Consuelo Overview copy.
- Full brand-assets test still has a separate pre-existing docs favicon assertion mismatch; the focused raster/visual contract is green.

- 2026-08-26 15:17:01 append: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

- 2026-08-26 15:17:11 apply-patch: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

- 2026-08-26 15:17:30 apply-patch: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

- 2026-08-26 15:17:35 apply-patch: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

- 2026-08-26 15:17:44 apply-patch: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

- 2026-08-26 15:17:50 apply-patch: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`

## Validation evidence
- RED before repair: `brand-assets.test.mjs` reproduced `sharp` unsupported-image errors on the tracked raster assets.
- GREEN: all five regenerated PNG outputs decode at their expected dimensions with PNG signature `89504e470d0a1a0a`; regenerated ICO has signature `00000100`.
- GREEN: focused canonical brand test passes (1 pass, 0 fail).
- Full brand-assets file after repair: raster/visual test passes; the only remaining failure is the separate pre-existing documentation favicon expectation mismatch.
- LIVE: GitHub accepted the regenerated 512x512 upload with HTTP 201 and now serves the custom App avatar.
- LIVE: unauthenticated install login shows `Consuelo OS`, no old App name, custom `Consuelo OS logo`, and no Consuelo Overview copy in GitHub HTML.
- Review facade: 0 task-owned issues, 0 blocking issues; 29 pre-existing lint/typecheck findings. Review was branch-revision scoped before task push, so focused working-tree validation above is the evidence for the regenerated binaries.

- 2026-08-26 15:22:00 append: `.task/workspace-agents/fix-canonical-consuelo-brand-image-assets-for-github-app-avatar-upload/workpad.md`
