# reader-shell

Apply this shell to every digital e-guide template.

## header

- Add a small, fixed or sticky top header.
- Left side links to the design wiki at `/design-wiki` with text like `Design Wiki` or `All guides`.
- Right side can show the current template label and reading progress.
- Keep the header quiet: white/translucent background, Geist/Geist Mono, thin border, no decorative color dependency.

## tap-to-read navigation

Add invisible reading tap zones for mobile and tablet reading:

- Tapping the right half of the viewport scrolls down about 45vh.
- Tapping the left half of the viewport scrolls up about 45vh.
- Do not trigger this when the tap starts on links, buttons, inputs, details/summary, code controls, or selectable interactive content.
- Always load and use GSAP with ScrollToPlugin for tap-to-read motion. Include the GSAP and ScrollToPlugin browser scripts in the artifact when tap navigation is enabled.
- Respect `prefers-reduced-motion` by making the GSAP duration `0` while still using the same GSAP code path.
- Keep normal swipe scrolling intact.

Suggested implementation shape:

```js
const interactive = 'a,button,input,textarea,select,summary,details,[role="button"],[data-no-tap-scroll]';
gsap.registerPlugin(ScrollToPlugin);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('click', (event) => {
  if (event.target.closest(interactive)) return;
  const direction = event.clientX > window.innerWidth / 2 ? 1 : -1;
  const y = window.scrollY + direction * Math.round(window.innerHeight * 0.45);
  gsap.to(window, { duration: reduceMotion ? 0 : 0.45, scrollTo: { y }, ease: 'power2.out' });
});
```

Always use GSAP for this reader shell. Keep the rest of the artifact lightweight; the motion layer should be small, functional, and reader-first rather than decorative.

## footer metadata

Every guide must end with a compact metadata footer in small text. Include as many fields as are known:

- artifact title
- template: `research`, `spec`, or `plan`
- generated date/time
- published date/time when known
- source truth / source bundle / input docs when known
- Open Design project id or local artifact path when known
- design wiki link

Use the same restrained footer style as the Daily Deep Idea prototype: small text, muted gray, top border, and no marketing language.
