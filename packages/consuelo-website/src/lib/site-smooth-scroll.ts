import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SCROLL_ROOT = document.documentElement;

type SmoothScrollHandle = {
  disconnect: () => void;
};

let activeHandle: SmoothScrollHandle | null = null;

export const bootSiteSmoothScroll = (): (() => void) | null => {
  if (activeHandle) {
    return activeHandle.disconnect;
  }

  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    return null;
  }

  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    wheelMultiplier: 0.92,
    touchMultiplier: 1.15,
    autoRaf: false,
  });

  ScrollTrigger.scrollerProxy(SCROLL_ROOT, {
    scrollTop(value) {
      if (arguments.length && typeof value === 'number') {
        lenis.scrollTo(value, { immediate: true });
      }

      return lenis.scroll;
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

  lenis.on('scroll', ScrollTrigger.update);

  const ticker = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(ticker);
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.defaults({ scroller: SCROLL_ROOT });

  const handleRefresh = () => {
    lenis.resize();
  };

  ScrollTrigger.addEventListener('refresh', handleRefresh);
  ScrollTrigger.refresh();

  const disconnect = () => {
    ScrollTrigger.removeEventListener('refresh', handleRefresh);
    gsap.ticker.remove(ticker);
    lenis.destroy();
    ScrollTrigger.scrollerProxy(SCROLL_ROOT, {});
    ScrollTrigger.defaults({ scroller: window });
    activeHandle = null;
  };

  activeHandle = { disconnect };

  window.addEventListener('pagehide', disconnect, { once: true });

  return disconnect;
};