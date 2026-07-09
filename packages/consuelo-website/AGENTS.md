# AGENTS.md — Consuelo website

This package owns the public Consuelo website. When an agent works on the website, this file is the first package-level rule surface.

## Source of truth

Read these files before visual or structural website work:

1. `DESIGN.md` — visual direction, tokens, primitives, and style policy.
2. `animations.md` — motion timing, easing, and interaction policy.
3. `COMPONENTS.md` — component ownership and edit boundaries.
4. `src/styles/tokens.css` — executable design decisions.
5. `src/styles/primitives.css` — reusable CSS building blocks.

`packages/consuelo-design` is the design tooling, template, archive, and upstream-reference layer. Website implementation rules live here in `packages/consuelo-website`.

## Stack

- Framework: Astro static website with Bun package commands.
- Components: Astro for static surfaces; React islands only for browser state that needs hydration.
- Styling: CSS-first tokens and primitives for first-party website work.
- Data: editable copy, links, navigation, and FAQ data live in typed modules under `src/data`.
- Analytics: `MarketingLayout.astro` owns public-site PostHog bootstrapping.

## Component ownership

- `src/layouts/MarketingLayout.astro` is the public website shell. It owns SEO wiring, analytics bootstrapping, global public-site styles, and shared page frame behavior.
- `src/components/site/` owns global chrome such as `SiteHeader`, `SiteFooter`, and `LanguageSelector`.
- `src/components/home/` owns homepage sections. Edit `HomeHero.astro` for the homepage hero and neighboring `Home*.astro` files for section-level work.
- `src/components/ui/` and `src/components/blocks/` are inherited reusable surfaces. Use them only when they fit the current design contract.

## Style rules

- Use tokens from `src/styles/tokens.css` for color, typography, spacing, radius, shadows, layout, motion, and z-index.
- Use primitives from `src/styles/primitives.css` for repeated layout and component patterns.
- Component-local CSS may compose tokens and primitives for component-specific structure.
- Do not add one-off raw hex colors, spacing scales, shadows, radii, font stacks, or animation timings inside components.
- When a new design value is necessary, add a semantic token and document the reason in `DESIGN.md`.
- When a reusable visual pattern appears twice, promote it to `primitives.css`.
- Keep upstream Open Design systems as references. Curate decisions into website-owned files before using them in website code.

## Implementation rules

- Prefer changing typed data modules before hardcoding copy in components.
- Keep homepage sections directly addressable by file name.
- Preserve SEO, 404, contact, login/device, blog, Mercury, legal, and redirect surfaces when changing shared layout files.
- Add or extend `packages/consuelo-website/tests/website-structure.test.js` when moving docs, data modules, routes, or design-system ownership.
- Run `bun test packages/consuelo-website/tests/website-structure.test.js` and `bun run --cwd packages/consuelo-website build` after website structural changes.

## Forbidden regressions

- Do not recreate `components/launch`, `data/launch-*`, or new `launch-*` source files.
- Do not route agents through stale package-local specs or old starter-kit instructions.
- Do not import `packages/consuelo-design/upstream/open-design/design-systems/*` as a website source of truth.
