# Animations Guide

This guide defines the project standard for UI animation with GSAP. It consolidates the GSAP core, timeline, ScrollTrigger, plugin, React, framework, utility, and performance guidance into one practical `animations.md`.

Use this as the default reference when adding, reviewing, or debugging animations.

---

## 1. Default animation library

Use **GSAP** as the default JavaScript animation library when the app needs:

- coordinated UI animation
- timeline sequencing
- scroll-driven animation
- SVG animation
- draggable or gesture-driven interaction
- runtime playback control
- framework-agnostic animation logic
- reliable cleanup in component lifecycles

CSS transitions are fine for simple hover states, one-property fades, and basic state changes. Use GSAP when the animation has sequencing, interruption, scroll coupling, custom easing, runtime control, or cross-element coordination.

---

## 2. Install and import

```bash
npm install gsap
```

For React projects, also install the React helper package:

```bash
npm install @gsap/react
```

GSAP plugins are included in the public `gsap` package. Import plugins directly from `gsap/<PluginName>`.

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
```

Register each plugin once before first use. Do this at the app/module level where possible, rather than inside frequently re-rendering component bodies.

---

## 3. Core mental model

GSAP animations are usually one of four things:

```ts
gsap.to(targets, vars);        // current state -> vars
gsap.from(targets, vars);      // vars -> current state
gsap.fromTo(targets, from, to); // explicit start -> explicit end
gsap.set(targets, vars);       // immediate set, duration 0
```

Use `to()` for most animations, `from()` for entrances, `fromTo()` when both start and end states must be explicit, and `set()` for immediate setup.

All tween methods return a **Tween** instance. Store it when playback control is needed.

```ts
const tween = gsap.to(".box", {
  x: 100,
  duration: 1,
  repeat: 1,
  yoyo: true,
});

tween.pause();
tween.play();
tween.reverse();
tween.kill();
tween.progress(0.5);
```

---

## 4. Project defaults

Set consistent defaults once in app setup when a feature area uses GSAP heavily.

```ts
gsap.defaults({
  duration: 0.6,
  ease: "power2.out",
});
```

Use timeline-level defaults for a specific animation sequence.

```ts
const tl = gsap.timeline({
  defaults: {
    duration: 0.5,
    ease: "power2.out",
  },
});
```

Preferred baseline values:

```ts
const ANIMATION = {
  fast: 0.2,
  base: 0.4,
  slow: 0.8,
  easeOut: "power2.out",
  easeInOut: "power3.inOut",
  overshoot: "back.out(1.7)",
} as const;
```

---

## 5. Targeting rules

GSAP targets can be:

- a selector string
- a DOM element
- a ref
- an array of elements
- a NodeList

In component frameworks, scope selector strings to the component root. This prevents one component instance from animating another instance.

```ts
const ctx = gsap.context(() => {
  gsap.to(".box", { x: 100 });
}, containerElement);

ctx.revert();
```

Use `gsap.utils.toArray()` when a real array is needed.

```ts
const cards = gsap.utils.toArray<HTMLElement>(".card");
gsap.from(cards, {
  autoAlpha: 0,
  y: 24,
  stagger: 0.08,
});
```

Use `gsap.utils.selector(scope)` for scoped queries.

```ts
const q = gsap.utils.selector(containerRef);
gsap.to(q(".circle"), { x: 100 });
```

---

## 6. Preferred CSS properties

Prefer GSAP transform aliases over raw `transform` strings.

| Use | Means |
| --- | --- |
| `x`, `y`, `z` | translateX/Y/Z, default unit px |
| `xPercent`, `yPercent` | percentage-based translation |
| `scale`, `scaleX`, `scaleY` | scale |
| `rotation`, `rotationX`, `rotationY` | rotate |
| `skewX`, `skewY` | skew |
| `transformOrigin` | CSS transform origin |
| `svgOrigin` | SVG global-coordinate origin |

Preferred:

```ts
gsap.to(".card", {
  x: 120,
  y: -16,
  scale: 1.04,
  rotation: 2,
});
```

Avoid:

```ts
gsap.to(".card", {
  transform: "translateX(120px) translateY(-16px) scale(1.04) rotate(2deg)",
});
```

For fading interactive elements, prefer `autoAlpha` over `opacity`.

```ts
gsap.to(".popover", {
  autoAlpha: 0,
  duration: 0.2,
});
```

`autoAlpha: 0` also sets `visibility: hidden`, so invisible elements do not keep blocking clicks.

---

## 7. Performance rules

Best-performing properties:

```ts
x
y
scale
rotation
opacity
autoAlpha
```

Avoid animating layout-heavy properties when a transform can achieve the same visual result.

Avoid when possible:

```ts
width
height
top
left
margin
padding
```

Use CSS `will-change` only for elements that actually animate.

```css
.animated-card {
  will-change: transform;
}
```

For frequently updated values such as mouse followers, use `gsap.quickTo()`.

```ts
const xTo = gsap.quickTo("#cursor", "x", {
  duration: 0.4,
  ease: "power3",
});

const yTo = gsap.quickTo("#cursor", "y", {
  duration: 0.4,
  ease: "power3",
});

document.addEventListener("mousemove", (event) => {
  xTo(event.pageX);
  yTo(event.pageY);
});
```

Use `stagger` for lists instead of creating many separate tweens with manual delays.

```ts
gsap.from(".item", {
  autoAlpha: 0,
  y: 16,
  stagger: 0.08,
});
```

For long lists, animate only visible items or use virtualization. Avoid hundreds of simultaneous tweens without testing on low-end devices.

---

## 8. Easing

Use documented string eases.

Common defaults:

```ts
ease: "power1.out"
ease: "power2.out"
ease: "power3.inOut"
ease: "back.out(1.7)"
ease: "elastic.out(1, 0.3)"
ease: "none"
```

Use `ease: "none"` for scroll-linked progress and fake horizontal scroll.

Built-in ease families support `.in`, `.out`, and `.inOut`:

```ts
"power1.in"
"power1.out"
"power1.inOut"

"power2.in"
"power2.out"
"power2.inOut"

"power3.in"
"power3.out"
"power3.inOut"

"power4.in"
"power4.out"
"power4.inOut"

"back.in"
"back.out"
"back.inOut"

"bounce.in"
"bounce.out"
"bounce.inOut"

"circ.in"
"circ.out"
"circ.inOut"

"elastic.in"
"elastic.out"
"elastic.inOut"

"expo.in"
"expo.out"
"expo.inOut"

"sine.in"
"sine.out"
"sine.inOut"

"none"
```

Use `CustomEase` when a precise cubic-bezier or SVG-path ease is needed.

```ts
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

const ease = CustomEase.create("hop", ".17,.67,.83,.67");

gsap.to(".item", {
  x: 100,
  ease,
  duration: 1,
});
```

---

## 9. Stagger

Use `stagger` for repeated elements.

```ts
gsap.to(".item", {
  y: -20,
  stagger: 0.1,
});
```

Use object syntax for more control.

```ts
gsap.from(".card", {
  autoAlpha: 0,
  y: 24,
  stagger: {
    each: 0.08,
    from: "center",
  },
});
```

Useful `from` values:

```ts
"start"
"center"
"end"
"edges"
"random"
```

---

## 10. Function-based and relative values

Use function-based values when each target needs a computed value.

```ts
gsap.to(".item", {
  x: (index) => index * 50,
  stagger: 0.1,
});
```

Use relative values when animating from the current value.

```ts
gsap.to(".panel", {
  x: "+=40",
  rotation: "-=10",
});
```

Supported relative prefixes:

```ts
"+=20"
"-=20"
"*=2"
"/=2"
```

---

## 11. Immediate render gotcha

`from()` and `fromTo()` default to `immediateRender: true`. This means the start state is applied immediately when the tween is created.

That is usually good for entrances. When multiple `from()` or `fromTo()` tweens target the same property on the same element, set `immediateRender: false` on later tweens.

```ts
const tl = gsap.timeline();

tl.from(".box", {
  x: -100,
  autoAlpha: 0,
});

tl.from(".box", {
  y: 100,
  immediateRender: false,
});
```

---

## 12. Timelines

Use timelines for multi-step animation. Timelines are easier to read, control, reverse, and debug than chains of delays.

```ts
const tl = gsap.timeline({
  defaults: {
    duration: 0.5,
    ease: "power2.out",
  },
});

tl.to(".a", { x: 100 })
  .to(".b", { y: 50 })
  .to(".c", { autoAlpha: 0 });
```

By default, each tween starts after the previous tween ends.

Use the position parameter to control timing.

```ts
tl.to(".a", { x: 100 }, 0);          // absolute time: start at 0s
tl.to(".b", { y: 50 }, "+=0.5");     // 0.5s after previous end
tl.to(".c", { autoAlpha: 0 }, "<");  // start with previous tween
tl.to(".d", { scale: 1.1 }, "<0.2"); // 0.2s after previous start
```

Use labels for readable sequencing.

```ts
tl.addLabel("intro", 0);
tl.to(".headline", { y: 0, autoAlpha: 1 }, "intro");
tl.to(".cta", { scale: 1, autoAlpha: 1 }, "intro+=0.2");

tl.addLabel("outro", "+=1");
tl.to(".hero", { autoAlpha: 0 }, "outro");
```

Control the timeline when the UI needs playback behavior.

```ts
tl.pause();
tl.play();
tl.reverse();
tl.restart();
tl.time(1.2);
tl.progress(0.5);
tl.kill();
```

Timelines can be nested.

```ts
const intro = gsap.timeline();
intro.from(".headline", { y: 24, autoAlpha: 0 });
intro.from(".subhead", { y: 16, autoAlpha: 0 }, "<0.15");

const master = gsap.timeline();
master.add(intro, 0);
master.to(".hero-bg", { scale: 1.04 }, "<");
```

---

## 13. React pattern

Use `@gsap/react` and `useGSAP()` for React and Next.js.

```tsx
"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function AnimatedCards() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      gsap.from(".card", {
        autoAlpha: 0,
        y: 24,
        stagger: 0.08,
      });
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef}>
      <div className="card">One</div>
      <div className="card">Two</div>
      <div className="card">Three</div>
    </div>
  );
}
```

React rules:

- Run GSAP on the client.
- Use refs for roots and important targets.
- Pass `scope` to `useGSAP()` so selectors stay inside the component.
- Use `dependencies` when animation values depend on props/state.
- Use `revertOnUpdate: true` when the animation should be rebuilt after dependency changes.
- Use `contextSafe()` for callbacks that create GSAP objects after the hook runs.

```tsx
useGSAP(
  () => {
    gsap.to(".box", {
      x: endX,
    });
  },
  {
    dependencies: [endX],
    scope: containerRef,
    revertOnUpdate: true,
  },
);
```

Context-safe callback pattern:

```tsx
const { contextSafe } = useGSAP({ scope: containerRef });

const onClick = contextSafe(() => {
  gsap.to(".box", {
    rotation: "+=90",
  });
});
```

Use `gsap.context()` manually when `useGSAP()` is unavailable.

```tsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
  }, containerRef);

  return () => ctx.revert();
}, []);
```

---

## 14. Vue, Nuxt, Svelte, and other frameworks

The framework pattern is always:

1. Create animations after DOM mount.
2. Scope selectors to the component root.
3. Revert or kill animations on unmount.
4. Refresh ScrollTrigger after async layout changes.

### Vue 3

```ts
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";

const container = ref<HTMLElement | null>(null);
let ctx: gsap.Context | undefined;

onMounted(() => {
  if (!container.value) return;

  ctx = gsap.context(() => {
    gsap.from(".item", {
      autoAlpha: 0,
      y: 20,
      stagger: 0.1,
    });
  }, container.value);
});

onUnmounted(() => {
  ctx?.revert();
});
```

### Svelte

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { gsap } from "gsap";

  let container: HTMLElement;

  onMount(() => {
    const ctx = gsap.context(() => {
      gsap.from(".item", {
        autoAlpha: 0,
        y: 20,
        stagger: 0.1,
      });
    }, container);

    return () => ctx.revert();
  });
</script>

<div bind:this={container}>
  <div class="item">One</div>
  <div class="item">Two</div>
</div>
```

---

## 15. Accessibility and reduced motion

Respect `prefers-reduced-motion`.

Use `gsap.matchMedia()` for responsive and accessibility conditions. Animations and ScrollTriggers created inside a matching block are reverted automatically when the query stops matching.

```ts
const mm = gsap.matchMedia();

mm.add(
  {
    isDesktop: "(min-width: 800px)",
    isMobile: "(max-width: 799px)",
    reduceMotion: "(prefers-reduced-motion: reduce)",
  },
  (context) => {
    const { isDesktop, reduceMotion } = context.conditions ?? {};

    gsap.to(".box", {
      rotation: isDesktop ? 360 : 180,
      duration: reduceMotion ? 0 : 1.2,
    });
  },
);
```

Cleanup:

```ts
mm.revert();
```

Reduced-motion strategies:

- use `duration: 0`
- skip decorative animations
- keep necessary state changes instant
- avoid large parallax movement
- avoid long pinned scroll sequences for reduced-motion users

---

## 16. ScrollTrigger

Register ScrollTrigger once.

```ts
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
```

Basic trigger:

```ts
gsap.to(".box", {
  x: 500,
  scrollTrigger: {
    trigger: ".box",
    start: "top center",
    end: "bottom center",
    toggleActions: "play reverse play reverse",
  },
});
```

`start` and `end` use this format:

```txt
"triggerPosition viewportPosition"
```

Examples:

```ts
start: "top bottom"
start: "top center"
start: "top top"
start: "center center"
start: "bottom 80%"
end: "+=300"
end: "+=100%"
end: "max"
end: "clamp(bottom top)"
```

Use `toggleActions` for discrete play/reverse behavior.

```ts
toggleActions: "play none none reverse"
```

The four positions are:

```txt
onEnter onLeave onEnterBack onLeaveBack
```

Possible actions:

```txt
play
pause
resume
reset
restart
complete
reverse
none
```

Use `scrub` when animation progress should be linked to scroll position.

```ts
gsap.to(".progress-bar", {
  scaleX: 1,
  transformOrigin: "left center",
  ease: "none",
  scrollTrigger: {
    trigger: ".section",
    start: "top bottom",
    end: "bottom top",
    scrub: true,
  },
});
```

Use numeric `scrub` for smoothing.

```ts
scrub: 1
```

Use pinning for locked sections.

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".panel",
    start: "top top",
    end: "+=1000",
    pin: true,
    scrub: 1,
  },
});

tl.to(".panel-content", {
  yPercent: -20,
  ease: "none",
});
```

Pinning rule: animate children inside the pinned element. Avoid animating the pinned element itself.

Use markers only during development.

```ts
markers: true
```

Remove markers before production.

Refresh after layout changes:

```ts
ScrollTrigger.refresh();
```

Do this after dynamic content, image load, font load, route transitions, or async data changes that alter trigger positions.

Cleanup in SPAs:

```ts
ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
```

In React, prefer `useGSAP()` or `gsap.context()` so ScrollTriggers are cleaned up automatically.

---

## 17. ScrollTrigger batch

Use `ScrollTrigger.batch()` for repeated viewport reveals.

```ts
ScrollTrigger.batch(".card", {
  start: "top 80%",
  once: true,
  onEnter: (elements) => {
    gsap.to(elements, {
      autoAlpha: 1,
      y: 0,
      stagger: 0.08,
      overwrite: true,
    });
  },
});
```

Use `interval` and `batchMax` when many elements enter close together.

```ts
ScrollTrigger.batch(".card", {
  interval: 0.1,
  batchMax: 4,
  start: "top 85%",
  onEnter: (batch) => {
    gsap.to(batch, {
      autoAlpha: 1,
      y: 0,
      stagger: 0.08,
      overwrite: true,
    });
  },
  onLeaveBack: (batch) => {
    gsap.set(batch, {
      autoAlpha: 0,
      y: 32,
      overwrite: true,
    });
  },
});
```

---

## 18. Horizontal scroll with containerAnimation

Use this pattern for fake horizontal scrolling driven by vertical scroll.

Rules:

- Pin the outer section.
- Animate an inner content wrapper horizontally.
- Use `ease: "none"` on the horizontal tween.
- Use `containerAnimation` for nested triggers.
- Pinning and snapping are unavailable on `containerAnimation`-based nested triggers.

```ts
const panels = gsap.utils.toArray<HTMLElement>(".panel");

const scrollTween = gsap.to(panels, {
  xPercent: -100 * (panels.length - 1),
  ease: "none",
  scrollTrigger: {
    trigger: ".horizontal-section",
    pin: true,
    scrub: true,
    start: "top top",
    end: () => `+=${window.innerWidth * (panels.length - 1)}`,
  },
});

gsap.to(".nested-card", {
  y: -80,
  scrollTrigger: {
    trigger: ".nested-card",
    containerAnimation: scrollTween,
    start: "left center",
    end: "right center",
    scrub: true,
  },
});
```

---

## 19. Smooth scrolling and scrollerProxy

Prefer GSAP’s `ScrollSmoother` when using the GSAP ecosystem for smooth scrolling.

Use `ScrollTrigger.scrollerProxy()` only when integrating a third-party smooth-scroll library.

```ts
ScrollTrigger.scrollerProxy(document.body, {
  scrollTop(value) {
    if (arguments.length) {
      scrollbar.scrollTop = value;
    }

    return scrollbar.scrollTop;
  },
  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  },
});

scrollbar.addListener(ScrollTrigger.update);
```

Critical rule: when the third-party scroller updates, call `ScrollTrigger.update`.

---

## 20. Plugins

All plugins should be registered before use.

```ts
gsap.registerPlugin(ScrollTrigger, Flip, Draggable, InertiaPlugin);
```

### ScrollToPlugin

Use for programmatic scroll-to behavior.

```ts
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollToPlugin);

gsap.to(window, {
  duration: 0.8,
  scrollTo: {
    y: "#pricing",
    offsetY: 80,
  },
});
```

Supported options:

| Option | Meaning |
| --- | --- |
| `x`, `y` | target scroll position or `"max"` |
| `element` | target element |
| `offsetX`, `offsetY` | pixel offset |

### Flip

Use Flip for layout transitions: capture old state, change DOM/layout, animate from the captured state.

```ts
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

const state = Flip.getState(".item");

container.classList.toggle("grid");

Flip.from(state, {
  duration: 0.5,
  ease: "power2.inOut",
});
```

Useful options:

| Option | Meaning |
| --- | --- |
| `absolute` | use absolute positioning during flip |
| `nested` | improves nested transform handling |
| `scale` | scale elements to fit |
| `simple` | faster position/scale-only mode |

### Draggable and Inertia

Use Draggable for drag interactions, sliders, cards, and knobs.

```ts
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

Draggable.create(".box", {
  type: "x,y",
  bounds: "#container",
  inertia: true,
});
```

Useful options:

| Option | Meaning |
| --- | --- |
| `type` | `"x"`, `"y"`, `"x,y"`, `"rotation"`, `"scroll"` |
| `bounds` | selector, element, or min/max object |
| `inertia` | momentum after release |
| `edgeResistance` | resistance beyond bounds |
| `onDragStart`, `onDrag`, `onDragEnd` | lifecycle callbacks |

### Observer

Use Observer for pointer, touch, wheel, swipe, and gesture normalization.

```ts
import { Observer } from "gsap/Observer";

gsap.registerPlugin(Observer);

Observer.create({
  target: "#area",
  type: "touch,pointer,wheel",
  tolerance: 10,
  onUp: () => {},
  onDown: () => {},
  onLeft: () => {},
  onRight: () => {},
});
```

### SplitText

Use SplitText for character, word, or line animation.

```ts
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

const split = SplitText.create(".heading", {
  type: "words, chars",
});

gsap.from(split.chars, {
  autoAlpha: 0,
  y: 20,
  stagger: 0.03,
  duration: 0.4,
});
```

Cleanup with `split.revert()` or by creating the SplitText instance inside `gsap.context()` / `useGSAP()`.

For responsive line splitting, use `autoSplit` and create the animation inside `onSplit()`.

```ts
SplitText.create(".split", {
  type: "lines",
  autoSplit: true,
  onSplit(self) {
    return gsap.from(self.lines, {
      y: 100,
      autoAlpha: 0,
      stagger: 0.05,
      duration: 0.5,
    });
  },
});
```

SplitText accessibility:

- default `aria: "auto"` is usually correct
- use `aria: "none"` plus screen-reader-only duplicate when nested semantics must remain exposed
- split only what is animated
- avoid chars-only splitting without word wrapping
- split after custom fonts load or use `autoSplit`

### ScrambleText

Use ScrambleText for text-reveal and glitch-like transitions.

```ts
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

gsap.to(".text", {
  duration: 1,
  scrambleText: {
    text: "New message",
    chars: "01",
    revealDelay: 0.5,
  },
});
```

### DrawSVG

Use DrawSVG to reveal or hide SVG strokes.

```ts
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(DrawSVGPlugin);

gsap.fromTo(
  "#path",
  { drawSVG: "0% 0%" },
  {
    drawSVG: "0% 100%",
    duration: 1,
  },
);
```

Requirements:

- target must have a visible stroke
- `stroke` and `stroke-width` must be set
- affects stroke, not fill

Useful values:

```ts
drawSVG: 0
drawSVG: "0% 100%"
drawSVG: "20% 80%"
```

### MorphSVG

Use MorphSVG to morph one SVG shape into another.

```ts
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

gsap.registerPlugin(MorphSVGPlugin);

MorphSVGPlugin.convertToPath("circle, rect, ellipse, line");

gsap.to("#diamond", {
  duration: 1,
  morphSVG: "#lightning",
  ease: "power2.inOut",
});
```

Object form:

```ts
gsap.to("#diamond", {
  duration: 1,
  morphSVG: {
    shape: "#lightning",
    type: "rotational",
    shapeIndex: 2,
  },
});
```

Use `shapeIndex: "log"` once when the morph twists or crosses over, then paste the logged value into the animation.

### MotionPath

Use MotionPath to move an element along an SVG path.

```ts
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

gsap.to(".dot", {
  duration: 2,
  motionPath: {
    path: "#path",
    align: "#path",
    alignOrigin: [0.5, 0.5],
    autoRotate: true,
  },
});
```

### GSDevTools

Use GSDevTools during development to scrub timelines. Remove it before production.

```ts
import { GSDevTools } from "gsap/GSDevTools";

gsap.registerPlugin(GSDevTools);

GSDevTools.create({
  animation: tl,
});
```

---

## 21. GSAP utilities

`gsap.utils` provides pure helpers. Registration is unnecessary.

### clamp

```ts
const clampProgress = gsap.utils.clamp(0, 1);

clampProgress(1.2); // 1
clampProgress(-0.2); // 0
```

### mapRange

```ts
const progressToDegrees = gsap.utils.mapRange(0, 1, 0, 360);

progressToDegrees(0.5); // 180
```

### normalize

```ts
const normalizeScroll = gsap.utils.normalize(0, 1000);

normalizeScroll(500); // 0.5
```

### interpolate

```ts
const lerp = gsap.utils.interpolate(0, 100);

lerp(0.5); // 50
```

### random

```ts
gsap.utils.random(-100, 100);
gsap.utils.random(0, 500, 5);

const randomX = gsap.utils.random(-200, 500, 10, true);
randomX();
```

String form in tween vars:

```ts
gsap.to(".box", {
  x: "random(-100, 100, 5)",
});
```

### snap

```ts
const snapToGrid = gsap.utils.snap(20);

snapToGrid(33); // 40
```

Use in tweens:

```ts
gsap.to(".box", {
  x: 200,
  snap: {
    x: 20,
  },
});
```

### wrap and wrapYoyo

```ts
const wrapDegrees = gsap.utils.wrap(0, 360);
wrapDegrees(370); // 10

const yoyo = gsap.utils.wrapYoyo(0, 100);
yoyo(150); // 50
```

### pipe

```ts
const normalizeAndSnap = gsap.utils.pipe(
  gsap.utils.normalize(0, 100),
  gsap.utils.snap(0.1),
);

normalizeAndSnap(53); // 0.5
```

### distribute

Use `distribute()` when assigning values across many elements.

```ts
gsap.to(".dot", {
  scale: gsap.utils.distribute({
    base: 0.5,
    amount: 2.5,
    from: "center",
    ease: "power1.inOut",
  }),
});
```

---

## 22. Common recipes

### Fade and slide in

```ts
gsap.from(".card", {
  autoAlpha: 0,
  y: 24,
  duration: 0.45,
  ease: "power2.out",
  stagger: 0.08,
});
```

### Button tap feedback

```ts
function animateTap(button: HTMLElement) {
  gsap.fromTo(
    button,
    { scale: 0.96 },
    {
      scale: 1,
      duration: 0.25,
      ease: "back.out(2)",
      overwrite: true,
    },
  );
}
```

### Modal open and close

```ts
const modalTl = gsap.timeline({
  paused: true,
  defaults: {
    duration: 0.25,
    ease: "power2.out",
  },
});

modalTl
  .set(".modal", { autoAlpha: 1 })
  .from(".modal-backdrop", { autoAlpha: 0 }, 0)
  .from(".modal-panel", { y: 24, scale: 0.98, autoAlpha: 0 }, 0);

function openModal() {
  modalTl.play(0);
}

function closeModal() {
  modalTl.reverse();
}
```

### Hero entrance

```ts
const tl = gsap.timeline({
  defaults: {
    ease: "power3.out",
  },
});

tl.from(".hero-eyebrow", {
  autoAlpha: 0,
  y: 12,
  duration: 0.35,
})
  .from(
    ".hero-title",
    {
      autoAlpha: 0,
      y: 24,
      duration: 0.55,
    },
    "<0.08",
  )
  .from(
    ".hero-subtitle",
    {
      autoAlpha: 0,
      y: 18,
      duration: 0.45,
    },
    "<0.12",
  )
  .from(
    ".hero-cta",
    {
      autoAlpha: 0,
      y: 14,
      duration: 0.35,
      stagger: 0.08,
    },
    "<0.15",
  );
```

### Scroll reveal

```ts
gsap.set(".reveal", {
  autoAlpha: 0,
  y: 32,
});

ScrollTrigger.batch(".reveal", {
  start: "top 85%",
  once: true,
  onEnter: (elements) => {
    gsap.to(elements, {
      autoAlpha: 1,
      y: 0,
      duration: 0.45,
      stagger: 0.08,
      ease: "power2.out",
      overwrite: true,
    });
  },
});
```

### Pinned section sequence

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".story",
    start: "top top",
    end: "+=1600",
    pin: true,
    scrub: 1,
  },
});

tl.to(".story-bg", {
  scale: 1.08,
  ease: "none",
})
  .to(
    ".story-copy-1",
    {
      autoAlpha: 0,
      y: -24,
      ease: "none",
    },
    0.2,
  )
  .from(
    ".story-copy-2",
    {
      autoAlpha: 0,
      y: 24,
      ease: "none",
    },
    0.45,
  );
```

### SplitText heading reveal

```ts
const split = SplitText.create(".headline", {
  type: "words, chars",
});

gsap.from(split.chars, {
  autoAlpha: 0,
  yPercent: 100,
  stagger: 0.015,
  duration: 0.5,
  ease: "power3.out",
});
```

### Draggable card

```ts
Draggable.create(".card", {
  type: "x,y",
  bounds: ".stage",
  inertia: true,
  edgeResistance: 0.8,
  onDragStart() {
    gsap.to(this.target, {
      scale: 1.03,
      duration: 0.15,
    });
  },
  onDragEnd() {
    gsap.to(this.target, {
      scale: 1,
      duration: 0.2,
    });
  },
});
```

---

## 23. Cleanup checklist

For every animation in a component or route:

- create after the DOM exists
- scope selector strings to a root element
- store tweens/timelines that need external control
- call `ctx.revert()` on unmount when using `gsap.context()`
- use `useGSAP()` cleanup in React
- kill manual ScrollTriggers when removing DOM outside a context
- call `split.revert()` for SplitText if it is outside a context
- remove event listeners created by the animation setup
- call `ScrollTrigger.refresh()` after async layout changes

---

## 24. Debugging checklist

Use this order when an animation behaves incorrectly.

1. Confirm the target exists.
2. Confirm the code runs after mount.
3. Confirm selector scope.
4. Confirm plugin registration.
5. Temporarily set `markers: true` for ScrollTrigger.
6. Confirm `start` and `end` positions.
7. Confirm `scrub` and `toggleActions` are not fighting.
8. Confirm ScrollTrigger is on the top-level tween/timeline.
9. Confirm the pinned element itself is not being animated.
10. Confirm `ease: "none"` on scroll-linked horizontal motion.
11. Check `immediateRender` when multiple `from()` tweens touch the same property.
12. Check for layout changes that need `ScrollTrigger.refresh()`.
13. Check cleanup across route transitions or remounts.
14. Test reduced-motion behavior.

---

## 25. Review checklist

Before shipping animation code:

- Uses transform aliases (`x`, `y`, `scale`, `rotation`) over raw `transform`.
- Uses `autoAlpha` for hide/show fades.
- Uses timelines for sequencing.
- Uses `stagger` for repeated element animation.
- Uses `gsap.context()` or `useGSAP()` with scope in components.
- Cleans up on unmount.
- Registers plugins once.
- Keeps ScrollTrigger on top-level tween/timeline.
- Calls `ScrollTrigger.refresh()` after dynamic layout changes.
- Removes `markers: true`.
- Removes GSDevTools from production.
- Handles `prefers-reduced-motion`.
- Avoids layout-heavy property animation unless necessary.
- Avoids global selectors in reusable components.
- Avoids creating new tweens every frame.
- Tests on low-end or throttled devices when many elements animate.

---

## 26. Do and do not

### Do

- Use GSAP for coordinated, runtime-controlled, scroll-linked, or SVG animation.
- Use CSS transitions for simple state transitions.
- Prefer transform and opacity.
- Use timelines for sequencing.
- Use `gsap.matchMedia()` for breakpoints and reduced motion.
- Use `ScrollTrigger.batch()` for repeated reveal-on-scroll patterns.
- Use `quickTo()` for frequently updated pointer-driven animation.
- Use context cleanup in React, Vue, Svelte, and SPAs.
- Use documented eases.
- Use `overwrite: true` or `overwrite: "auto"` when user interactions can trigger overlapping tweens.

### Avoid

- Animating `top`, `left`, `width`, or `height` for motion when transforms work.
- Using raw `transform` strings instead of GSAP transform aliases.
- Creating component animations before the DOM exists.
- Using unscoped selector strings in componentized UI.
- Leaving ScrollTrigger markers in production.
- Putting ScrollTrigger on a child tween inside a timeline.
- Combining `scrub` and `toggleActions` for the same trigger behavior.
- Animating the pinned element directly.
- Using non-linear ease on fake horizontal scroll.
- Skipping cleanup on unmount.
- Shipping GSDevTools.
- Creating hundreds of simultaneous tweens without performance testing.

---

## 27. Common anti-patterns and fixes

### Anti-pattern: delays instead of timelines

```ts
gsap.to(".a", { x: 100 });
gsap.to(".b", { y: 50, delay: 0.5 });
gsap.to(".c", { autoAlpha: 0, delay: 1 });
```

Use a timeline.

```ts
gsap
  .timeline()
  .to(".a", { x: 100 })
  .to(".b", { y: 50 })
  .to(".c", { autoAlpha: 0 });
```

### Anti-pattern: global selectors in React

```tsx
useGSAP(() => {
  gsap.to(".box", { x: 100 });
});
```

Use a scoped root.

```tsx
const root = useRef<HTMLDivElement | null>(null);

useGSAP(
  () => {
    gsap.to(".box", { x: 100 });
  },
  { scope: root },
);
```

### Anti-pattern: ScrollTrigger on nested timeline child

```ts
gsap
  .timeline()
  .to(".a", {
    x: 100,
    scrollTrigger: {
      trigger: ".section",
    },
  });
```

Put ScrollTrigger on the timeline.

```ts
gsap
  .timeline({
    scrollTrigger: {
      trigger: ".section",
      start: "top center",
    },
  })
  .to(".a", { x: 100 });
```

### Anti-pattern: missing cleanup

```tsx
useEffect(() => {
  gsap.to(".box", { x: 100 });
}, []);
```

Use context cleanup.

```tsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
  }, root);

  return () => ctx.revert();
}, []);
```

### Anti-pattern: animating layout for motion

```ts
gsap.to(".box", {
  left: 200,
});
```

Use transforms.

```ts
gsap.to(".box", {
  x: 200,
});
```

---

## 28. Minimal recommended setup

For a React app:

```tsx
// animation.ts
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin, Flip);

gsap.defaults({
  duration: 0.45,
  ease: "power2.out",
});

export { gsap, useGSAP, ScrollTrigger };
```

Usage:

```tsx
"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/animation";

export function Example() {
  const root = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      gsap.from(".item", {
        autoAlpha: 0,
        y: 16,
        stagger: 0.08,
      });
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      <div className="item">One</div>
      <div className="item">Two</div>
    </div>
  );
}
```

---

## 29. Animation acceptance criteria

An animation is ready when:

- it supports the intended user flow
- it does not block interaction
- it is scoped to the owning component
- it cleans up on route/component teardown
- it respects reduced motion
- it performs smoothly on realistic devices
- it has no dev markers or dev tools in production
- it is readable enough for the next engineer to modify safely

The practical standard is simple: the animation should improve clarity, feel intentional, and avoid adding hidden lifecycle or performance risk.
