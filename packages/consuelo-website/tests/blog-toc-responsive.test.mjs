import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const ARTICLE_PATH = '/blog/software-is-becoming-decision-infrastructure/';

const getOpenPort = () =>
  new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
          return;
        }

        reject(new Error('Unable to resolve open port'));
      });
    });
  });

const waitForServer = async (url) => {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
};

const startDevServer = async () => {
  const port = await getOpenPort();
  const baseUrl = `http://${HOST}:${port}`;
  const server = spawn(
    'bun',
    ['run', 'dev', '--', '--host', HOST, '--port', String(port)],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  let output = '';
  server.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const exitPromise = once(server, 'exit').then(([code]) => {
    throw new Error(`Astro dev server exited with code ${code}.\n${output}`);
  });

  await Promise.race([waitForServer(baseUrl), exitPromise]);

  return {
    baseUrl,
    stop: async () => {
      if (server.exitCode !== null || server.signalCode !== null) return;

      server.kill('SIGTERM');
      await Promise.race([
        once(server, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);

      if (server.exitCode === null && server.signalCode === null) {
        server.kill('SIGKILL');
      }
    },
  };
};

const readTocLayout = (page) =>
  page.locator('[data-article-toc]').evaluate((toc) => {
    const scroller = toc.querySelector('[data-toc-scroller]');
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('Expected TOC scroller');
    }

    const style = getComputedStyle(toc);
    const scrollerStyle = getComputedStyle(scroller);

    return {
      position: style.position,
      right: style.right,
      overflowX: scrollerStyle.overflowX,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

test('blog navigation, footer, browser chrome, and responsive TOC work across breakpoints', async () => {
  const server = await startDevServer();
  const browser = await chromium.launch();

  try {
    const indexPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await indexPage.goto(`${server.baseUrl}/blog/`, {
      waitUntil: 'networkidle',
    });

    const osLink = indexPage.locator(
      '#menu-items a[aria-label="Consuelo OS home"]',
    );
    assert.equal(await osLink.getAttribute('href'), '/');
    assert.equal(
      await indexPage.locator('footer a[aria-label="RSS Feed"]').isVisible(),
      true,
    );
    assert.equal(
      await indexPage
        .locator('footer a[aria-label*="Discord"]')
        .getAttribute('href'),
      'https://discord.gg/87YtkVUBvc',
    );

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await mobile.goto(`${server.baseUrl}${ARTICLE_PATH}`, {
      waitUntil: 'networkidle',
    });

    assert.equal(
      await mobile.locator('meta[name="color-scheme"]').getAttribute('content'),
      'dark',
    );
    const themeColors = await mobile
      .locator('meta[name="theme-color"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('content')),
      );
    assert.deepEqual(themeColors, ['#000000', '#000000']);

    const utilityAlignment = await mobile
      .locator('#post-utility-nav')
      .evaluate((nav) => {
        const home = nav.querySelector('#back-button');
        const language = nav.querySelector('.language-selector__button');
        if (
          !(home instanceof HTMLElement) ||
          !(language instanceof HTMLElement)
        ) {
          throw new Error('Expected Home and language controls');
        }

        const homeBox = home.getBoundingClientRect();
        const languageBox = language.getBoundingClientRect();
        return {
          homeText: home.textContent?.trim(),
          centerDelta: Math.abs(
            homeBox.top +
              homeBox.height / 2 -
              (languageBox.top + languageBox.height / 2),
          ),
        };
      });
    assert.equal(utilityAlignment.homeText, 'Home');
    assert.ok(utilityAlignment.centerDelta <= 2);

    assert.equal(
      await mobile
        .locator('[data-article-toc] .article-toc__title')
        .innerText(),
      'Table of Contents',
    );
    assert.equal(await mobile.locator('[data-toc-link]').count(), 8);
    const mobileLayout = await readTocLayout(mobile);
    assert.equal(mobileLayout.position, 'sticky');
    assert.equal(mobileLayout.overflowX, 'auto');
    assert.ok(mobileLayout.scrollWidth > mobileLayout.clientWidth);
    assert.equal(mobileLayout.pageOverflow, 0);

    const analyticsLink = mobile.locator('[data-toc-link]', {
      hasText: 'Analytics are the evidence layer',
    });
    await analyticsLink.click();
    await mobile.waitForFunction(
      () => location.hash === '#analytics-are-the-evidence-layer',
    );
    assert.equal(await analyticsLink.getAttribute('aria-current'), 'location');
    await mobile.waitForTimeout(900);
    const analyticsTop = await mobile
      .locator('#analytics-are-the-evidence-layer')
      .evaluate((heading) => heading.getBoundingClientRect().top);
    assert.ok(analyticsTop >= 0 && analyticsTop < 240);

    const tablet = await browser.newPage({
      viewport: { width: 1366, height: 1024 },
    });
    await tablet.goto(`${server.baseUrl}${ARTICLE_PATH}`, {
      waitUntil: 'networkidle',
    });
    const tabletLayout = await readTocLayout(tablet);
    assert.equal(tabletLayout.position, 'sticky');
    assert.equal(tabletLayout.overflowX, 'auto');
    assert.equal(tabletLayout.pageOverflow, 0);

    const desktop = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await desktop.goto(`${server.baseUrl}${ARTICLE_PATH}`, {
      waitUntil: 'networkidle',
    });
    const desktopLayout = await readTocLayout(desktop);
    assert.equal(desktopLayout.position, 'fixed');
    assert.notEqual(desktopLayout.right, 'auto');
    assert.equal(desktopLayout.pageOverflow, 0);

    const futureLink = desktop.locator('[data-toc-link]', {
      hasText: 'The future interface is what should we do next?',
    });
    const beforeHover = await futureLink
      .locator('.article-toc__label')
      .evaluate((label) => ({
        opacity: Number.parseFloat(getComputedStyle(label).opacity),
        maxWidth: Number.parseFloat(getComputedStyle(label).maxWidth),
      }));
    await futureLink.hover();
    await desktop.waitForTimeout(260);
    const afterHover = await futureLink
      .locator('.article-toc__label')
      .evaluate((label) => ({
        opacity: Number.parseFloat(getComputedStyle(label).opacity),
        maxWidth: Number.parseFloat(getComputedStyle(label).maxWidth),
      }));
    assert.ok(afterHover.opacity > beforeHover.opacity);
    assert.ok(afterHover.maxWidth > beforeHover.maxWidth);
  } finally {
    await browser.close();
    await server.stop();
  }
});
