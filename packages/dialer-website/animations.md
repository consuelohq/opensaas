# Consuelo website motion

This file owns motion rules for `packages/consuelo-website`.

## Principle

Motion should clarify hierarchy and state. It should never become the visual idea of the page.

## Tokens

Use motion tokens from `src/styles/tokens.css`:

- `--site-motion-fast` for hover and pressed states.
- `--site-motion-medium` for menus, cards, and section affordances.
- `--site-motion-slow` for rare page-level choreography.
- `--site-ease-standard` for ordinary UI transitions.
- `--site-ease-emphasized` for hero and reveal motion.

## Allowed patterns

- Opacity fade from 0 to 1.
- Translation under 16px for interface elements.
- Translation under 32px for hero/editorial reveals.
- Border, background, and shadow transitions using token timing.
- Scroll-linked motion only when it improves comprehension.

## Boundaries

- Avoid looping decorative motion in core content.
- Avoid multi-axis movement unless it is part of a deliberate product demo.
- Avoid parallax on text-heavy editorial sections.
- Respect reduced-motion preferences for any non-essential animation.

## Validation

For motion changes, use browser verification on desktop and mobile widths. Confirm that navigation, reading, forms, and CTA paths remain usable with reduced motion enabled.
