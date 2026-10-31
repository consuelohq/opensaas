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
const artifacts =
  process.env.DIALER_PRICING_ARTIFACT_DIR ||
  '/tmp/consuelo-dialer-pricing-browser';
mkdirSync(artifacts, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  let route;
  try {
    route = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = resolve(dist, '.' + route);
  if (file !== dist && !file.startsWith(dist + '/')) {
    res.writeHead(404).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory())
    file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    'Content-Type',
    mime[extname(file)] || 'application/octet-stream',
  );
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base =
  process.env.DIALER_PRICING_BASE_URL ||
  'http://127.0.0.1:' + server.address().port;
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath });
const emit = (v) => process.stdout.write(JSON.stringify(v) + '\n');
const sizes = process.argv.includes('--smoke')
  ? [
      [375, 812],
      [1440, 1000],
    ]
  : [
      [320, 568],
      [375, 812],
      [430, 932],
      [568, 320],
      [667, 375],
      [768, 1024],
      [1024, 768],
      [1440, 1000],
    ];
try {
  for (const [width, height] of sizes) {
    const context = await newCheckoutFixtureContext(browser, {
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().startsWith(base) && r.status() >= 400)
        errors.push(r.status() + ' ' + new URL(r.url()).pathname);
    });
    await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('[data-plan-code]').count(), 4);
    const overflowEvidence = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.right > innerWidth + 1 &&
            !el.closest('.comparison-scroll,.technology-strip')
          );
        })
        .slice(0, 20)
        .map((el) => ({
          tag: el.tagName,
          classes: el.className,
          width: el.getBoundingClientRect().width,
          right: el.getBoundingClientRect().right,
        })),
    }));
    if (overflowEvidence.scroll > width + 1) {
      emit({ overflowEvidence });
      emit(
        await page.evaluate(() =>
          [...document.querySelectorAll('body *')]
            .filter((e) => e.scrollWidth > e.clientWidth + 50)
            .slice(0, 30)
            .map((e) => ({
              tag: e.tagName,
              classes: e.className,
              client: e.clientWidth,
              scroll: e.scrollWidth,
              overflow: getComputedStyle(e).overflow,
              position: getComputedStyle(e).position,
              text: e.textContent.slice(0, 50),
            })),
        ),
      );
      await page.screenshot({ path: join(artifacts, 'overflow.png') });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      'Document overflow ' + width + 'x' + height,
    );
    assert.equal(
      await page
        .locator('.plan-column h2')
        .evaluateAll((els) =>
          els.some((el) => el.scrollWidth > el.clientWidth + 1),
        ),
      false,
      'Plan heading clipped',
    );
    await page.locator('img').evaluateAll((images) =>
      Promise.all(
        images.map((image) => {
          image.loading = 'eager';
          return image.decode();
        }),
      ),
    );
    assert.deepEqual(
      await page
        .locator('img')
        .evaluateAll((els) =>
          els
            .filter((i) => !i.complete || i.naturalWidth === 0)
            .map((i) => i.src),
        ),
      [],
    );
    await page
      .locator('[data-billing-control]')
      .getByText('Annual', { exact: true })
      .click();
    assert.match(
      await page
        .locator('[data-plan-code="agency"] [data-plan-billing]')
        .innerText(),
      /\$1,788.*annually/,
    );
    assert.match(
      await page.locator('[data-team-total]').innerText(),
      /\$8,940.*year.*5 reps/,
    );
    await page.locator('[data-seat-count]').fill('2');
    assert.match(
      await page.locator('[data-team-total]').innerText(),
      /\$3,576.*2 reps/,
    );
    await page.locator('[data-seat-count]').fill('0');
    assert.equal(
      await page.locator('[data-seat-count]').getAttribute('aria-invalid'),
      'true',
    );
    assert.match(
      await page.locator('[data-team-total]').innerText(),
      /whole rep count/,
    );
    await page.locator('[data-seat-count]').fill('5');
    await page
      .locator('[data-billing-control]')
      .getByText('Monthly', { exact: true })
      .click();
    assert.match(
      await page.locator('[data-team-total]').innerText(),
      /\$745.*month/,
    );
    const comparison = page.locator('[data-comparison-group="outbound"]');
    await page.locator('[data-calling-focus]').selectOption('inbound');
    assert.equal(await comparison.isVisible(), false);
    assert.equal(
      await page.locator('[data-comparison-group="inbound"]').isVisible(),
      true,
    );
    await page
      .getByRole('button', { name: 'Key features', exact: true })
      .click();
    assert.equal(
      await page.locator('[data-feature-row="endpoints"]').isVisible(),
      false,
    );
    assert.equal(
      await page.locator('[data-feature-row="routing"]').isVisible(),
      true,
    );
    await page
      .getByRole('button', { name: 'All features', exact: true })
      .click();
    await page.locator('[data-calling-focus]').selectOption('all');
    const detail = page.locator('[data-feature-row="local-presence"] details');
    await detail.locator('summary').click();
    assert.equal(await detail.getAttribute('open'), '');
    const header = page.locator('[data-comparison-sticky-head]');
    assert.equal(
      await header.isVisible(),
      true,
      'Comparison labels are sticky-ready',
    );
    const tableTop = await page
      .locator('[data-comparison-table]')
      .evaluate((el) => el.getBoundingClientRect().top + scrollY);
    for (const depth of [220, 500]) {
      await page.evaluate((y) => window.scrollTo(0, y), tableTop + depth);
      assert.ok(
        Math.abs((await header.boundingBox()).y) < 2,
        'Plan headings pin while reading rows',
      );
    }
    await page.locator('.comparison-scroll').evaluate((el) => {
      el.scrollLeft = Math.min(180, el.scrollWidth - el.clientWidth);
    });
    await page.waitForFunction(() => {
      const body = document.querySelector('.comparison-scroll');
      const head = document.querySelector('[data-comparison-sticky-head]');
      return Math.abs(body.scrollLeft - head.scrollLeft) < 1;
    });
    const alignment = await page.evaluate(() => {
      const head = document
        .querySelector('.comparison-column-head > span:nth-child(3)')
        .getBoundingClientRect();
      const cell =
        document
          .querySelector('[data-feature-row="lines"] td:nth-of-type(2)')
          ?.getBoundingClientRect() ??
        document
          .querySelector(
            '[data-comparison-group="outbound"] tbody tr td:nth-of-type(2)',
          )
          .getBoundingClientRect();
      return Math.abs(
        head.left + head.width / 2 - (cell.left + cell.width / 2),
      );
    });
    assert.ok(alignment < 2, 'Sticky plan names align after horizontal scroll');
    await page.locator('.comparison-scroll').evaluate((el) => {
      el.scrollLeft = 0;
    });
    await detail
      .locator('summary')
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => getSelection().removeAllRanges());
    await detail.locator('summary span').dblclick();
    assert.equal(
      await page.evaluate(() => getSelection().toString()),
      '',
      'Feature heading does not select on double click',
    );
    assert.equal(
      await detail.locator('summary [data-icon="chevron"]').count(),
      1,
    );
    const faq = page.locator('#pricing-faq [data-home-faq-item]');
    assert.equal(await faq.count(), 10);
    assert.equal(
      await faq.evaluateAll((items) => items.every((item) => item.open)),
      true,
    );
    await faq.nth(1).locator('summary').click();
    assert.equal(await faq.nth(0).getAttribute('open'), '');
    await faq.nth(1).locator('summary').click();
    assert.equal(await faq.nth(0).getAttribute('open'), '');
    await page.evaluate(() => getSelection().removeAllRanges());
    await faq.first().locator('summary > span').first().dblclick();
    assert.equal(
      await page.evaluate(() => getSelection().toString()),
      '',
      'FAQ heading does not select on double click',
    );
    await page.keyboard.press('Tab');
    await faq.first().locator('summary').focus();
    assert.equal(
      await faq
        .first()
        .locator('summary')
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      'none',
    );
    assert.ok(
      await faq
        .first()
        .locator('summary')
        .evaluate((el) =>
          getComputedStyle(el).textDecorationLine.includes('underline'),
        ),
      'Keyboard focus stays perceptible',
    );
    const wasOpen = await faq.first().evaluate((el) => el.open);
    await page.keyboard.press('Space');
    assert.equal(await faq.first().evaluate((el) => el.open), !wasOpen);
    await page.keyboard.press('Space');
    const answer = faq.first().locator('.home-faq__answer p').first();
    await answer.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const word = await answer.evaluate((el) => {
      const range = document.createRange();
      range.setStart(el.firstChild, 0);
      range.setEnd(el.firstChild, 5);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.dblclick(word.x, word.y);
    assert.ok(
      (await page.evaluate(() => getSelection().toString())).trim().length > 0,
      'FAQ answer text remains copyable',
    );
    await page.evaluate(() => getSelection().removeAllRanges());
    const moreFaqs = page.getByRole('link', {
      name: 'See more FAQs',
      exact: true,
    });
    assert.equal(await moreFaqs.getAttribute('href'), '/#faq');
    assert.ok(
      await moreFaqs.evaluate((el) =>
        getComputedStyle(el).textDecorationLine.includes('underline'),
      ),
    );
    if (width === 1440) {
      assert.equal(
        await page
          .locator('#pricing-heading')
          .evaluate((el) =>
            Math.round(
              el.getBoundingClientRect().height /
                parseFloat(getComputedStyle(el).lineHeight),
            ),
          ),
        2,
      );
      assert.ok(
        (
          await page
            .locator('[data-plan-code="professional"] .plan-column__price')
            .boundingBox()
        ).y < 820,
        'Prices visible in first desktop viewport',
      );
      assert.equal(
        await page
          .locator('.technology-strip')
          .evaluate((el) =>
            getComputedStyle(el).getPropertyValue('--visible-logos').trim(),
          ),
        '7',
      );
    }
    const addonHeading = page.locator('.pricing-sticky-heading');
    if (width >= 1060 && height > 500) {
      await page.evaluate(() =>
        window.scrollTo(0, document.getElementById('addons').offsetTop + 180),
      );
      const top = (await addonHeading.boundingBox()).y;
      assert.ok(top >= 20 && top < 100, 'Add-on heading stays in view ' + top);
      await page.evaluate(() => window.scrollBy(0, 150));
      assert.ok(
        Math.abs((await addonHeading.boundingBox()).y - top) < 2,
        'Add-on heading is sticky',
      );
    }
    await page.locator('.pricing-close').scrollIntoViewIfNeeded();
    await page.locator('[data-team-addons-details] > summary').click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
      'expanded pricing selections must fit the viewport',
    );
    if ([375, 1440].includes(width))
      await page.locator('[data-team-planner]').screenshot({
        path: join(artifacts, 'pricing-selection-' + width + '.png'),
      });
    await page.locator('[data-team-addons-details] > summary').click();
    assert.deepEqual(errors, [], 'Browser errors ' + width + 'x' + height);
    await page.evaluate(() => window.scrollTo(0, 0));
    if ([375, 568, 1440].includes(width))
      await page.screenshot({
        path: join(artifacts, 'pricing-' + width + 'x' + height + '.png'),
        fullPage: true,
      });
    if ([375, 1440].includes(width))
      await page.screenshot({
        path: join(artifacts, 'pricing-top-' + width + '.png'),
      });
    emit({ viewport: width + 'x' + height, passed: true });
    await context.close();
  }
  const context = await newCheckoutFixtureContext(browser, {
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  await page
    .locator('[data-billing-control]')
    .getByText('Annual', { exact: true })
    .click();
  await page.locator('[data-plan-code="agency"] [data-plan-cta]').click();
  await page.waitForURL('https://checkout.stripe.com/**');
  assert.equal(checkoutRequestsFor(context).at(-1).selection.plan, 'agency');
  assert.equal(checkoutRequestsFor(context).at(-1).selection.billing, 'annual');
  for (const bad of ['__proto__', '<img src=x onerror=alert(1)>']) {
    await page.goto(
      base + '/get-started?plan=' + encodeURIComponent(bad) + '&billing=annual',
      { waitUntil: 'networkidle' },
    );
    await page.waitForURL('https://checkout.stripe.com/**');
    assert.equal(
      checkoutRequestsFor(context).at(-1).selection.plan,
      'professional',
    );
  }
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  await page.getByLabel('Annual', { exact: true }).focus();
  await page.keyboard.press('Space');
  assert.match(
    await page
      .locator('[data-plan-code="professional"] [data-plan-billing]')
      .innerText(),
    /\$1,188/,
  );
  for (const link of await page.locator('.minute-pack,.number-packs a').all())
    assert.match(await link.getAttribute('href'), /^\/pricing\?addon=/);
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    'noindex,nofollow',
  );
  await page.getByRole('link', { name: 'MANAGE BILLING', exact: true }).click();
  await page.waitForURL('https://billing.stripe.com/p/login/**');
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  const beforeAddons = checkoutRequestsFor(context).length;
  await page.locator('[data-team-plan]').selectOption('agency');
  await page.locator('[data-seat-count]').fill('2');
  await page
    .locator('[data-billing-control]')
    .getByText('Annual', { exact: true })
    .click();
  await page.getByRole('link', { name: 'Choose Mercury', exact: true }).click();
  await page.locator('.minute-pack[href*="minutes-600"]').click();
  await page.locator('.number-packs a[href*="numbers-10"]').click();
  assert.equal(await page.locator('[data-team-mercury]').isChecked(), true);
  assert.equal(await page.locator('[data-team-minutes]').inputValue(), '600');
  assert.equal(await page.locator('[data-team-numbers]').inputValue(), '10');
  assert.equal(await page.locator('[data-team-plan]').inputValue(), 'agency');
  assert.equal(await page.locator('[data-seat-count]').inputValue(), '2');
  assert.match(
    await page.locator('[data-team-total]').innerText(),
    /4,176 \/ year.*50 once/,
  );
  assert.equal(
    checkoutRequestsFor(context).length,
    beforeAddons,
    'choosing an add-on must not create a subscription',
  );
  assert.match(new URL(page.url()).pathname, /^\/pricing\/?$/);
  await page.locator('[data-team-checkout]').click();
  await page.waitForURL('https://checkout.stripe.com/**');
  assert.deepEqual(checkoutRequestsFor(context).at(-1).selection, {
    plan: 'agency',
    billing: 'annual',
    seats: 2,
    mercurySeats: 2,
    minutePack: 600,
    numberPack: 10,
  });
  await page.goto(base + '/get-started?addon=minutes-600', {
    waitUntil: 'networkidle',
  });
  await page.waitForURL(
    (url) =>
      /^\/pricing\/?$/.test(url.pathname) &&
      url.searchParams.get('addon') === 'minutes-600' &&
      url.hash === '#team-planner',
  );
  assert.equal(await page.locator('[data-team-minutes]').inputValue(), '600');
  assert.equal(checkoutRequestsFor(context).length, beforeAddons + 1);
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  emit({
    flow: 'explicit pricing add-ons then direct hosted checkout',
    noPurchaseOnSelection: true,
    combinedSelection: true,
    legacyAddonSelection: true,
    passed: true,
  });
  // Simulated provider proof: no real Checkout session or payment is created here.
  const payloads = [];
  let checkoutAttempt = 0;
  await page.route(
    'https://calls.consuelohq.com/v1/public/billing/checkout',
    async (route) => {
      try {
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': base,
              'access-control-allow-credentials': 'true',
              'access-control-allow-methods': 'POST',
              'access-control-allow-headers': 'content-type',
            },
          });
        payloads.push(route.request().postDataJSON());
        checkoutAttempt++;
        return route.fulfill({
          status: checkoutAttempt === 1 ? 503 : 200,
          headers: {
            'access-control-allow-origin': base,
            'access-control-allow-credentials': 'true',
          },
          contentType: 'application/json',
          body: JSON.stringify(
            checkoutAttempt === 1
              ? { error: { code: 'CHECKOUT_UNAVAILABLE' } }
              : {
                  id: payloads.at(-1).requestId,
                  url:
                    checkoutAttempt === 2
                      ? 'https://evil.test/checkout'
                      : 'https://checkout.stripe.com/c/pay/cs_fixture',
                },
          ),
        });
      } catch (cause) {
        if (cause instanceof Error) throw cause;
        throw new Error(String(cause));
      }
    },
  );
  await page.route('https://checkout.stripe.com/c/pay/cs_fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Simulated Stripe Checkout</title><h1>Fixture checkout</h1>',
    }),
  );
  const purchaseUrl =
    base + '/get-started?plan=agency&billing=annual&seats=2&addon=mercury';
  await page.goto(purchaseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() =>
    document
      .querySelector('[data-checkout-status]')
      .textContent.includes('could not open'),
  );
  assert.equal(
    await page.getByRole('combobox').count(),
    0,
    'There is no intermediate configuration form',
  );
  await page.locator('[data-retry-checkout]').click();
  await page.waitForFunction(() =>
    document
      .querySelector('[data-checkout-status]')
      .textContent.includes('could not open'),
  );
  assert.equal(new URL(page.url()).origin, base);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForURL('https://checkout.stripe.com/c/pay/cs_fixture');
  assert.equal(payloads.length, 3);
  for (const payload of payloads) {
    assert.equal(payload.requestId, payloads[0].requestId);
    assert.equal(payload.claimToken, payloads[0].claimToken);
    assert.equal(payload.claimToken.length, 43);
    assert.deepEqual(payload.selection, {
      plan: 'agency',
      billing: 'annual',
      seats: 2,
      mercurySeats: 2,
      minutePack: 0,
      numberPack: 0,
    });
    assert.equal('price' in payload, false);
  }
  let paid = false;
  await page.route(
    'https://calls.consuelohq.com/v1/public/billing/purchase/*',
    async (route) => {
      try {
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': base,
              'access-control-allow-headers': 'x-purchase-claim',
              'access-control-allow-methods': 'GET',
            },
          });
        assert.equal(
          route.request().headers()['x-purchase-claim'],
          payloads[0].claimToken,
        );
        return route.fulfill({
          headers: { 'access-control-allow-origin': base },
          contentType: 'application/json',
          body: JSON.stringify({
            paid,
            status: paid ? 'active' : 'pending',
            claimed: false,
            installUrl: paid
              ? 'https://marketplace.leadconnectorhq.com/oauth/chooselocation?fixture=true'
              : null,
          }),
        });
      } catch (cause) {
        if (cause instanceof Error) throw cause;
        throw new Error(String(cause));
      }
    },
  );
  await page.goto(base + '/get-started?purchase=' + payloads[0].requestId, {
    waitUntil: 'networkidle',
  });
  assert.match(
    await page.locator('[data-purchase-status]').innerText(),
    /not confirmed/,
  );
  assert.equal(await page.locator('[data-purchase-ready]').isVisible(), false);
  paid = true;
  await page.locator('[data-retry-purchase]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-purchase-status]').textContent ===
      'Payment confirmed.',
  );
  assert.equal(
    await page.locator('[data-purchase-code]').inputValue(),
    payloads[0].requestId + '.' + payloads[0].claimToken,
  );
  assert.equal(new URL(page.url()).searchParams.has('claimToken'), false);
  assert.match(
    await page.locator('[data-connect-ghl]').getAttribute('href'),
    /^https:\/\/marketplace.leadconnectorhq.com/,
  );
  emit({
    flow: 'simulated Stripe checkout and pay-first confirmation',
    retryIdentity: 'preserved',
    maliciousRedirect: 'rejected',
    unpaidActivation: 'rejected',
    passed: true,
  });
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  await page.mouse.move(0, 0);
  await page.locator('[data-logo-carousel]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    document
      .querySelector('[data-logo-track]')
      .getAnimations()
      .some((a) => a.playState === 'running'),
  );
  const before = await page
    .locator('[data-logo-track]')
    .evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(120);
  assert.notEqual(
    await page
      .locator('[data-logo-track]')
      .evaluate((el) => getComputedStyle(el).transform),
    before,
  );
  await page.locator('[data-logo-carousel]').hover();
  assert.equal(
    await page
      .locator('[data-logo-track]')
      .evaluate((el) => el.getAnimations()[0].playState),
    'paused',
  );
  await page.getByRole('button', { name: 'Pause logos', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: 'Play logos', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-logo-track]').getAnimations().length === 0,
  );
  await page.goto(base + '/#faq', { waitUntil: 'networkidle' });
  const homeQuestion = page
    .locator('#faq [data-home-faq-item] summary')
    .first();
  await page.evaluate(() => getSelection().removeAllRanges());
  await homeQuestion.locator('span').first().dblclick();
  assert.equal(
    await page.evaluate(() => getSelection().toString()),
    '',
    'Home FAQ headings do not select on double click',
  );
  await page.keyboard.press('Tab');
  await homeQuestion.focus();
  assert.equal(
    await homeQuestion.evaluate((el) => getComputedStyle(el).outlineStyle),
    'none',
  );
  assert.ok(
    await homeQuestion.evaluate((el) =>
      getComputedStyle(el).textDecorationLine.includes('underline'),
    ),
  );
  await page.keyboard.press('Space');
  assert.equal(
    await homeQuestion.evaluate((el) => el.parentElement.open),
    true,
  );
  emit({ flow: 'home FAQ pointer and keyboard disclosure', passed: true });
  await context.close();
  for (const width of [375, 1440]) {
    const nativeContext = await newCheckoutFixtureContext(browser, {
      viewport: { width, height: 900 },
    });
    const nativePage = await nativeContext.newPage();
    const nativeId = 'a9111111-1111-4111-8111-111111111111',
      nativeToken = 'A'.repeat(43);
    const stripeNumberUrl =
      'https://billing.stripe.com/p/session/native-number-fixture';
    let nativeResult = {
      paid: true,
      status: 'active',
      claimed: false,
      allSelectedPaid: false,
      paymentPending: false,
      nextPortalUrl: stripeNumberUrl,
      installUrl:
        'https://marketplace.leadconnectorhq.com/oauth/chooselocation?fixture=true',
    };
    let numberPosts = 0;
    await nativeContext.addInitScript(
      ({ id, token }) => {
        sessionStorage.setItem(
          'consuelo-checkout:' + id,
          JSON.stringify({
            id,
            claimToken: token,
            key: JSON.stringify({
              plan: 'agency',
              billing: 'annual',
              seats: 2,
              mercurySeats: 2,
              minutePack: 600,
              numberPack: 10,
            }),
          }),
        );
      },
      { id: nativeId, token: nativeToken },
    );
    await nativeContext.route(
      'https://calls.consuelohq.com/v1/public/billing/purchase/**',
      async (route) => {
        try {
          const headers = {
            'access-control-allow-origin': base,
            'access-control-allow-headers': 'x-purchase-claim',
            'access-control-allow-methods': 'GET,POST,OPTIONS',
          };
          if (route.request().method() === 'OPTIONS')
            return route.fulfill({ status: 204, headers });
          assert.equal(
            route.request().headers()['x-purchase-claim'],
            nativeToken,
          );
          const numbers = route.request().url().endsWith('/numbers');
          if (numbers) {
            assert.equal(route.request().method(), 'POST');
            numberPosts++;
          }
          return route.fulfill({
            headers,
            contentType: 'application/json',
            body: JSON.stringify(
              numbers
                ? { id: 'bps_fixture', url: stripeNumberUrl }
                : nativeResult,
            ),
          });
        } catch (cause) {
          if (cause instanceof Error) throw cause;
          throw new Error(String(cause));
        }
      },
    );
    await nativeContext.route(stripeNumberUrl, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<h1>Native Stripe number confirmation fixture</h1>',
      }),
    );
    await nativePage.goto(base + '/get-started?purchase=' + nativeId, {
      waitUntil: 'networkidle',
    });
    await nativePage.waitForURL(stripeNumberUrl);
    assert.equal(
      numberPosts,
      0,
      'Initial handoff uses only the verified server-issued portal URL',
    );
    await nativePage.goto(
      base + '/get-started?purchase=' + nativeId + '&checkout=cancelled',
      { waitUntil: 'networkidle' },
    );
    assert.equal(
      new URL(nativePage.url()).origin,
      base,
      'Cancellation never creates another checkout',
    );
    assert.equal(
      await nativePage.locator('[data-number-confirmation]').isVisible(),
      true,
    );
    assert.equal(
      await nativePage.locator('[data-purchase-ready]').isVisible(),
      true,
      'Paid base can connect while number confirmation remains optional',
    );
    assert.equal(
      await nativePage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await nativePage.screenshot({
      path: join(artifacts, 'native-partial-' + width + '.png'),
      animations: 'disabled',
    });
    nativeResult.claimed = true;
    await nativePage.locator('[data-retry-purchase]').click();
    await nativePage.waitForFunction(() =>
      document
        .querySelector('[data-purchase-status]')
        .textContent.includes('finish the number pack'),
    );
    assert.ok(
      await nativePage.evaluate(
        (id) => sessionStorage.getItem('consuelo-checkout:' + id),
        nativeId,
      ),
      'A claimed partial purchase retains its private recovery',
    );
    await nativePage.locator('[data-confirm-numbers]').click();
    await nativePage.waitForURL(stripeNumberUrl);
    assert.equal(numberPosts, 1);
    nativeResult = {
      ...nativeResult,
      allSelectedPaid: true,
      nextPortalUrl: null,
    };
    await nativePage.goto(
      base + '/get-started?purchase=' + nativeId + '&numbers=done',
      { waitUntil: 'networkidle' },
    );
    assert.equal(
      await nativePage.evaluate(
        (id) => sessionStorage.getItem('consuelo-checkout:' + id),
        nativeId,
      ),
      null,
      'Recovery is cleared only after claim and full completion',
    );
    nativeResult = {
      ...nativeResult,
      claimed: false,
      allSelectedPaid: false,
      paymentPending: true,
    };
    await nativePage.goto(
      base + '/get-started?purchase=' + nativeId + '&numbers=done',
      { waitUntil: 'networkidle' },
    );
    assert.equal(
      await nativePage.locator('[data-confirm-numbers]').isDisabled(),
      true,
    );
    nativeResult = {
      ...nativeResult,
      paymentPending: false,
      nextPortalUrl: 'https://evil.test/',
    };
    await nativePage.locator('[data-retry-purchase]').click();
    await nativePage.waitForFunction(() =>
      document
        .querySelector('[data-purchase-status]')
        .textContent.includes('temporarily unavailable'),
    );
    assert.equal(
      new URL(nativePage.url()).origin,
      base,
      'Hostile provider destinations are refused',
    );
    emit({
      flow: 'native Stripe partial payment, one-time handoff, canceled return, claimed partial recovery, duplicate-payment prevention and hostile URL',
      width,
      passed: true,
    });
    await nativeContext.close();
  }
  const nojs = await newCheckoutFixtureContext(browser, {
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const staticPage = await nojs.newPage();
  await staticPage.goto(base + '/pricing', { waitUntil: 'networkidle' });
  assert.equal(await staticPage.locator('[data-plan-code]').count(), 4);
  assert.equal(
    await staticPage
      .locator('.comparison-scroll .comparison-column-head')
      .isVisible(),
    true,
  );
  assert.equal(
    await staticPage.locator('[data-comparison-controls]').isVisible(),
    false,
  );
  await staticPage
    .locator('[data-comparison-group="integrations"]>summary')
    .click();
  assert.equal(
    await staticPage.locator('[data-feature-row="ghl"]').isVisible(),
    true,
  );
  await nojs.close();
  emit({
    flow: 'billing / teams / comparisons / FAQ / setup',
    keyboard: 'pass',
    noJavaScript: 'pass',
    artifacts,
  });
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  emit({ cleanup: 'complete' });
}
