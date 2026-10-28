import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { launchDocumentationBrowser, stopDocumentationServer } from './lib/documentation-browser-test.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.DOCS_TEST_PORT ?? 4397);
const origin = 'http://127.0.0.1:' + port;
const evidence = process.env.DOCS_EVIDENCE_DIR ?? resolve(tmpdir(), 'consuelo-dialer-docs-' + process.pid);
mkdirSync(evidence, { recursive: true });
assert.ok(existsSync(resolve(root, 'dist/client/index.html')), 'Build before browser checks');
const server = spawn('node', [resolve(root, 'node_modules/astro/bin/astro.mjs'), 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output = (output + chunk).slice(-10000); });
server.stderr.on('data', (chunk) => { output = (output + chunk).slice(-10000); });
let browser;
const errors = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Preview server unavailable: ' + output);
  browser = await launchDocumentationBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /Consuelo Dialer/);
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.locator('#starlight__sidebar .global-sidebar-desktop a.global-section-link').count(), 8);
  assert.equal(await page.getByRole('link', { name: 'Consuelo Dialer docs', exact: true }).getAttribute('href'), '/');
  assert.equal(await page.locator('.docs-home-actions a').first().getAttribute('href'), '/start/');
  assert.equal(await page.locator('[data-home-install-command]').count(), 0);
  await page.screenshot({ path: resolve(evidence, 'home-light.png'), fullPage: true });
  const header = page.getByRole('banner');
  for (const [label, value] of [['Use light appearance', 'light'], ['Use dark appearance', 'dark']]) {
    await header.getByRole('button', { name: label, exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), value);
    if (value === 'dark') await page.screenshot({ path: resolve(evidence, 'home-dark.png'), fullPage: true });
  }
  await header.getByRole('button', { name: 'Use system appearance', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('starlight-theme')), null);

  // Production Pagefind results must use the new content, not the inherited OS index.
  await page.getByRole('button', { name: /Search/ }).first().click();
  const search = page.locator('dialog input').first();
  await search.fill('local presence');
  const result = page.locator('dialog a[href*="/outbound/local-presence"]').first();
  await result.waitFor({ state: 'visible', timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.goto(origin + '/outbound/local-presence/', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('h1').textContent(), 'Local presence');
  const markdown = await context.request.get(origin + '/outbound/local-presence.md');
  assert.equal(markdown.status(), 200);
  assert.match(await markdown.text(), /^# Local presence/);
  await page.getByRole('button', { name: 'Copy page', exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('.page-actions')?.getAttribute('data-copy-state') === 'success');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^# Local presence/);
  await page.getByLabel('More page actions', { exact: true }).click();
  assert.equal(await page.getByRole('link', { name: /View as Markdown/ }).getAttribute('href'), '/outbound/local-presence.md');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.page-actions details').getAttribute('open'), null);

  const viewports = [
    ['phone-small', 320, 568], ['phone', 390, 844], ['landscape-small', 568, 320],
    ['landscape', 667, 375], ['tablet', 768, 1024], ['tablet-wide', 1024, 768],
    ['desktop', 1440, 1000],
  ];
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/inbound/readiness/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').textContent(), 'Go ready for inbound calls');
    const bounds = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(bounds.scroll <= bounds.client + 1, name + ' horizontal overflow: ' + JSON.stringify(bounds));
    if (width < 1152) {
      const toggle = page.getByRole('button', { name: 'Open docs menu', exact: true });
      await toggle.click();
      await page.getByRole('button', { name: 'Close docs menu', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-docs-menu-toggle]').getAttribute('aria-expanded'), 'true');
      assert.ok(await page.locator('#starlight__sidebar').isVisible());
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('[data-docs-menu-toggle]')?.getAttribute('aria-expanded') === 'false');
    }
    await page.screenshot({ path: resolve(evidence, name + '.png'), fullPage: name === 'desktop' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/start/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open Dialer menu', exact: true }).click();
  await page.locator('[data-docs-browse-overlay]').waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('link', { name: 'Open GoHighLevel', exact: true }).getAttribute('href'), 'https://app.gohighlevel.com/');
  assert.equal(await page.getByRole('link', { name: 'Get started', exact: true }).last().getAttribute('href'), '/start/');
  await page.keyboard.press('Escape');
  await page.locator('[data-docs-browse-overlay]').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);

  const sources = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.mdx?$/.test(path) ? [path] : [];
  });
  for (const file of sources(resolve(root, 'src/content/docs'))) {
    const slug = file.slice(resolve(root, 'src/content/docs').length + 1).replace(/\.mdx?$/, '').replace(/\/index$/, '');
    if (slug === '404') continue;
    const route = slug === 'index' ? '/' : '/' + slug + '/';
    const response = await context.request.get(origin + route);
    assert.equal(response.status(), 200, route);
    assert.match(await response.text(), /Consuelo Dialer/);
    const md = await context.request.get(origin + '/' + slug + '.md');
    assert.equal(md.status(), 200, slug + ' Markdown');
  }
  const absent = await context.request.get(origin + '/start/install-consuelo-os/');
  assert.equal(absent.status(), 404, 'An inherited OS page must not resolve');
  const badTranslation = await context.request.get(origin + '/api/docs/translate?path=%2Fmissing%2F&lang=es');
  assert.equal(badTranslation.status(), 404, 'Unknown source cannot translate');

  const spanish = await browser.newContext({ locale: 'es-ES', viewport: { width: 390, height: 844 } });
  let translatedPath;
  await spanish.route('**/api/docs/translate?**', async (route) => {
    translatedPath = new URL(route.request().url()).searchParams.get('path');
    await route.fulfill({ json: { ok: true, cached: false, provider: 'passthrough', sourceLanguage: 'en', targetLanguage: 'es', route: '/start/', title: 'Guía para empezar', segments: ['Traducción de prueba.'] } });
  });
  const translatedPage = await spanish.newPage();
  await translatedPage.goto(origin + '/start/', { waitUntil: 'networkidle' });
  await translatedPage.locator('[data-docs-runtime-translation-panel]').waitFor({ state: 'visible' });
  assert.equal(translatedPath, '/start/');
  assert.equal(await translatedPage.locator('html').getAttribute('lang'), 'es');
  assert.match(await translatedPage.locator('[data-docs-runtime-translation-panel]').textContent(), /Guía para empezar/);
  await spanish.close();

  // Safari/WebKit receives the same responsive layout if the engine is installed.
  if (existsSync(webkit.executablePath())) {
    const safari = await webkit.launch({ headless: true });
    try {
      const tab = await safari.newPage({ viewport: { width: 667, height: 375 } });
      await tab.goto(origin + '/inbound/', { waitUntil: 'networkidle' });
      assert.equal(await tab.locator('h1').textContent(), 'Inbound calling');
      await tab.getByRole('button', { name: 'Open docs menu', exact: true }).click();
      assert.equal(await tab.locator('[data-docs-menu-toggle]').getAttribute('aria-expanded'), 'true');
      await tab.screenshot({ path: resolve(evidence, 'webkit-landscape.png') });
    } finally { await safari.close(); }
    process.stdout.write('WebKit short-landscape passed.\n');
  } else {
    process.stdout.write('WebKit not installed; Chromium matrix completed.\n');
  }
  process.stdout.write(JSON.stringify({ ok: true, pages: 30, viewports: viewports.length, evidence, checks: ['search', 'themes', 'clipboard', 'Markdown', 'menus', 'all routes', 'translation boundary'] }) + '\n');
} catch (error) {
  if (browser) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    if (pages[0]) await pages[0].screenshot({ path: resolve(evidence, 'failure.png') }).catch(() => {});
  }
  process.stderr.write('Browser evidence: ' + evidence + '\n');
  process.stderr.write('Server output: ' + output.slice(-3500) + '\n');
  throw error;
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
