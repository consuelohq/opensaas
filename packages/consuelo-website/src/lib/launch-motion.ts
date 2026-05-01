import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

type Cleanup = () => void;
type SplitInstance = ReturnType<typeof SplitText.create>;

type LaunchMenuEventDetail = {
  open: boolean;
};

type LaunchTabEventDetail = {
  activeIndex: number;
};

let cleanupActiveMotion: Cleanup | null = null;

const MOTION_READY_CLASS = 'is-motion-ready';
const MOTION_SCROLLED_CLASS = 'is-motion-scrolled';

const toElements = <TElement extends Element>(
  selector: string,
  scope: ParentNode = document,
): TElement[] => Array.from(scope.querySelectorAll<TElement>(selector));

const getReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getHeaderOffset = () => {
  const header = document.querySelector<HTMLElement>('[data-launch-header]');
  return header ? header.getBoundingClientRect().height + 18 : 96;
};

const addListener = (
  cleanups: Cleanup[],
  target: EventTarget,
  type: string,
  listener: EventListener,
) => {
  target.addEventListener(type, listener);
  cleanups.push(() => target.removeEventListener(type, listener));
};

const loadDeferredMedia = (scope: ParentNode) => {
  toElements<HTMLSourceElement>('[data-deferred-source]', scope).forEach((source) => {
    const nextSrcset = source.dataset.srcset;
    if (!nextSrcset || source.srcset === nextSrcset) {
      return;
    }

    source.srcset = nextSrcset;
    delete source.dataset.srcset;
  });

  toElements<HTMLImageElement>('[data-deferred-media]', scope).forEach((image) => {
    const nextSrc = image.dataset.src;
    if (!nextSrc || image.src.endsWith(nextSrc)) {
      return;
    }

    image.src = nextSrc;
    delete image.dataset.src;
  });
};

const runGlint = (element: HTMLElement) => {
  if (getReducedMotion()) {
    return;
  }

  gsap.killTweensOf(element, '--motion-glint-x');
  gsap
    .timeline()
    .set(element, {
      '--motion-glint-x': '-140%',
      '--motion-glint-opacity': 0,
    })
    .to(element, { '--motion-glint-opacity': 1, duration: 0.06 }, 0)
    .to(
      element,
      {
        '--motion-glint-x': '140%',
        duration: 0.72,
        ease: 'power2.out',
      },
      0,
    )
    .to(element, { '--motion-glint-opacity': 0, duration: 0.18 }, 0.52);
};

const parseNumberishText = (value: string) => {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const animateNumericText = (element: HTMLElement) => {
  const source = element.dataset.statValue ?? element.textContent ?? '';
  const targetNumber = parseNumberishText(source);
  if (targetNumber === null) {
    return;
  }

  const numberText = String(targetNumber);
  const numberStart = source.indexOf(numberText);
  const prefix = numberStart >= 0 ? source.slice(0, numberStart) : '';
  const suffix = numberStart >= 0 ? source.slice(numberStart + numberText.length) : '';
  const decimals = numberText.includes('.') ? numberText.split('.')[1]?.length ?? 0 : 0;
  const state = { value: 0 };

  gsap.to(state, {
    value: targetNumber,
    duration: 1.1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: element,
      start: 'top 86%',
      once: true,
    },
    onUpdate: () => {
      element.textContent = `${prefix}${state.value.toFixed(decimals)}${suffix}`;
    },
    onComplete: () => {
      element.textContent = source;
    },
  });
};

const splitAndReveal = (
  element: HTMLElement,
  splits: SplitInstance[],
  options: { trigger?: Element } = {},
) => {
  const split = SplitText.create(element, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'launch-motion-line',
  });

  splits.push(split);

  gsap.from(split.lines, {
    yPercent: 112,
    autoAlpha: 0,
    duration: 0.72,
    stagger: 0.075,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: options.trigger ?? element,
      start: 'top 84%',
      once: true,
    },
  });
};

const initReducedMotion = () => {
  gsap.set('[data-motion]', { autoAlpha: 1, clearProps: 'transform' });
};

const initGlints = (cleanups: Cleanup[]) => {
  toElements<HTMLElement>('[data-motion~="silver-glint"]').forEach((element, index) => {
    gsap.set(element, {
      '--motion-glint-x': '-140%',
      '--motion-glint-opacity': 0,
    });

    const play = () => runGlint(element);
    addListener(cleanups, element, 'mouseenter', play);
    addListener(cleanups, element, 'focusin', play);

    if (index < 4) {
      gsap.delayedCall(0.95 + index * 0.16, play);
    }
  });
};

const initAnchorScroll = (cleanups: Cleanup[]) => {
  const anchors = toElements<HTMLAnchorElement>('a[href^="#"], [data-motion~="anchor-link"]');

  anchors.forEach((anchor) => {
    const onClick = (event: Event) => {
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) {
        return;
      }

      const id = decodeURIComponent(url.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) {
        return;
      }

      event.preventDefault();
      gsap.to(window, {
        duration: 0.82,
        ease: 'power3.inOut',
        scrollTo: {
          y: target,
          offsetY: getHeaderOffset(),
        },
        onComplete: () => {
          window.history.pushState(null, '', `#${id}`);
        },
      });
    };

    addListener(cleanups, anchor, 'click', onClick);
  });
};

const initHeaderMotion = () => {
  const header = document.querySelector<HTMLElement>('[data-motion~="header"]');
  if (!header) {
    return;
  }

  const navTargets = toElements<HTMLElement>('[data-motion~="nav-link"], [data-motion~="mobile-menu-toggle"]', header);

  gsap
    .timeline({ defaults: { ease: 'power3.out' } })
    .from(header, { y: -8, autoAlpha: 0, duration: 0.48 })
    .from(navTargets, { y: -4, autoAlpha: 0, stagger: 0.045, duration: 0.34 }, '-=0.22');

  ScrollTrigger.create({
    start: 8,
    end: 999999,
    toggleClass: {
      targets: header,
      className: MOTION_SCROLLED_CLASS,
    },
  });
};

const initHeroMotion = (splits: SplitInstance[]) => {
  const title = document.querySelector<HTMLElement>('[data-motion~="hero-line"]');
  const copyTargets = toElements<HTMLElement>('[data-motion~="hero-copy"]');
  const eyebrow = document.querySelector<HTMLElement>('[data-motion~="hero-eyebrow"]');
  const tabs = document.querySelector<HTMLElement>('[data-motion~="hero-tabs"]');
  const demo = document.querySelector<HTMLElement>('[data-motion~="hero-demo"]');
  const media = document.querySelector<HTMLElement>('[data-motion~="hero-media"]');

  const titleSplit = title
    ? SplitText.create(title, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'launch-motion-line',
      })
    : null;

  if (titleSplit) {
    splits.push(titleSplit);
  }

  const copySplits = copyTargets.map((copy) => {
    const split = SplitText.create(copy, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'launch-motion-line',
    });
    splits.push(split);
    return split;
  });

  const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (eyebrow) {
    timeline.from(eyebrow, { y: 8, autoAlpha: 0, duration: 0.42 });
  }

  if (titleSplit) {
    timeline.from(titleSplit.lines, { yPercent: 112, autoAlpha: 0, stagger: 0.08, duration: 0.76 }, '-=0.08');
  }

  copySplits.forEach((split) => {
    timeline.from(split.lines, { yPercent: 100, autoAlpha: 0, stagger: 0.045, duration: 0.55 }, '-=0.42');
  });

  if (tabs) {
    timeline.from(tabs, { y: 8, autoAlpha: 0, duration: 0.42 }, '-=0.26');
  }

  if (demo) {
    timeline.from(demo, { y: 14, autoAlpha: 0, duration: 0.52 }, '-=0.22');
  }

  if (media) {
    timeline
      .call(() => loadDeferredMedia(media), [], '+=0.05')
      .from(media, { y: 18, autoAlpha: 0, duration: 0.64 }, '-=0.08');
  }
};

const initHeroTabs = (cleanups: Cleanup[]) => {
  const tabButtons = toElements<HTMLElement>('[data-motion~="tab"]');

  tabButtons.forEach((button) => {
    const animateButton = () => {
      gsap.fromTo(button, { y: 0 }, { y: -1, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
    };

    addListener(cleanups, button, 'click', animateButton);
  });

  const onTabChange = (event: Event) => {
    const detail = event instanceof CustomEvent ? (event.detail as LaunchTabEventDetail) : null;
    if (!detail || typeof detail.activeIndex !== 'number') {
      return;
    }

    const activePanel = toElements<HTMLElement>('[data-motion~="tab-panel"]')[detail.activeIndex];
    const activeMedia = toElements<HTMLElement>('[data-motion~="media-panel"]')[detail.activeIndex];

    if (activePanel) {
      gsap.fromTo(activePanel, { y: 6, autoAlpha: 0.35 }, { y: 0, autoAlpha: 1, duration: 0.28, ease: 'power2.out' });
    }

    if (activeMedia) {
      gsap.fromTo(activeMedia, { y: 10, autoAlpha: 0.5 }, { y: 0, autoAlpha: 1, duration: 0.36, ease: 'power2.out' });
    }
  };

  addListener(cleanups, document, 'launch:hero-tab-change', onTabChange);
};

const initMobileMenuMotion = (cleanups: Cleanup[]) => {
  const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
  const panel = document.querySelector<HTMLElement>('[data-motion~="mobile-panel"]');
  const backdrop = document.querySelector<HTMLElement>('[data-motion~="mobile-backdrop"]');

  if (!menu || !panel || !backdrop) {
    return;
  }

  const links = toElements<HTMLElement>('[data-motion~="mobile-link"]', menu);
  gsap.set(menu, { autoAlpha: 0, pointerEvents: 'none' });
  gsap.set(panel, { xPercent: 100 });
  gsap.set(backdrop, { autoAlpha: 0 });

  const timeline = gsap
    .timeline({ paused: true, defaults: { ease: 'power3.out' } })
    .set(menu, { pointerEvents: 'auto' })
    .to(menu, { autoAlpha: 1, duration: 0.16 }, 0)
    .to(backdrop, { autoAlpha: 1, duration: 0.18 }, 0)
    .to(panel, { xPercent: 0, duration: 0.36 }, 0.03)
    .from(links, { x: 12, autoAlpha: 0, stagger: 0.035, duration: 0.24 }, 0.15);

  const onMenuEvent = (event: Event) => {
    const detail = event instanceof CustomEvent ? (event.detail as LaunchMenuEventDetail) : null;
    const shouldOpen = Boolean(detail?.open);

    if (shouldOpen) {
      timeline.play(0);
      return;
    }

    timeline.reverse();
    timeline.eventCallback('onReverseComplete', () => {
      gsap.set(menu, { pointerEvents: 'none' });
    });
  };

  addListener(cleanups, document, 'launch:mobile-menu', onMenuEvent);
};

const initScrollReveals = (splits: SplitInstance[]) => {
  toElements<HTMLElement>('[data-motion~="section-reveal"]').forEach((section) => {
    const targets = toElements<HTMLElement>(
      '[data-motion~="feature-row"], [data-motion~="faq"], [data-motion~="stat-card"], [data-motion~="privacy-row"], [data-motion~="footer-item"], [data-motion~="mercury-card"]',
      section,
    );

    if (targets.length > 0) {
      gsap.from(targets, {
        y: 18,
        autoAlpha: 0,
        duration: 0.58,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 84%',
          once: true,
        },
      });
    }
  });

  toElements<HTMLElement>('[data-motion~="split-line"]').forEach((element) => {
    splitAndReveal(element, splits, { trigger: element.closest('[data-motion~="section-reveal"]') ?? element });
  });
};

const initStatsMotion = (cleanups: Cleanup[]) => {
  const pathGroups = toElements<SVGSVGElement>('[data-motion~="chart"] svg');

  pathGroups.forEach((svg) => {
    const paths = toElements<SVGGeometryElement>('[data-motion~="chart-path"]', svg);
    const bars = toElements<SVGGraphicsElement>('[data-motion~="chart-bar"]', svg);
    const dots = toElements<SVGGraphicsElement>('[data-motion~="commit-twinkle"]', svg);

    const replayTrace = () => {
      paths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      });

      if (paths.length > 0) {
        gsap.to(paths, { strokeDashoffset: 0, duration: 0.62, stagger: 0.018, ease: 'power2.out' });
      }

      if (bars.length > 0) {
        gsap.fromTo(
          bars,
          { scaleY: 0.12, transformOrigin: '50% 100%' },
          { scaleY: 1, duration: 0.42, stagger: 0.006, ease: 'power2.out' },
        );
      }

      if (dots.length > 0) {
        gsap.fromTo(
          dots,
          { scale: 0.72, autoAlpha: 0.18, transformOrigin: '50% 50%' },
          { scale: 1, autoAlpha: 1, duration: 0.28, stagger: { each: 0.002, from: 'random' }, ease: 'power2.out' },
        );
      }
    };

    const statCard = svg.closest('[data-motion~="stat-card"]');
    const hoverTarget = statCard instanceof HTMLElement ? statCard : svg;
    addListener(cleanups, hoverTarget, 'mouseenter', replayTrace);
    addListener(cleanups, hoverTarget, 'focusin', replayTrace);

    paths.forEach((path) => {
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    });

    if (paths.length > 0) {
      gsap.to(paths, {
        strokeDashoffset: 0,
        duration: 1.1,
        stagger: 0.035,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: svg,
          start: 'top 84%',
          once: true,
        },
      });
    }

    if (bars.length > 0) {
      gsap.from(bars, {
        scaleY: 0,
        transformOrigin: '50% 100%',
        duration: 0.72,
        stagger: 0.01,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: svg,
          start: 'top 84%',
          once: true,
        },
      });
    }

    if (dots.length > 0) {
      gsap.fromTo(
        dots,
        { scale: 0.75, autoAlpha: 0.08, transformOrigin: '50% 50%' },
        {
          scale: 1,
          autoAlpha: 1,
          duration: 0.38,
          stagger: { each: 0.004, from: 'random' },
          ease: 'power2.out',
          scrollTrigger: {
            trigger: svg,
            start: 'top 84%',
            once: true,
          },
        },
      );
    }
  });

  toElements<HTMLElement>('[data-motion~="stat-value"]').forEach(animateNumericText);
};

const initCommitTwinkles = () => {
  toElements<HTMLElement>('[data-motion~="commit-twinkle"]').forEach((element) => {
    if (element.closest('svg')) {
      return;
    }

    gsap.fromTo(
      element,
      { autoAlpha: 0.35 },
      {
        autoAlpha: 1,
        duration: 0.24,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 88%',
          once: true,
        },
      },
    );
  });
};

const initFaqMotion = (cleanups: Cleanup[]) => {
  toElements<HTMLDetailsElement>('[data-motion~="faq"]').forEach((details) => {
    const summary = details.querySelector<HTMLElement>('summary');
    const body = details.querySelector<HTMLElement>('[data-motion~="faq-body"]');

    if (!summary || !body) {
      return;
    }

    const onClick = (event: Event) => {
      event.preventDefault();

      if (details.dataset.motionAnimating === 'true') {
        return;
      }

      const shouldOpen = !details.open;
      details.dataset.motionAnimating = 'true';

      if (shouldOpen) {
        details.open = true;
        gsap.fromTo(
          body,
          { height: 0, autoAlpha: 0, y: -4, overflow: 'hidden' },
          {
            height: 'auto',
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            ease: 'power2.out',
            onComplete: () => {
              body.style.height = '';
              body.style.overflow = '';
              delete details.dataset.motionAnimating;
            },
          },
        );
        return;
      }

      gsap.to(body, {
        height: 0,
        autoAlpha: 0,
        y: -4,
        overflow: 'hidden',
        duration: 0.22,
        ease: 'power2.inOut',
        onComplete: () => {
          details.open = false;
          body.style.height = '';
          body.style.opacity = '';
          body.style.visibility = '';
          body.style.overflow = '';
          delete details.dataset.motionAnimating;
        },
      });
    };

    addListener(cleanups, summary, 'click', onClick);
  });
};

const initMediaAccents = () => {
  const mediaFrames = toElements<HTMLElement>('[data-motion~="hero-media"]');

  mediaFrames.forEach((frame) => {
    const sparkCount = 24;
    for (let index = 0; index < sparkCount; index += 1) {
      const spark = document.createElement('span');
      spark.className = 'launch-motion-spark';
      spark.style.setProperty('--spark-left', `${12 + Math.random() * 76}%`);
      spark.style.setProperty('--spark-top', `${16 + Math.random() * 62}%`);
      frame.appendChild(spark);
    }

    const sparks = toElements<HTMLElement>('.launch-motion-spark', frame);
    gsap.fromTo(
      sparks,
      { autoAlpha: 0, scale: 0.4 },
      {
        autoAlpha: 0.78,
        scale: 1,
        duration: 0.42,
        stagger: { each: 0.035, from: 'random' },
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: frame,
          start: 'top 82%',
          once: true,
        },
      },
    );
  });
};

const initMotion = () => {
  const cleanups: Cleanup[] = [];
  const splits: SplitInstance[] = [];

  document.documentElement.classList.add(MOTION_READY_CLASS);
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);

  if (getReducedMotion()) {
    initReducedMotion();
    return () => {
      document.documentElement.classList.remove(MOTION_READY_CLASS);
    };
  }

  initGlints(cleanups);
  initAnchorScroll(cleanups);
  initHeaderMotion();
  initHeroMotion(splits);
  initHeroTabs(cleanups);
  initMobileMenuMotion(cleanups);
  initScrollReveals(splits);
  initStatsMotion(cleanups);
  initCommitTwinkles();
  initFaqMotion(cleanups);
  initMediaAccents();

  ScrollTrigger.refresh();

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    splits.forEach((split) => split.revert());
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    document.documentElement.classList.remove(MOTION_READY_CLASS, MOTION_SCROLLED_CLASS);
  };
};

export const initLaunchMotion = () => {
  if (typeof window === 'undefined') {
    return;
  }

  cleanupActiveMotion?.();
  cleanupActiveMotion = initMotion();

  document.addEventListener(
    'astro:before-swap',
    () => {
      cleanupActiveMotion?.();
      cleanupActiveMotion = null;
    },
    { once: true },
  );
};
