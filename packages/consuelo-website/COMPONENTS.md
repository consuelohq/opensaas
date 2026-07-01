# Consuelo website component ownership

This package keeps first-party Consuelo website implementation separate from inherited starter-kit building blocks.

## Source-of-truth files

- `AGENTS.md` is the package-level rule surface for website agents.
- `DESIGN.md` is the visual design contract.
- `animations.md` owns website motion rules.
- `src/styles/tokens.css` owns executable design decisions.
- `src/styles/primitives.css` owns reusable CSS building blocks.

## First-party surfaces

- `src/layouts/MarketingLayout.astro` is the public website shell. It owns SEO wiring, analytics bootstrapping, global public-site styles, token/primitives imports, and the page frame used by landing-adjacent routes.
- `src/components/site/` contains global public-site chrome such as `SiteHeader`, `SiteFooter`, and `LanguageSelector`.
- `src/components/home/` contains homepage-specific sections. Edit `HomeHero.astro` for homepage hero work; edit neighboring `Home*` files for section-level landing-page changes.
- `src/data/site-links.ts`, `src/data/site-navigation.ts`, `src/data/home-content.ts`, `src/data/mercury-content.ts`, `src/data/contact-content.ts`, and `src/data/docs-navigation.ts` own typed copy/link data. Prefer changing data modules before hardcoding content in components.

## Starter-kit/library surfaces

- `src/components/ui/` and `src/components/blocks/` are reusable primitives and inherited/example blocks. Use them when they help, but do not treat them as the main Consuelo website implementation.
- Do not add new `launch-*` files, `components/launch`, or `data/launch-*` modules. The old launch vocabulary was a naming artifact.

## CSS rules

- New first-party website styling should use `tokens.css` and `primitives.css`.
- Component-local CSS should compose tokens and primitives instead of inventing raw values.
- Some existing CSS selectors still use the `launch-` prefix as a compatibility namespace. Rename those only when the full selector set and all consuming components are updated together.
