import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  newCheckoutFixtureContext,
  checkoutRequestsFor,
} from './checkout-browser-fixture.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const artifactRoot =
  process.env.DIALER_MARKETING_ARTIFACT_DIR ||
  '/tmp/consuelo-dialer-website-browser';
mkdirSync(artifactRoot, { recursive: true });
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};
const server = createServer((request, response) => {
  let route;
  try {
    route = decodeURIComponent(
      new URL(request.url, 'http://127.0.0.1').pathname,
    );
  } catch {
    response.writeHead(400).end();
    return;
  }
  let file = resolve(dist, '.' + route);
  if (file !== dist && !file.startsWith(dist + '/')) {
    response.writeHead(404).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory())
    file = join(file, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader(
    'Content-Type',
    mime[extname(file)] || 'application/octet-stream',
  );
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base =
  process.env.DIALER_MARKETING_BASE_URL ||
  'http://127.0.0.1:' + server.address().port;
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((candidate) => existsSync(candidate));
const browser = await chromium.launch({ executablePath });
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const allSizes = [
  [320, 568],
  [375, 812],
  [430, 932],
  [568, 320],
  [667, 375],
  [768, 1024],
  [1024, 768],
  [1440, 960],
];
const sizes = process.argv.includes('--smoke') ? [[375, 812]] : allSizes;
try {
  for (const [width, height] of sizes) {
    const context = await newCheckoutFixtureContext(browser, {
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        errors.push(response.status() + ' ' + new URL(response.url()).pathname);
    });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const hero = document.querySelector('[data-hero-heading]');
      const navs = [...document.querySelectorAll('header nav')].filter(
        (n) => getComputedStyle(n).display !== 'none',
      );
      const headerBottom = Math.max(
        ...navs.map((n) => n.getBoundingClientRect().bottom),
      );
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        headingTop: hero.getBoundingClientRect().top,
        headerBottom,
      };
    });
    if (geometry.overflow || geometry.headingTop < geometry.headerBottom - 1) {
      emit({ viewport: width + 'x' + height, geometry });
      await page.screenshot({ path: join(artifactRoot, 'layout-failure.png') });
    }
    assert.equal(
      geometry.overflow,
      false,
      'Homepage overflow at ' + width + 'x' + height,
    );
    assert.ok(
      geometry.headingTop >= geometry.headerBottom - 1,
      'Header overlaps headline at ' + width + 'x' + height,
    );
    assert.match(await page.locator('h1').innerText(), /Turn more leads/);
    const docsLinks = await page.getByRole('link', { name: /^docs$/i }).all();
    assert.ok(docsLinks.length > 0, 'Docs navigation is visible');
    for (const link of docsLinks)
      assert.equal(
        await link.getAttribute('href'),
        'https://docs.consuelohq.com/',
      );
    assert.equal(await page.locator('.product-story__chapter').count(), 4);
    const chapters = await page
      .locator('[data-feature-chapter]')
      .evaluateAll((items) =>
        items.map((item) => ({
          label: item.dataset.featureChapter,
          x: item.getBoundingClientRect().x,
          y: item.getBoundingClientRect().y,
          width: item.getBoundingClientRect().width,
        })),
      );
    assert.deepEqual(
      chapters.map((item) => item.label),
      ['inbound', 'outbound', 'analytics', 'ai assistant'],
    );
    if (width > 760) {
      assert.ok(
        Math.abs(chapters[0].y - chapters[1].y) < 2,
        'First feature row aligns',
      );
      assert.ok(
        Math.abs(chapters[2].y - chapters[3].y) < 2,
        'Second feature row aligns',
      );
      assert.ok(
        chapters.every((item) => Math.abs(item.width - chapters[0].width) < 2),
        'Feature widths are equal',
      );
    }
    const returningNav = page.locator('[data-returning-nav]');
    assert.equal(
      await returningNav.getAttribute('inert'),
      '',
      'Returning nav is inactive in hero',
    );
    await page.locator('[data-feature-story]').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-returning-nav]').hasAttribute('inert'),
    );
    if ([375, 1440].includes(width))
      await page.screenshot({
        path: join(artifactRoot, 'features-' + width + '.png'),
      });
    await returningNav
      .getByRole('link', { name: 'Pricing', exact: true })
      .focus();
    assert.equal(
      await returningNav
        .getByRole('link', { name: 'Pricing', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() =>
      document.querySelector('[data-returning-nav]').hasAttribute('inert'),
    );
    const clouds = await page.locator('.cloud-field img').count();
    assert.equal(
      await page
        .locator('.cloud-field__cloud')
        .evaluateAll(
          (elements) => elements.flatMap((el) => el.getAnimations()).length,
        ),
      0,
      'Reduced motion disables decorative cloud animation',
    );
    await page.locator('img').evaluateAll((images) =>
      Promise.all(
        images.map(async (img) => {
          img.loading = 'eager';
          try {
            await img.decode();
          } catch {}
        }),
      ),
    );
    const badImages = await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.getAttribute('src')),
      );
    assert.deepEqual(badImages, [], 'Missing image at ' + width + 'x' + height);
    const faq = page.locator('[data-home-faq-item]');
    await faq.nth(0).locator('summary').click();
    assert.equal(await faq.nth(0).getAttribute('open'), '');
    await faq.nth(1).locator('summary').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-home-faq-item]').open,
    );
    assert.equal(await faq.nth(1).getAttribute('open'), '');
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-cloud-reveal]').hasAttribute('inert'),
    );
    assert.ok(
      (await page.locator('#faq .home-faq__steps li').count()) >= 3,
      'Homepage FAQ provides setup steps',
    );
    assert.ok(
      (await page.locator('#faq .home-faq__bullets li').count()) >= 6,
      'Homepage FAQ provides scannable lists',
    );
    await page.locator('.cloud-cta__primary').scrollIntoViewIfNeeded();
    const footer = page.locator('.dialer-footer');
    assert.ok(
      (await footer.locator('nav').count()) >= 3,
      'Footer has grouped navigation',
    );
    await footer.scrollIntoViewIfNeeded();
    if ([375, 1440].includes(width))
      await page.screenshot({
        path: join(artifactRoot, 'footer-' + width + '.png'),
      });
    const footerBox = await footer.boundingBox();
    assert.ok(
      footerBox && footerBox.width <= width + 1,
      'Footer fits viewport',
    );
    await page.locator('.cloud-cta__primary').scrollIntoViewIfNeeded();
    const close = page.locator('.cloud-cta__primary');
    const box = await close.boundingBox();
    assert.ok(
      box && box.y >= 0 && box.y + box.height <= height + 1,
      'Footer CTA clipped at ' + width + 'x' + height,
    );
    await close.click();
    await page.waitForURL((url) => /^\/pricing\/?$/.test(url.pathname));
    const destination = new URL(page.url()).pathname;
    assert.ok(
      destination === '/pricing' || destination === '/pricing/',
      'Setup CTA reaches plan selection',
    );
    assert.deepEqual(errors, [], 'Browser errors at ' + width + 'x' + height);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    if ([375, 568, 1440].includes(width))
      await page.screenshot({
        path: join(artifactRoot, 'home-' + width + 'x' + height + '.png'),
        fullPage: width === 1440,
      });
    emit({ viewport: width + 'x' + height, passed: true, cloudImages: clouds });
    await context.close();
  }
  const context = await newCheckoutFixtureContext(browser, {
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  const pricingClearance = await page.evaluate(() => {
    const social = [...document.querySelectorAll('.os-header__socials')].find(
      (el) => el.getBoundingClientRect().height > 0,
    );
    return (
      document.querySelector('.pricing-frame').getBoundingClientRect().top -
      social.getBoundingClientRect().bottom
    );
  });
  assert.ok(pricingClearance >= 16, 'Pricing keeps blue below social links');
  assert.equal(
    await page.locator('[data-logo-pause]').count(),
    0,
    'No visible logo pause button',
  );
  await page.locator('[data-logo-carousel]').scrollIntoViewIfNeeded();
  const logoSizes = await page
    .locator('.technology-wordmark:not([aria-hidden]) img')
    .evaluateAll((images) =>
      images.map((img) => ({
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
      })),
    );
  assert.ok(
    logoSizes.every((size) => size.width >= 44 && size.height >= 32),
    'Stack marks have readable display sizes',
  );
  assert.equal(
    await page.locator('.pricing-close .cloud-field').count(),
    1,
    'Pricing close restores clouds',
  );
  assert.ok((await page.locator('.dialer-footer nav').count()) >= 3);
  assert.equal(await page.locator('[data-plan-code]').count(), 4);
  const cards = await page.locator('[data-plan-code]').evaluateAll((elements) =>
    elements.map((el) => ({
      code: el.dataset.planCode,
      name: el.querySelector('h2').textContent.trim(),
      price: el.querySelector('.plan-column__price strong').textContent.trim(),
      monthlyCents: Number(
        el.querySelector('[data-plan-billing]').dataset.monthlyCents,
      ),
    })),
  );
  assert.deepEqual(
    cards.map((card) => card.code),
    ['starter', 'professional', 'agency', 'enterprise'],
  );
  let setupCases = 0;
  for (const billing of ['monthly', 'annual']) {
    for (const card of cards) {
      await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
      await page
        .locator('[data-billing-control]')
        .getByText(billing === 'annual' ? 'Annual' : 'Monthly', { exact: true })
        .click();
      const choose = page.locator(
        '[data-plan-code="' + card.code + '"] [data-plan-cta]',
      );
      const destination = new URL(await choose.getAttribute('href'), base);
      assert.equal(destination.searchParams.get('plan'), card.code);
      assert.equal(destination.searchParams.get('billing'), billing);
      await choose.click();
      if (card.code === 'starter')
        await page.waitForURL('https://app.gohighlevel.com/**');
      else {
        await page.waitForURL('https://checkout.stripe.com/**');
        const request = checkoutRequestsFor(context).at(-1);
        assert.equal(request.selection.plan, card.code);
        assert.equal(request.selection.billing, billing);
        assert.equal(request.selection.seats, 1);
        assert.equal('price' in request, false);
      }
      setupCases++;
    }
  }
  emit({
    flow: 'all-plan-setup',
    plans: cards.length,
    billingPeriods: 2,
    cases: setupCases,
  });
  for (const bad of ['__proto__', '<img src=x onerror=alert(1)>']) {
    await page.goto(base + '/get-started?plan=' + encodeURIComponent(bad), {
      waitUntil: 'networkidle',
    });
    await page.waitForURL('https://checkout.stripe.com/**');
    assert.equal(
      checkoutRequestsFor(context).at(-1).selection.plan,
      'professional',
    );
    assert.equal(await page.locator('img[src="x"]').count(), 0);
  }
  const paths = [
    '/',
    '/pricing',
    '/get-started',
    '/how-it-works',
    '/contact',
    '/privacy',
    '/terms',
    '/support',
  ];
  let linkCount = 0;
  const checkedTargets = new Map();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) =>
        links
          .map((a) => a.getAttribute('href'))
          .filter((h) => h.startsWith('/') && !h.startsWith('//')),
      );
    for (const href of new Set(hrefs)) {
      const target = new URL(href, base);
      let result = checkedTargets.get(target.href);
      if (!result) {
        const response = await fetch(target, {
          signal: AbortSignal.timeout(8000),
        });
        result = { status: response.status, html: await response.text() };
        checkedTargets.set(target.href, result);
      }
      const html = result.html;
      assert.equal(
        result.status,
        200,
        'Broken internal link ' + href + ' on ' + path,
      );
      if (target.hash) {
        const id = decodeURIComponent(target.hash.slice(1));
        assert.ok(
          html.includes('id="' + id + '"') || html.includes("id='" + id + "'"),
          'Missing anchor ' + href,
        );
      }
      linkCount++;
    }
    assert.match(
      await page.locator('meta[name="robots"]').getAttribute('content'),
      process.env.PUBLIC_SITE_CHANNEL === 'production'
        ? /index,follow/
        : /noindex/,
    );
  }
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  await page.screenshot({
    path: join(artifactRoot, 'pricing-1440x960.png'),
    fullPage: true,
  });
  await context.close();
  const motion = await newCheckoutFixtureContext(browser, {
    viewport: { width: 667, height: 375 },
    reducedMotion: 'no-preference',
  });
  const motionPage = await motion.newPage();
  await motionPage.goto(base + '/', { waitUntil: 'networkidle' });
  await motionPage.waitForFunction(() =>
    document.documentElement.classList.contains('lenis'),
  );
  await motionPage.evaluate(() => window.scrollTo(0, 600));
  await motionPage.waitForFunction(() => scrollY >= 599);
  const restoredScroll = await motionPage.evaluate(() => {
    const before = scrollY;
    for (let pass = 0; pass < 2; pass++) {
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    }
    return {
      before,
      after: scrollY,
      lenis: document.documentElement.classList.contains('lenis'),
    };
  });
  assert.equal(restoredScroll.lenis, true, 'BFCache pagehide retains Lenis');
  assert.ok(
    Math.abs(restoredScroll.before - restoredScroll.after) <= 1,
    'BFCache pageshow preserves scroll position',
  );
  await motionPage.mouse.wheel(0, 450);
  await motionPage.waitForFunction(
    (before) => scrollY > before + 100,
    restoredScroll.after,
  );
  await motionPage.waitForFunction(
    () => !document.documentElement.classList.contains('lenis-scrolling'),
  );
  const cloudMotion = await motionPage
    .locator('.cloud-field__cloud')
    .evaluateAll((elements) => {
      const animations = elements.flatMap((el) => el.getAnimations());
      const finite = animations.every((animation) =>
        Number.isFinite(animation.effect.getComputedTiming().endTime),
      );
      animations.forEach((animation) => animation.finish());
      return {
        count: animations.length,
        finite,
        finished: animations.every(
          (animation) => animation.playState === 'finished',
        ),
        hints: elements.map((el) => getComputedStyle(el).willChange),
      };
    });
  assert.ok(
    cloudMotion.count > 0 && cloudMotion.finite && cloudMotion.finished,
    'Decorative clouds finish',
  );
  assert.ok(
    cloudMotion.hints.every((value) => value === 'auto'),
    'Clouds release permanent compositor hints',
  );
  await motionPage.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await motionPage.waitForFunction(
    () => !document.querySelector('[data-cloud-reveal]').hasAttribute('inert'),
  );
  await motionPage.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })),
  );
  assert.equal(
    await motionPage.evaluate(() =>
      document.documentElement.classList.contains('lenis'),
    ),
    false,
    'Terminal pagehide destroys Lenis',
  );
  await motionPage.goto(base + '/pricing', { waitUntil: 'networkidle' });
  const strip = motionPage.locator('[data-logo-carousel]');
  await strip.scrollIntoViewIfNeeded();
  await motionPage.mouse.move(0, 0);
  await motionPage.waitForFunction(() =>
    document
      .querySelector('[data-logo-track]')
      .getAnimations()
      .some((animation) => animation.playState === 'running'),
  );
  await strip.hover();
  await motionPage.waitForFunction(() =>
    document
      .querySelector('[data-logo-track]')
      .getAnimations()
      .every((animation) => animation.playState === 'paused'),
  );
  await motionPage.locator('[data-technology-strip]').focus();
  await motionPage.mouse.move(0, 0);
  await motionPage.waitForFunction(() =>
    document
      .querySelector('[data-logo-track]')
      .getAnimations()
      .every((animation) => animation.playState === 'paused'),
  );
  await motionPage.emulateMedia({ reducedMotion: 'reduce' });
  await motionPage.waitForFunction(
    () =>
      document.querySelector('[data-logo-track]').getAnimations().length === 0,
  );
  await motion.close();
  const fragmentContext = await newCheckoutFixtureContext(browser, {
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'no-preference',
  });
  const fragmentPage = await fragmentContext.newPage();
  for (const from of [null, '/pricing']) {
    if (from)
      await fragmentPage.goto(base + from, { waitUntil: 'networkidle' });
    await fragmentPage.goto(base + '/#features', { waitUntil: 'networkidle' });
    await fragmentPage.waitForFunction(
      () => {
        const target = document.getElementById('features');
        return (
          target &&
          scrollY > 100 &&
          target.getBoundingClientRect().top < innerHeight
        );
      },
      undefined,
      { timeout: 5000 },
    );
  }
  await fragmentContext.close();

  // Run the real enabled-key head script against a local parsed-body fixture.
  const analyticsScript = readFileSync(
    join(root, 'src/layouts/MarketingLayout.astro'),
    'utf8',
  ).match(
    /<script define:vars=\{\{ posthogKey, posthogHost \}\}>([\s\S]*?)<\/script>/,
  )[1];
  const analytics = await newCheckoutFixtureContext(browser, {
    viewport: { width: 667, height: 375 },
  });
  const analyticsPage = await analytics.newPage();
  const analyticsErrors = [];
  analyticsPage.on('pageerror', (error) => analyticsErrors.push(error.message));
  let externalRequests = 0;
  await analyticsPage.addInitScript(() => {
    window.fixtureCaptures = [];
    window.fixtureObserverCount = 0;
    window.posthog = {
      __SV: 1,
      init() {},
      capture: (event, properties) =>
        window.fixtureCaptures.push({ event, properties }),
    };
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(...args) {
        super(...args);
        window.fixtureObserverCount++;
      }
    };
  });
  await analyticsPage.route('**/*', (route) => {
    if (route.request().url() === base + '/analytics-fixture') {
      return route.fulfill({
        contentType: 'text/html',
        body:
          '<!doctype html><html><head><script>var posthogKey="fixture-only-key",posthogHost="https://analytics.invalid";window.fixtureInitialReadyState=document.readyState;' +
          analyticsScript +
          '</script></head><body style="margin:0"><section id="first" style="height:200px">First</section><div style="height:800px"></div><section data-section="last" style="height:200px">Last</section></body></html>',
      });
    }
    externalRequests++;
    return route.abort();
  });
  await analyticsPage.goto(base + '/analytics-fixture', { waitUntil: 'load' });
  await analyticsPage.waitForFunction(() =>
    window.fixtureCaptures.some(
      (c) => c.event === 'section_viewed' && c.properties.section === 'first',
    ),
  );
  assert.equal(
    await analyticsPage.evaluate(() => window.fixtureInitialReadyState),
    'loading',
    'Fixture runs in head before body exists',
  );
  await analyticsPage.evaluate(analyticsScript);
  await analyticsPage.evaluate(() =>
    document.dispatchEvent(new Event('DOMContentLoaded')),
  );
  await analyticsPage.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await analyticsPage.waitForFunction(() =>
    window.fixtureCaptures.some(
      (c) => c.event === 'section_viewed' && c.properties.section === 'last',
    ),
  );
  await analyticsPage.evaluate(() => window.scrollTo(0, 0));
  const sectionCaptures = await analyticsPage.evaluate(() =>
    window.fixtureCaptures.filter((c) => c.event === 'section_viewed'),
  );
  assert.deepEqual(sectionCaptures.map((c) => c.properties.section).sort(), [
    'first',
    'last',
  ]);
  assert.equal(
    await analyticsPage.evaluate(() => window.fixtureObserverCount),
    1,
    'Only one section observer is registered',
  );
  assert.deepEqual(analyticsErrors, []);
  assert.equal(
    externalRequests,
    0,
    'Analytics fixture sends no external traffic',
  );
  await analytics.close();
  emit({
    flow: 'interaction-lifecycle',
    persistedCycles: 2,
    terminalCleanup: 'pass',
    cloudMotion: 'finite',
    sectionAnalytics: 'pass',
    analyticsExternalRequests: externalRequests,
  });
  emit({
    flow: 'pricing-to-setup',
    querySafety: 'pass',
    internalLinks: linkCount,
    motion: 'pass',
    artifacts: artifactRoot,
  });
} finally {
  emit({ cleanup: 'closing browser' });
  await browser.close();
  emit({ cleanup: 'closing server' });
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  emit({ cleanup: 'complete' });
}
