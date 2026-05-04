# fix decision infrastructure logo treatment

branch: `task/blog/fix-decision-infrastructure-logo-treatment`
stream: `stream/blog`
pr: https://github.com/consuelohq/opensaas/pull/299
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

- Regenerated `ghl-app-logo-light-mode-512x512.png` from the existing black source with ffmpeg using exact light-mode blog text color `#000000`.
- Regenerated `ghl-app-logo-dark-mode-512x512.png` from the existing black source with ffmpeg using exact dark-mode blog text color `#ffffff`.
- Replaced Tailwind `dark:` image swapping with a native `<picture><source media="(prefers-color-scheme: dark)">` because the blog theme follows `prefers-color-scheme` on mobile.
- Removed the card border classes and added explicit image border/radius overrides so AstroPaper prose image borders do not show.

## validation

- PIL inspection confirmed high-alpha pixels in the light logo are only `(0, 0, 0)` and high-alpha pixels in the dark logo are only `(255, 255, 255)`.
- `cd packages/consuelo-website && npm install --package-lock=false --no-audit --no-fund && npm run build` passed; remaining output is existing site warnings.
- Built HTML contains the `<picture>` source and `style="border:0;border-radius:0;"` image override.
