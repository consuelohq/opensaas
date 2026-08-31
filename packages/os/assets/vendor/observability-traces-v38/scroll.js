(() => {
  const gsap = window.gsap;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
  const narrowViewport = window.matchMedia?.('(max-width: 760px)')?.matches;
  const modal = () => document.querySelector('#tbmLiveTraceModal');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const maxScroll = (node) => ({ x: Math.max(0, node.scrollWidth - node.clientWidth), y: Math.max(0, node.scrollHeight - node.clientHeight) });
  const scrollState = new WeakMap();

  function isElement(value) {
    return value instanceof Element;
  }

  function eventElement(event) {
    if (isElement(event.target)) return event.target;
    return event.target?.parentElement || null;
  }

  function isTraceTarget(event) {
    const root = modal();
    if (!root || !root.classList.contains('open')) return false;
    const target = eventElement(event);
    if (!target || !root.contains(target)) return false;
    if (target.closest('input, textarea, select, option')) return false;
    return true;
  }

  function isScrollable(node) {
    if (!(node instanceof HTMLElement)) return false;
    const max = maxScroll(node);
    if (max.x <= 1 && max.y <= 1) return false;
    const style = window.getComputedStyle(node);
    const hasScrollableOverflow = /(auto|scroll|overlay)/.test(`${style.overflowX} ${style.overflowY}`);
    const isTracePane = node.matches([
      '[data-scroll]',
      '.trxTableScroll',
      '.trxBody',
      '.trxTablePane',
      '.trxRail',
      '.trxRailInner',
      '.lfThreadRail',
      '.lfOpTree',
      '.lfThreadList',
      '.lfTyped',
      '.lfOpDetail',
      '.lfKvTable',
      '.lfSection',
      '.lfRawBlock',
      '.lfRawDetails',
      '.lfDetailSummary',
    ].join(','));
    return hasScrollableOverflow || isTracePane;
  }

  function canMove(delta, current, max) {
    if (Math.abs(delta) < 0.5 || max <= 1) return false;
    return delta < 0 ? current > 1 : current < max - 1;
  }

  function canScrollInDirection(node, dx, dy) {
    const max = maxScroll(node);
    return canMove(dx, node.scrollLeft, max.x) || canMove(dy, node.scrollTop, max.y);
  }

  function wheelDeltas(event) {
    const horizontal = event.shiftKey && !event.deltaX;
    return {
      dx: horizontal ? event.deltaY : event.deltaX,
      dy: horizontal ? 0 : event.deltaY,
    };
  }

  function scrollTarget(event, dx, dy) {
    const root = modal();
    const start = eventElement(event);
    if (!root || !start) return null;

    let node = start;
    while (node && node !== root.parentElement) {
      if (root.contains(node) && isScrollable(node) && canScrollInDirection(node, dx, dy)) return node;
      if (node === root) break;
      node = node.parentElement;
    }

    const tableScroll = root.querySelector('.trxTableScroll');
    const inTable = start.closest('.trxTableScroll, .trxTablePane, .trxTable, .trxHead, .trxRow');
    if (inTable && tableScroll && canScrollInDirection(tableScroll, dx, dy)) return tableScroll;

    return null;
  }

  function syncTargets(node) {
    const next = { x: node.scrollLeft, y: node.scrollTop };
    scrollState.set(node, next);
    return next;
  }

  function smoothWheel(event) {
    if (!isTraceTarget(event)) return;
    const { dx, dy } = wheelDeltas(event);
    const target = scrollTarget(event, dx, dy);
    if (!target) return;

    event.preventDefault();
    const state = gsap.isTweening(target) ? (scrollState.get(target) || syncTargets(target)) : syncTargets(target);
    const max = maxScroll(target);

    state.x = clamp(state.x + dx * 0.55, 0, max.x);
    state.y = clamp(state.y + dy * 0.82, 0, max.y);
    scrollState.set(target, state);

    gsap.to(target, {
      scrollLeft: state.x,
      scrollTop: state.y,
      duration: 0.18,
      ease: 'power1.out',
      overwrite: 'auto',
    });
  }

  if (!gsap || reducedMotion || coarsePointer || narrowViewport) {
    window.__traceGsapScroll = {
      loaded: Boolean(gsap),
      enabled: false,
      reason: reducedMotion ? 'reduced-motion' : (coarsePointer || narrowViewport) ? 'native-touch' : 'missing-gsap',
      mode: 'native-scroll',
    };
    return;
  }

  window.addEventListener('wheel', smoothWheel, { passive: false, capture: true });
  window.__traceGsapScroll = { loaded: true, enabled: true, version: gsap.version, mode: 'mouse-aware-nested-scroll-v6' };
})();
