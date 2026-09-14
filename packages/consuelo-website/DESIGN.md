# Consuelo Website Design

## Direction

The public OS homepage uses a blue editorial system inspired by the pacing and framing of the Hermes Cloud reference while remaining a Consuelo product surface.

- Primary blue: `#0000F2`
- Paper: `#FFFFFF`
- Soft white: `#F5F5F5`
- Display: locally bundled Bodoni Moda variable; body: locally bundled Inter variable
- Technical labels and code: native device monospace stack

The page should feel precise, sparse, and product-focused. Blue establishes the outer field; white panels carry dense product proof.

## Composition

1. Full-bleed blue hero with compact navigation, direct positioning, sign-in, and local install.
2. A visible hint of the next white panel in the first viewport.
3. White editorial product panel with a blue preview strip, large section wordmarks, and six product chapters that share one evidence-stage grammar.
4. On desktop, each chapter gives the visual evidence the dominant column and keeps it sticky while the accompanying product statement moves through the viewport. On mobile the statement and its evidence stack naturally.
5. Evidence uses a consistent `2032 / 1192` stage when possible, but the medium changes with the capability: recorded product footage for CONNECT, structured workspace data for REMEMBER, product-derived visualization for OBSERVE, and purpose-built product diagrams or real output for the remaining chapters.
6. Large FAQ typography and an accessible disclosure list.
7. Full-bleed Consuelo Cloud close with the holding-world illustration.

## Media

Feature media is evidence, not decoration. Do not force every capability into the same screenshot or video treatment. Use the smallest medium that makes the outcome obvious: real recordings when the cross-application behavior matters, deterministic HTML/CSS when the product concept is better explained as data, and cropped first-party product UI when the interface itself is the proof. Existing Consuelo illustrations remain temporary fallback media while a chapter is still being developed.

The current feature proof language is intentionally mixed by capability: CONNECT uses real agent footage; REMEMBER borrows the search/get shape of workspace memory; CONTROL visualizes the real task/review/verify workflow; OBSERVE mirrors the internal Home 7-day × 24-hour trace heatmap levels and hover/focus detail; SECURE uses the real scoped-resource and browser-sealed-secret model; SWITCH keeps one work object fixed while agent surfaces hand off around it. Public examples must stay deterministic and sanitized even when their interaction model comes directly from internal product UI.

Do not ship large animated GIFs. Do not invent additional decorative art when an existing product asset can explain the state.

### Workspace atmosphere

The OS hero and the preview-to-features transition share one original vector atmosphere:

- Halftone clouds represent work distributed across local and managed nodes.
- Thin orbital routes and square markers describe agent routing through one workspace.
- Faint technical labels name Consuelo concepts without becoming readable product copy.
- The hero keeps its center quiet so the headline remains the dominant layer.

These assets stay as editable SVG. Blur is limited to a few static ellipses; repeated texture uses SVG patterns instead of large paths or bitmap noise. Mobile reuses the same source with a controlled crop, avoiding a second download or animated effect.

## Motion

Motion should clarify hierarchy:

- The hero remains steady.
- Product media can move subtly on scroll.
- The closing Consuelo figure fades and rises into place.
- Reduced-motion users receive the same content without transitions or autoplay dependence.

## Implementation

Tokens live in `src/styles/tokens.css`. Shared primitives live in `src/styles/primitives.css`. Homepage copy remains typed in `src/data/home-content.ts`.

The homepage is composed from small Astro components. Keep responsive dimensions stable, avoid nested cards, and verify desktop, tablet, mobile, and reduced-motion states in the workspace browser.
