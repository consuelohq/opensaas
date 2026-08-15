
## Discovery and implementation

- Git history identified `a3026f5100d0f88c3f21d1aa1e42cf6c64d4ccf5` as the change that collapsed the desktop header to three slots. The immediately preceding desktop contract was CONSUELO / DOCS / CONSUELO OS / PRICING / CLOUD.
- Kept the current compact mobile contract: DOCS / CONSUELO OS / CLOUD with no dropdown.
- Replaced the hero with two stable authored lines: `Make [ChatGPT|Claude]` and `your true assistant`.
- Implemented the product-name rotation with core GSAP transforms in an overflow-clipped, max-content grid. Both names reserve one fixed slot, so the heading does not shift horizontally when Claude replaces ChatGPT.
- Removed the Pretext dependency and the `document.fonts.ready` post-paint size fitter that caused the visible small-to-large jump. Heading and subtitle sizes are now pure CSS clamps from the first styled paint.
- Reduced-motion users retain ChatGPT without an infinite animation.

## Validation

- Red phase confirmed: the source contract failed on the old copy/Pretext implementation, and the browser contract failed on the three-slot desktop header.
- `bun test tests/homepage-responsive.test.mjs`: 8 pass, 0 fail.
- `bun run test:header`: 1 pass, 0 fail; covers desktop rotation, stable computed heading size, no inline sizing mutation, iPad expanded header, reduced motion, and compact mobile header.
- `bun run build`: pass; Astro diagnostics report 0 errors and 23 pages built.
- Local Cloudflare Pages smoke: 390x844, 1024x1366, 1440x900, and 1920x1080. No horizontal overflow at any size.
- Mobile 390x844: hero ends at 759.59px and features begin at 767.59px, leaving a visible next-section cue; heading is 42.4px with no inline style mutation.
- iPad 1024x1366: five-slot expanded header visible, two-line 71.68px headline, subtitle remains one line, and 153.69px of the next section is visible.
- Desktop 1440x900: two-line 100.8px headline; next section starts at 822.80px.
- Wide desktop 1920x1080: two-line 108px headline; next section starts at 984.80px.
- Runtime animation proof: ChatGPT exits upward and Claude resolves at y=0; both names share the exact same horizontal center. The loop returns to ChatGPT cleanly.
