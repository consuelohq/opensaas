import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const website = process.env.OS_WEBSITE_TEST_ORIGIN || 'https://consuelo-os-website-preview.kokayi-90b.workers.dev';
const docs = process.env.OS_DOCS_TEST_ORIGIN || 'https://consuelo-os-docs-preview.kokayi-90b.workers.dev';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath });
const artifactRoot = process.env.PUBLIC_MOUNT_ARTIFACT_DIR || '/tmp/consuelo-public-mount-browser';
mkdirSync(artifactRoot, { recursive: true });
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 960 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', userAgent: 'Consuelo-cutover-browser/1' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if ((r.url().startsWith(website + '/') || r.url().startsWith(docs + '/')) && r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    for (const route of ['/about/', '/about/pricing/', '/about/blog/']) {
      const response = await page.goto(website + route, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.locator('img').evaluateAll(images => images.forEach(i => i.loading = 'eager'));
      await page.waitForFunction(() => [...document.images].every(i => i.complete));
      assert.match(await page.locator('link[rel=canonical]').getAttribute('href'), /^https:\/\/os\.consuelohq\.com\/about/);
      assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)), []);
      assert.deepEqual(await page.locator('a[href],img[src],video[poster],source[src]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href') || n.getAttribute('src') || n.getAttribute('poster')).filter(v => v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/about/'))), []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await page.goto(website + '/about/blog/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    assert.equal(await page.evaluate(() => sessionStorage.getItem('backUrl')), '/about/');
    await page.locator('a[href^="/about/blog/software-is-becoming-decision-infrastructure"]').first().click();
    await page.waitForURL(/\/about\/blog\/software-is-becoming-decision-infrastructure\/?$/);
    assert.equal(new URL(await page.locator('#back-button').getAttribute('href'), website).pathname, '/about/');
    await page.goto(docs + '/docs/', { waitUntil: 'domcontentloaded' });
    assert.match(await page.title(), /Consuelo OS/);
    await page.goto(docs + '/docs/start/install-consuelo-os/', { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('h1').innerText(), /Install Consuelo OS/);
    assert.deepEqual(await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')).filter(v => v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/docs/'))), []);
    const markdown = await context.request.get(docs + '/docs/start/install-consuelo-os.md');
    assert.equal(markdown.status(), 200);
    assert.match(await markdown.text(), /Install Consuelo OS/);
    if (viewport.width === 1440) {
      await page.getByRole('button', { name: /Search/ }).first().click();
      const input = page.locator('#starlight__search input');
      await input.fill('Install');
      const result = page.locator('.pagefind-ui__result-link').first();
      await result.waitFor();
      assert.match(await result.getAttribute('href'), /\/docs\//);
      await page.keyboard.press('Escape');
    }
    const query = 'user_code=CONSUELO-TEST&state=route-probe&returnTo=%2Fworkspace';
    for (const path of ['/about/login/device', '/about/login/device/']) {
      const redirect = await context.request.get(website + path + '?' + query, { maxRedirects: 0 });
      assert.equal(redirect.status(), 302);
      assert.equal(redirect.headers().location, 'https://os.consuelohq.com/login/device?' + query);
    }
    const rss = await context.request.get(website + '/about/rss.xml');
    assert.equal(rss.status(), 200);
    assert.match(await rss.text(), /<channel>[\s\S]*?<link>https:\/\/os\.consuelohq\.com\/about\/<\/link>/);
    const sitemap = await context.request.get(website + '/about/sitemap-0.xml');
    assert.equal(sitemap.status(), 200);
    assert.equal((await sitemap.text()).includes('/login/device'), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${artifactRoot}/docs-${viewport.width}.png` });
    process.stdout.write(JSON.stringify({ viewport, mountedWebsite: true, mountedDocs: true, search: viewport.width === 1440, errors }) + '\n');
    await context.close();
  }
} finally { await browser.close(); }
