import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
    const context = await browser.newContext({
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
    const overflowEvidence = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth, elements:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1&&!el.closest('.comparison-scroll,.technology-strip')}).slice(0,20).map(el=>({tag:el.tagName,classes:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));
    if(overflowEvidence.scroll>width+1){emit({overflowEvidence});emit(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.scrollWidth>e.clientWidth+50).slice(0,30).map(e=>({tag:e.tagName,classes:e.className,client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflow,position:getComputedStyle(e).position,text:e.textContent.slice(0,50)}))));await page.screenshot({path:join(artifacts,'overflow.png')});}
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
    await page.getByLabel('Annual', { exact: true }).check();
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
    await page.getByLabel('Monthly', { exact: true }).check();
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
    const faq = page.locator('#pricing-faq [data-home-faq-item]');
    await faq.nth(0).locator('summary').click();
    await faq.nth(1).locator('summary').click();
    await page.waitForFunction(
      () => !document.querySelector('#pricing-faq [data-home-faq-item]').open,
    );
    assert.equal(await faq.nth(1).getAttribute('open'), '');
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
    assert.deepEqual(errors, [], 'Browser errors ' + width + 'x' + height);
    await page.evaluate(() => window.scrollTo(0, 0));
    if ([375, 568, 1440].includes(width))
      await page.screenshot({
        path: join(artifacts, 'pricing-' + width + 'x' + height + '.png'),
        fullPage: true,
      });
    if([375,1440].includes(width))await page.screenshot({path:join(artifacts,'pricing-top-'+width+'.png')});
    emit({ viewport: width + 'x' + height, passed: true });
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  await page.getByLabel('Annual', { exact: true }).check();
  await page.locator('[data-plan-code="agency"] [data-plan-cta]').click();
  await page.waitForFunction(() =>
    document
      .querySelector('[data-selected-plan]')
      .textContent.includes('Agency'),
  );
  assert.match(
    await page.locator('[data-selected-plan]').innerText(),
    /\$149.*\$1,788.*annually/,
  );
  for (const bad of ['__proto__', '<img src=x onerror=alert(1)>']) {
    await page.goto(
      base + '/get-started?plan=' + encodeURIComponent(bad) + '&billing=annual',
      { waitUntil: 'networkidle' },
    );
    assert.match(
      await page.locator('[data-selected-plan]').innerText(),
      /^Tell us/,
    );
    assert.equal(await page.locator('img[src="x"]').count(), 0);
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
    assert.match(
      await link.getAttribute('href'),
      /^mailto:support@consuelohq.com\?/,
    );
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    'noindex,nofollow',
  );
  await context.close();
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const staticPage = await nojs.newPage();
  await staticPage.goto(base + '/pricing', { waitUntil: 'networkidle' });
  assert.equal(await staticPage.locator('[data-plan-code]').count(), 4);
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
