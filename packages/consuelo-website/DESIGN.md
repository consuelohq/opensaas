# Consuelo website design system

This file is the visual source of truth for `packages/consuelo-website`. It translates the useful parts of the Consuelo design archive and the Warm editorial starter into website-owned rules that agents can apply without reaching into upstream Open Design internals.

## Design direction

Consuelo's public website should feel like warm editorial sales infrastructure: calm, precise, spacious, and serious. The page should read like a founder-grade field note rather than a generic SaaS template. Typography and whitespace carry the authority; chrome stays restrained.

Warm editorial is the reference direction. The website owns the implementation.

## Source layers

1. `DESIGN.md` states the visual contract.
2. `src/styles/tokens.css` encodes the design decisions as CSS custom properties.
3. `src/styles/primitives.css` exposes reusable composition classes.
4. Components consume tokens and primitives.
5. Component-local CSS handles only component-specific layout or choreography.

Do not invent a parallel style system in a page, component, or data file.

## Palette

The core palette is curated from the Warm editorial design system and the Consuelo reader shell.

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Paper | `--site-color-paper` | `#FAF7F2` | page background and large quiet surfaces |
| Ink | `--site-color-ink` | `#1C1A17` | primary text and strong foreground |
| Surface | `--site-color-surface` | `#FFFAF3` | cards, nav shells, elevated editorial surfaces |
| Raised surface | `--site-color-surface-raised` | `#FFFFFF` | high-contrast card interiors only |
| Muted | `--site-color-muted` | `#8A817A` | metadata, secondary copy, timestamps |
| Accent | `--site-color-accent` | `#C0512F` | primary CTA, links, one hero accent |
| Secondary | `--site-color-secondary` | `#2F5B4F` | tags, separators, low-frequency supporting accent |

Use one accent color per screen. A page with a terracotta hero should keep secondary CTAs foreground-only.

Do not invent new hex values. Add a semantic token when a new value is genuinely required.

## Typography

Use the available website fonts first and keep the type hierarchy editorial:

- Display: `var(--site-font-display)` for H1/H2 and major numeric statements.
- Body: `var(--site-font-body)` for prose and interface text.
- Mono: `var(--site-font-mono)` for technical labels, IDs, compact metadata, and code-like affordances.

Scale:

| Token | Intended use |
| --- | --- |
| `--site-text-xs` | metadata and overlines |
| `--site-text-sm` | small controls and labels |
| `--site-text-md` | body copy |
| `--site-text-lg` | lead copy |
| `--site-text-xl` | section intros |
| `--site-text-2xl` | cards and subheads |
| `--site-text-3xl` | section headings |
| `--site-text-4xl` | hero headings |

Display sizes use restrained negative tracking. Body copy should remain comfortable and readable.

## Layout

- Use a 12-column mental grid with `--site-container-max: 1200px`.
- Desktop sections use `--site-space-section` for vertical rhythm.
- Tablet and phone spacing compress through token values, not ad hoc media-query values.
- Hero content is top-biased or editorially anchored. Avoid generic centered SaaS hero composition.
- Prefer one hero plus three to five strong body sections over long undifferentiated pages.

## Components and primitives

Reusable styling belongs in `src/styles/primitives.css`.

Required primitives:

- `.site-container`
- `.site-section`
- `.site-stack`
- `.site-cluster`
- `.site-grid`
- `.site-button`
- `.site-card`
- `.site-badge`
- `.site-eyebrow`
- `.site-title`
- `.site-copy`
- `.site-prose`
- `.site-field`

Components can add local selectors for unique structure, but those selectors should compose these primitives and tokens.

## Motion

`animations.md` owns the motion policy. Default motion should feel quiet, direct, and readable. Prefer opacity, short translation, and subtle state transitions. Avoid novelty motion in core website flows.

## Upstream policy

The upstream Open Design folder is a reference library. The website must not import upstream design systems as Consuelo-owned implementation. When an upstream idea is useful, curate it into this file, `tokens.css`, or `primitives.css`.

## Review checklist

Before handing website work to review, verify:

- New visual values are tokens.
- Repeated patterns are primitives.
- Component-local CSS is specific to that component.
- Data/copy changes live in `src/data` when they are editable content.
- `MarketingLayout.astro` still loads `tokens.css` and `primitives.css`.
- `packages/consuelo-website/tests/website-structure.test.js` protects any new structural rule.
- Browser smoke covers `/`, `/contact/`, a missing route for 404, `/login/device/`, `/blog/`, and `/mercury/` when layout or shared CSS changes.
