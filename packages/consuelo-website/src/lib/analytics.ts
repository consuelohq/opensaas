import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = import.meta.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2026-01-30',
    // tracking ON by default — only off if user explicitly declines
    opt_out_capturing_by_default: false,
    // pageviews + navigation
    capture_pageview: true,
    capture_pageleave: true,
    // autocapture — clicks, inputs, form submissions, everything
    autocapture: true,
    // dead clicks + rage clicks
    capture_dead_clicks: true,
    rageclick: true,
    // session replay
    disable_session_recording: false,
    enable_recording_console_log: true,
    // heatmaps
    enable_heatmaps: true,
    // web vitals + network performance
    capture_performance: true,
    // JS error tracking
    capture_exceptions: true,
    // cross-subdomain (consuelohq.com → app.consuelohq.com)
    cross_subdomain_cookie: true,
    // anonymous until identified
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
  });
  initialized = true;
  trackScrollDepth();
  trackOutboundLinks();
  trackSectionVisibility();
}

export function optOut() {
  posthog.opt_out_capturing();
}

// identify a user — call when they submit a form (demo request, newsletter, etc.)
export function identifyUser(email: string, properties?: Record<string, string>) {
  posthog.identify(email, { email, ...properties });
}

// group users by company for company-level analytics
export function setCompany(companyName: string, properties?: Record<string, string>) {
  posthog.group('company', companyName, properties);
}

export function trackCTAClick(cta: string, href: string) {
  posthog.capture('cta_click', { cta, href, page: window.location.pathname });
}

// track form submissions with user identification
export function trackFormSubmit(form: string, data: Record<string, string>) {
  if (data.email) identifyUser(data.email, data);
  posthog.capture('form_submit', { form, ...data, page: window.location.pathname });
}

function trackScrollDepth() {
  const thresholds = [25, 50, 75, 100];
  const fired = new Set<number>();
  window.addEventListener('scroll', () => {
    const pct = Math.round(
      ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
    );
    for (const t of thresholds) {
      if (pct >= t && !fired.has(t)) {
        fired.add(t);
        posthog.capture('scroll_depth', { depth: t, page: window.location.pathname });
      }
    }
  }, { passive: true });
}

function trackOutboundLinks() {
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      posthog.capture('outbound_click', { href, text: link.textContent?.trim(), page: window.location.pathname });
    }
  });
}

function trackSectionVisibility() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          posthog.capture('section_viewed', {
            section: entry.target.getAttribute('data-section') ?? entry.target.id,
            page: window.location.pathname,
          });
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.3 }
  );
  document.querySelectorAll('[data-section], section[id]').forEach((el) => observer.observe(el));
}
