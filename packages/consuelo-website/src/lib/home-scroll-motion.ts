import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FEATURE_DESKTOP_QUERY = '(min-width: 961px)';

const getElement = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(selector);

type FeatureScrollMeasures = {
  panel: HTMLElement;
  content: HTMLElement;
  rowOneTravel: number;
  totalTravel: number;
  pinDistance: number;
};

const measureFeatureScroll = (section: HTMLElement): FeatureScrollMeasures | null => {
  const panel = section.querySelector<HTMLElement>('.feature-preview__panel');
  const content = section.querySelector<HTMLElement>('[data-feature-content-track]');
  const grid = content?.querySelector<HTMLElement>('.feature-preview__grid');
  const wordmark = section.querySelector<HTMLElement>('.feature-preview__wordmark-wrap');
  const items = grid
    ? Array.from(grid.querySelectorAll<HTMLElement>('.feature-preview__item'))
    : [];

  if (!panel || !content || !grid || items.length === 0) {
    return null;
  }

  const rowOne = items[Math.min(2, items.length - 1)];
  const rowGap = Number.parseFloat(window.getComputedStyle(grid).rowGap) || 0;
  const rowOneTravel = Math.max(0, rowOne.offsetTop + rowOne.offsetHeight + rowGap * 0.2);
  const wordmarkReserve = wordmark?.offsetHeight ?? 0;
  const viewportHold = window.innerHeight * 0.58;
  const totalTravel = Math.max(
    rowOneTravel,
    grid.scrollHeight - viewportHold + wordmarkReserve * 0.15,
  );
  const remaining = Math.max(0, totalTravel - rowOneTravel);
  const pinDistance = Math.round(
    Math.min(
      rowOneTravel * 1.25 + remaining * 0.7,
      window.innerHeight * 1.65,
    ),
  );

  return {
    panel,
    content,
    rowOneTravel,
    totalTravel,
    pinDistance: Math.max(pinDistance, 420),
  };
};

export const bootHomeScrollMotion = (): void => {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  const cleanups: (() => void)[] = [];

  const heroDiagram = getElement('[data-motion="hero-diagram"]');
  if (heroDiagram) {
    const heroContext = gsap.context(() => {
      gsap.fromTo(
        heroDiagram,
        { y: 0 },
        {
          y: 48,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-section="hero"]',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    });

    cleanups.push(() => heroContext.revert());
  }

  if (!window.matchMedia(FEATURE_DESKTOP_QUERY).matches) {
    window.addEventListener('pagehide', () => cleanups.forEach((cleanup) => cleanup()), { once: true });
    return;
  }

  const section = getElement('[data-motion-section="feature-preview"]');
  if (!section) {
    window.addEventListener('pagehide', () => cleanups.forEach((cleanup) => cleanup()), { once: true });
    return;
  }

  const featureContext = gsap.context(() => {
    const artworks = section.querySelectorAll<HTMLElement>('[data-motion="feature-artwork"]');

    artworks.forEach((artwork) => {
      gsap.fromTo(
        artwork,
        { yPercent: 5.5 },
        {
          yPercent: -5.5,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    });

    const measures = measureFeatureScroll(section);
    if (!measures) {
      return;
    }

    const { panel, content } = measures;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: panel,
        start: 'top top',
        end: () => `+=${measureFeatureScroll(section)?.pinDistance ?? 520}`,
        pin: true,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 0,
        invalidateOnRefresh: true,
      },
    });

    timeline.fromTo(
      content,
      { y: 0 },
      {
        y: () => -(measureFeatureScroll(section)?.rowOneTravel ?? 0),
        ease: 'none',
        duration: 0.68,
      },
      0,
    );

    timeline.to(
      content,
      {
        y: () => -(measureFeatureScroll(section)?.totalTravel ?? 0),
        ease: 'none',
        duration: 0.32,
      },
      0.68,
    );
  }, section);

  cleanups.push(() => featureContext.revert());

  ScrollTrigger.refresh();

  window.addEventListener(
    'pagehide',
    () => {
      cleanups.forEach((cleanup) => cleanup());
    },
    { once: true },
  );
};