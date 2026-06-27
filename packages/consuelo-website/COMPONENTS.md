# Consuelo website component ownership

This package keeps first-party Consuelo website implementation separate from inherited starter-kit building blocks.

## First-party surfaces

- `src/layouts/MarketingLayout.astro` is the public website shell. It owns SEO wiring, analytics bootstrapping, global marketing styles, and the page frame used by landing-adjacent routes.
- `src/components/site/` contains global public-site chrome such as `SiteHeader`, `SiteFooter`, and `LanguageSelector`.
- `src/components/home/` contains homepage-specific sections. Edit `HomeHero.astro` for homepage hero work; edit neighboring `Home*` files for section-level landing-page changes.
- `src/data/site-links.ts`, `src/data/site-navigation.ts`, `src/data/home-content.ts`, `src/data/mercury-content.ts`, and `src/data/docs-navigation.ts` own typed copy/link data. Prefer changing data modules before hardcoding content in components.

## Starter-kit/library surfaces

- `src/components/ui/` and `src/components/blocks/` are reusable primitives and inherited/example blocks. Use them when they help, but do not treat them as the main Consuelo website implementation.
- Do not add new `launch-*` files, `components/launch`, or `data/launch-*` modules. The old launch vocabulary was a naming artifact, not the product boundary.

## Notes

Some existing CSS selectors still use the `launch-` prefix as a styling namespace for behavior-preserving compatibility. Rename those during the visual redesign pass, not during structural refactors unless the whole selector set is updated together.
