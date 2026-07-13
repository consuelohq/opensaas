# Consuelo Website Design

## Direction

The public OS homepage uses a blue editorial system inspired by the pacing and framing of the Hermes Cloud reference while remaining a Consuelo product surface.

- Primary blue: `#0000F2`
- Paper: `#FFFFFF`
- Soft white: `#F5F5F5`
- Display: Bodoni Moda Variable
- Body and UI: Inter Variable
- Technical labels: Geist Mono

The page should feel precise, sparse, and product-focused. Blue establishes the outer field; white panels carry dense product proof.

## Composition

1. Full-bleed blue hero with compact navigation, direct positioning, sign-in, and local install.
2. A visible hint of the next white panel in the first viewport.
3. White editorial product panel with a blue preview strip, large section wordmarks, and a compact 3 by 2 feature grid.
4. Horizontal product media with a `475 / 178` aspect ratio.
5. Large FAQ typography and an accessible disclosure list.
6. Full-bleed Consuelo Cloud close with the holding-world illustration.

## Media

The first media layer uses the supplied Consuelo illustrations, cropped into product-demo proportions and recolored to the exact brand blue. The final layer replaces each feature image with a lightweight WebM or MP4 loop and poster while preserving the same component dimensions.

Do not ship large animated GIFs. Do not invent additional decorative art when an existing product asset can explain the state.

## Motion

Motion should clarify hierarchy:

- The hero remains steady.
- Product media can move subtly on scroll.
- The closing Consuelo figure fades and rises into place.
- Reduced-motion users receive the same content without transitions or autoplay dependence.

## Implementation

Tokens live in `src/styles/tokens.css`. Shared primitives live in `src/styles/primitives.css`. Homepage copy remains typed in `src/data/home-content.ts`.

The homepage is composed from small Astro components. Keep responsive dimensions stable, avoid nested cards, and verify desktop, tablet, mobile, and reduced-motion states in the workspace browser.
