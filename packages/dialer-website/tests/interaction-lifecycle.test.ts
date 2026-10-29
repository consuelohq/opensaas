import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pricingPlans } from '../src/data/pricing-content';

const root = resolve(import.meta.dir, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const compile = (code: string) => new Bun.Transpiler({ loader: 'ts' }).transformSync(code.replace(/^\s*import .*;\n/gm, '').replace(/export /g, ''));
const transition = (target: EventTarget, name: string, persisted: boolean) => {
 const event = new Event(name);
 Object.defineProperty(event, 'persisted', { value: persisted });
 target.dispatchEvent(event);
};

describe('Dialer website interaction lifecycle', () => {
 it('preserves smooth scrolling through repeated BFCache restores and cleans up once on terminal departure', () => {
  const win = Object.assign(new EventTarget(), {
   matchMedia: () => ({ matches: false }), location: { hash: '' },
   scrollTo: () => { scrollResets++; }, innerWidth: 1440, innerHeight: 960,
  });
  let scrollResets = 0;
  const tickers = new Set<unknown>();
  const refreshListeners = new Set<() => void>();
  let refreshes = 0;
  const trigger = {
   scrollerProxy: () => {}, defaults: () => {}, update: () => {},
   addEventListener: (_: string, fn: () => void) => refreshListeners.add(fn),
   removeEventListener: (_: string, fn: () => void) => refreshListeners.delete(fn),
   refresh: () => { refreshes++; refreshListeners.forEach(fn => fn()); },
  };
  const instances: FakeLenis[] = [];
  class FakeLenis {
   scroll = 0; destroyed = 0; resized = 0;
   constructor() { instances.push(this); }
   on() {} raf() {}
   scrollTo(value: number) { this.scroll = value; }
   resize() { this.resized++; }
   destroy() { this.destroyed++; }
  }
  const boot = new Function('gsap', 'ScrollTrigger', 'Lenis', 'window', 'document', 'history',
   compile(source('src/lib/site-smooth-scroll.ts')) + '; return bootSiteSmoothScroll;')(
    {registerPlugin() {},ticker:{add:(fn:unknown)=>tickers.add(fn),remove:(fn:unknown)=>tickers.delete(fn),lagSmoothing() {}}},
    trigger, FakeLenis, win, { documentElement: {} }, { scrollRestoration: 'auto' },
   );
  const disconnect = boot();
  expect(boot()).toBe(disconnect);
  instances[0].scroll = 470;
  for (let pass = 0; pass < 2; pass++) {
   transition(win, 'pagehide', true);
   expect(instances[0].destroyed).toBe(0);
   expect(tickers.size).toBe(1);
   transition(win, 'pageshow', true);
   expect(instances[0].scroll).toBe(470);
  }
  expect(instances).toHaveLength(1);
  expect(scrollResets).toBe(1);
  expect(refreshes).toBeGreaterThan(1);
  transition(win, 'pagehide', false);
  disconnect();
  expect(instances[0].destroyed).toBe(1);
  expect(tickers.size).toBe(0);
  expect(refreshListeners.size).toBe(0);
  const refreshesAfterCleanup = refreshes;
  transition(win, 'pageshow', true);
  expect(refreshes).toBe(refreshesAfterCleanup);
  const secondDisconnect = boot();
  disconnect();
  expect(instances[1].destroyed).toBe(0);
  secondDisconnect();
  expect(instances[1].destroyed).toBe(1);
 });

 it('uses catalog names and prices for every selected setup plan and mailto subject', () => {
  const script = source('src/pages/get-started.astro').match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  const catalog = pricingPlans.map(plan => ({ ...plan, name: plan.name + ' updated', price: '$271' }));
  for (const plan of catalog) {
   const selected = { textContent: 'Tell us how your team calls today.' };
   const request = { href: 'mailto:support@consuelohq.com?subject=Set%20up%20Consuelo%20Dialer' };
   new Function('pricingPlans', 'location', 'document', compile(script!))(catalog,
    { search: new URL(plan.href, 'https://example.test').search },
    { querySelector: (selector: string) => selector === '[data-selected-plan]' ? selected : request });
   expect(selected.textContent).toContain(plan.name + ' — ' + plan.price + ' ' + plan.subtitle.toLowerCase());
   expect(new URL(request.href).searchParams.get('subject')).toContain(plan.name + ' — ' + plan.price);
  }
  for (const search of ['', '?plan=__proto__', '?plan=toString', '?plan=%3Cimg%3E', '?plan=unknown']) {
   const selected = { textContent: 'Tell us how your team calls today.' };
   const request = { href: 'mailto:support@consuelohq.com?subject=Set%20up%20Consuelo%20Dialer' };
   new Function('pricingPlans', 'location', 'document', compile(script!))(catalog, { search }, {
    querySelector: (selector: string) => selector === '[data-selected-plan]' ? selected : request,
   });
   expect(selected.textContent).toStartWith('Tell us');
   expect(new URL(request.href).searchParams.get('subject')).toBe('Set up Consuelo Dialer');
  }
 });

 it('bounds cloud drift and releases permanent compositor hints', () => {
  const cloud = source('src/components/visuals/CloudField.astro');
  expect(cloud).not.toMatch(/animation:[^;]*\binfinite\b/);
  expect(cloud).not.toMatch(/will-change:\s*transform/);
  expect(cloud).toMatch(/prefers-reduced-motion: reduce/);
  expect(cloud).toContain('animation: none');
 });

 it('registers section visibility after DOM readiness with a single observer and one capture per section', () => {
  const script = source('src/layouts/MarketingLayout.astro').match(/<script define:vars=\{\{ posthogKey, posthogHost \}\}>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  const win = Object.assign(new EventTarget(), { IntersectionObserver: true, location: { pathname: '/', hostname: 'example.test' } });
  const doc = Object.assign(new EventTarget(), { readyState: 'loading', querySelectorAll: () => doc.readyState === 'loading' ? [] : [section] });
  const section = { id: 'features', getAttribute: () => 'features' };
  const captures: unknown[] = [];
  const observed: unknown[] = [];
  let observers = 0;
  let notify: (entries: unknown[]) => void = () => {};
  class Observer {
   constructor(callback: (entries: unknown[]) => void) { observers++; notify = callback; }
   observe(target: unknown) { observed.push(target); }
   unobserve() {}
  }
  const posthog = { __SV: 1, init() {}, capture: (...args: unknown[]) => captures.push(args) };
  Object.assign(win, { posthog });
  const run = () => new Function('window', 'document', 'posthog', 'posthogKey', 'posthogHost', 'IntersectionObserver', script!)(
   win, doc, posthog, 'fixture-only-key', 'https://analytics.invalid', Observer);
  run();
  expect(observed).toHaveLength(0);
  doc.readyState = 'interactive';
  doc.dispatchEvent(new Event('DOMContentLoaded'));
  doc.dispatchEvent(new Event('DOMContentLoaded'));
  run();
  expect(observers).toBe(1);
  expect(observed).toEqual([section]);
  notify([{ isIntersecting: false, target: section }]);
  expect(captures).toHaveLength(0);
  notify([{ isIntersecting: true, target: section }]);
  notify([{ isIntersecting: true, target: section }]);
  expect(captures).toEqual([['section_viewed', { section: 'features', page: '/' }]]);
 });
});
