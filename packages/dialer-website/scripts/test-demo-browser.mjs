import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const artifacts = process.env.DIALER_DEMO_ARTIFACT_DIR || '/tmp/consuelo-dialer-interactive-demo';
mkdirSync(artifacts, { recursive: true });
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};
const server = createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400).end(); return; }
  let path = resolve(dist, '.' + url);
  if (path !== dist && !path.startsWith(dist + '/')) { res.writeHead(403).end(); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const exec =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((path) => existsSync(path));
let browser;
const emit = (data) => process.stdout.write(JSON.stringify(data) + '\n');
try {
  browser = await chromium.launch({ executablePath: exec });
  const sizes = process.argv.includes('--smoke')
    ? [[1440, 900]]
    : [[375, 812], [768, 1024], [1440, 900]];
  for (const [width, height] of sizes) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    const frameRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
    });
    page.on('request', (request) => {
      if (request.frame() !== page.mainFrame()) frameRequests.push(request.url());
    });
    await page.goto(base + '/demo/', { waitUntil: 'networkidle' });
    const frame = page.frameLocator('#consuelo-demo-frame');
    await frame.locator('[data-demo-dialer] .calling-workspace').waitFor({ state: 'visible' });
    const initial = await frame.locator('[data-demo-dialer]').innerText();
    assert.match(initial, /Outbound calls/);
    assert.match(initial, /Choose list/);
    assert.equal(await frame.locator('[data-action="start-configured"]').isEnabled(), true);
    assert.equal(await page.locator('#consuelo-demo-frame').getAttribute('src'), '/demo/workspace/');
    assert.equal(
      await frame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content').then((x) => x.includes("connect-src 'none'")),
      true,
    );
    const dimensions = await page.evaluate(() => ({
      windowWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(dimensions.documentWidth <= dimensions.windowWidth + 1, 'Outer page overflow at ' + width);
    const innerOverflow = await frame.locator('html').evaluate((el) => el.scrollWidth > innerWidth + 1);
    assert.equal(innerOverflow, false, 'Embedded widget overflow at ' + width);
    if (width === 1440 || width === 375)
      await page.screenshot({ path: join(artifacts, 'initial-' + width + '.png'), fullPage: width === 1440 });

    // Full outbound sales flow, source-derived renderer and reducer.
    await frame.locator('[data-action="start-configured"]').click();
    await frame.getByText(/Calling 3 people/).waitFor({ timeout: 7000 });
    await frame.locator('[data-session-status]').getByText(/On a call/).waitFor({ timeout: 8000 });
    assert.match(await page.locator('[data-demo-title]').innerText(), /A person picked up/);
    if (width === 1440 || width === 375)
      await page.screenshot({ path: join(artifacts, 'connected-' + width + '.png') });
    await frame.locator('[data-action="script-next"]').click();
    await frame.locator('[data-action="hang-up"]').click();
    await frame.locator('[data-form="disposition"]').waitFor();
    await frame.locator('select[name="disposition"]').selectOption('follow-up');
    await frame.locator('textarea[name="note"]').fill('Send coverage options and schedule a review.');
    await frame.locator('[data-form="disposition"] button[type="submit"]').click();
    await frame.getByText('Call history', { exact: true }).first().waitFor();
    assert.equal(await frame.locator('[data-action="select-call"]').count() >= 2, true);
    assert.match(await frame.locator('[data-demo-crm-outcome]').innerText(), /follow-up/i);
    await page.getByText('The call is handled.', { exact: true }).waitFor();
    if (width === 1440) await page.screenshot({ path: join(artifacts, 'history-' + width + '.png') });

    // Incoming routing with browser answering and wrap-up.
    await page.locator('[data-demo-flow="inbound"]').click();
    await frame.locator('[data-action="inbound-readiness"]').click();
    await frame.locator('[data-action="inbound-accept"]').waitFor({ timeout: 8000 });
    assert.match(await page.locator('[data-demo-title]').innerText(), /right rep/);
    await frame.locator('[data-action="inbound-accept"]').click();
    await frame.locator('[data-action="inbound-hang-up"]').waitFor();
    await page.getByText('Pick up and get to work.', { exact: true }).waitFor();
    await frame.locator('[data-action="inbound-hang-up"]').click();
    await frame.locator('[data-form="inbound-wrap-up"]').waitFor();
    await frame.locator('[data-form="inbound-wrap-up"] button[type=submit]').click();
    await frame.getByText('Call history', { exact: true }).first().waitFor();
    assert.match(await frame.locator('[data-demo-crm-outcome]').innerText(), /connected/i);
    if (width === 1440) await page.screenshot({ path: join(artifacts, 'inbound-saved-' + width + '.png') });

    // Mercury script mode and reset.
    await page.locator('[data-demo-flow="mercury"]').click();
    await frame.getByText('Scripts for your calling day.').waitFor();
    await frame.locator('[data-action="script-open"]').click();
    await frame.locator('.script-reader').waitFor();
    assert.match(await frame.locator('.script-reader').innerText(), /Northstar Insurance/);
    await page.locator('[data-demo-reset]').click();
    await frame.getByText('Scripts for your calling day.').waitFor();
    await page.locator('[data-demo-flow="outbound"]').click();
    await frame.locator('[data-action="start-configured"]').waitFor();
    await frame.locator('[data-action="workspace-call-options"]').click();
    await frame.locator('[data-combobox-field="line-count"] .combobox__trigger').click();
    await frame.locator('[data-combobox-field="line-count"] .combobox__option')
      .filter({ hasText: '2 lines' }).click();
    await frame.getByRole('button', { name: 'Done', exact: true }).click();
    await frame.locator('[data-action="start-configured"]').click();
    await frame.getByText('Calling 2 people').waitFor({ timeout: 7000 });

    assert.deepEqual(errors, [], 'Browser/runtime errors');
    assert.ok(frameRequests.every((url) => url.startsWith(base)), 'Embedded demo requested external resources');
    emit({ width, height, result: 'passed', frameRequests: frameRequests.length, screenshots: artifacts });
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
