# AGENTS.md — consuelo-website

marketing site for consuelo. astro 5 + tailwind v4 + react 19 islands.

## stack

- **framework:** astro 5.x (static output, `bun` package manager)
- **styling:** tailwind v4 (css-first config via `@theme` in global.css, no tailwind.config.js)
- **components:** react 19 for interactive islands (cookie banner, etc.), astro for everything else
- **fonts:** geist sans + geist mono (variable, from `public/fonts/`)
- **design system:** geist (https://vercel.com/geist/introduction) — use its patterns/components where possible
- **analytics:** posthog (loaded only after cookie consent)

## design tokens

pure black and white. no grays in the token system — use opacity for muted text.

```css
--color-bg: #fff (light) / #000 (dark)
--color-fg: #000 (light) / #fff (dark)
```

dark mode follows device preference via `prefers-color-scheme`. no manual toggle.

## file conventions

- `src/components/` — shared components (.astro for static, .tsx for interactive)
- `src/layouts/` — page layouts (SiteLayout.astro is the base)
- `src/pages/` — file-based routing
- `src/data/` — static data (nav items, feature lists, pricing, etc.)
- `src/styles/global.css` — fonts, tailwind @theme, base styles
- `public/` — static assets (fonts, images, favicons)

## rules

- prefer astro components over react — only use react when you need client-side interactivity
- use `client:load` for above-fold interactive components, `client:visible` for below-fold
- no default exports — named exports only
- keep components small and composable
- images go in `public/images/`, reference as `/images/...`
- all text content that might change goes in `src/data/` as typed objects, not hardcoded in components

## commands

```bash
bun run dev      # dev server at localhost:4321
bun run build    # static build to dist/
bun run preview  # preview production build
```

## seo

SiteLayout.astro handles all meta tags, OG, twitter cards, JSON-LD. pass props to override per-page:

```astro
<SiteLayout title="Pricing" description="Simple, transparent pricing.">
```

## analytics (posthog)

posthog loads only after user accepts cookies. deep tracking includes:
- page views with full URL + referrer
- scroll depth (25%, 50%, 75%, 100%)
- CTA clicks (book a demo, for developers, pricing links)
- section visibility (which sections users actually see)
- time on page
- outbound link clicks
