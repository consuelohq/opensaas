# replace decision infrastructure media placeholder

branch: `task/blog/replace-decision-infrastructure-media-placeholder`
stream: `stream/blog`
pr: https://github.com/consuelohq/opensaas/pull/297
started: 2026-05-04

## acceptance criteria

- [ ] 

## plan

1. 

## files changed

- 

## key decisions

- 

## notes for ko

- 

## improvements noticed

- 

## errors i ran into

- 

---

## publish checklist

```bash
bun run task:push -- --message "type(blog): description" --changed
bun run task:pr
bun run task:finish
```


## implementation notes

- Created `packages/consuelo-website/public/ghl-app-logo-light-mode-512x512.png` from `ghl-app-logo-black-512x512.png` using ffmpeg with light-mode text color `#0f172a`.
- Created `packages/consuelo-website/public/ghl-app-logo-dark-mode-512x512.png` from `ghl-app-logo-black-512x512.png` using ffmpeg with dark-mode text color `#f8fafc`.
- Replaced the blog media placeholder with light/dark image tags that use `dark:hidden` and `dark:block`.


## validation

- `file packages/consuelo-website/public/ghl-app-logo-black-512x512.png` confirmed the source image is a 512x512 RGBA PNG.
- `ffmpeg -version` confirmed ffmpeg is available.
- `ffmpeg` generated both light-mode and dark-mode logo variants.
- `cd packages/consuelo-website && npm install --package-lock=false --no-audit --no-fund && npm run build` initially exposed an existing `DashboardDemo.tsx` JSX namespace error.
- Added `import type { JSX } from "react";` to `DashboardDemo.tsx` as the minimal build compatibility fix.
- `cd packages/consuelo-website && npm run build` passed after the fix; remaining output is existing warnings.
