import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';

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
      if (response.ok) {
        return;
      }
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
      if (server.exitCode !== null || server.signalCode !== null) {
        return;
      }

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

test('homepage mobile layout and content follow the launch contract', async () => {
  const server = await startDevServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(server.baseUrl, { waitUntil: 'networkidle' });

    const mobileHeader = page.locator('.os-header__mobile');
    await assert.doesNotReject(() => mobileHeader.waitFor({ state: 'visible' }));
    assert.equal(
      await mobileHeader.locator('a').first().innerText(),
      'CLOUD',
    );
    assert.equal(
      await mobileHeader.locator('a').first().getAttribute('href'),
      'https://os.consuelohq.com',
    );
    assert.equal(
      await mobileHeader.locator('[aria-label="Discord"]').isVisible(),
      true,
    );
    assert.equal(
      await mobileHeader.locator('[aria-label="GitHub"]').isVisible(),
      true,
    );
    const mobileHeaderTypography = await mobileHeader.evaluate((header) => {
      const label = header.querySelector(':scope > a');
      const wordmark = header.querySelector('.os-header__mobile-wordmark');
      const icon = header.querySelector('[aria-label="GitHub"] svg');

      if (!(label && wordmark && icon)) {
        throw new Error('Expected mobile header typography and icon');
      }

      return {
        label: Number.parseFloat(getComputedStyle(label).fontSize),
        wordmark: Number.parseFloat(getComputedStyle(wordmark).fontSize),
        iconWidth: icon.getBoundingClientRect().width,
      };
    });
    assert.ok(mobileHeaderTypography.label >= 12);
    assert.ok(mobileHeaderTypography.wordmark >= 19);
    assert.ok(mobileHeaderTypography.iconWidth >= 16);

    const heading = page.locator('.os-hero h1');
    assert.equal(
      (await heading.innerText()).replace(/\s+/g, ' ').trim(),
      'YOUR WORKSPACE, CONNECTED TO EVERY AGENT',
    );
    const headingLineTops = await heading.locator('[data-hero-line]').evaluateAll(
      (lines) =>
        lines.map((line) => Math.round(line.getBoundingClientRect().top)),
    );
    assert.equal(new Set(headingLineTops).size, 3);

    const viewportContract = await page.evaluate(() => {
      const hero = document.querySelector('.os-hero');
      const features = document.querySelector('.product-panel');

      if (!(hero instanceof HTMLElement) || !(features instanceof HTMLElement)) {
        throw new Error('Expected homepage hero and features');
      }

      return {
        viewportHeight: window.innerHeight,
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        heroBottom: hero.getBoundingClientRect().bottom,
        featuresTop: features.getBoundingClientRect().top,
      };
    });

    assert.equal(viewportContract.horizontalOverflow, 0);
    assert.ok(viewportContract.heroBottom <= viewportContract.viewportHeight - 24);
    assert.ok(viewportContract.heroBottom >= viewportContract.viewportHeight - 110);
    assert.ok(viewportContract.featuresTop < viewportContract.viewportHeight);
    assert.ok(viewportContract.featuresTop > viewportContract.heroBottom);
    assert.equal(
      await page.locator('.os-hero__art').getAttribute('src'),
      '/images/home/consuelo-atmosphere.svg',
    );
    assert.equal(await page.locator('.os-hero__button svg').count(), 1);
    assert.equal(
      await page.locator('.product-panel__preview-art').getAttribute('src'),
      '/images/home/consuelo-transition.svg',
    );

    assert.equal(
      await page.locator('.product-panel__topline').count(),
      0,
    );

    const featureHeading = page.locator('.product-panel__features > h2');
    const featureHeadingBox = await featureHeading.boundingBox();
    assert.ok(featureHeadingBox);
    assert.ok(featureHeadingBox.x >= 12);
    assert.ok(featureHeadingBox.x + featureHeadingBox.width <= 378);

    const featureColors = await page
      .locator('.product-panel__item')
      .first()
      .evaluate((item) => {
        const number = item.querySelector('.product-panel__index-number');
        const label = item.querySelector('.product-panel__index-label');
        const description = item.querySelector('.product-panel__description');

        if (!(number && label && description)) {
          throw new Error('Expected feature label elements');
        }

        return {
          number: getComputedStyle(number).color,
          label: getComputedStyle(label).color,
          description: getComputedStyle(description).color,
        };
      });
    assert.notEqual(featureColors.number, featureColors.label);
    assert.equal(featureColors.number, featureColors.description);

    assert.equal(
      (await page.locator('.cloud-cta__copy > p').first().innerText()).trim(),
      'FREE PLUS SUPER ULTRA',
    );

    const expectedQuestions = [
      'What is Consuelo OS?',
      'How does Consuelo Cloud work?',
      'Which agents can I connect?',
      'What belongs in a workspace?',
      'How do nodes work?',
      'How do tools work?',
      'Can I bring my team?',
      'Will Consuelo replace my existing stack?',
      'How does pricing work?',
    ];
    assert.deepEqual(
      await page.locator('.home-faq summary > span:first-child').allInnerTexts(),
      expectedQuestions,
    );
    assert.equal(
      await page.locator('.home-faq details').last().locator('a').getAttribute('href'),
      '/pricing',
    );
    assert.ok(await page.locator('.home-faq__steps, .home-faq__bullets').count() > 0);

    const firstFaq = page.locator('.home-faq details').nth(0);
    const secondFaq = page.locator('.home-faq details').nth(1);
    await firstFaq.locator('summary').click();
    assert.equal(await firstFaq.getAttribute('open'), '');
    await secondFaq.locator('summary').click();
    await page.waitForFunction(() => {
      const openItems = document.querySelectorAll('.home-faq details[open]');
      return openItems.length === 1 && openItems[0] === document.querySelectorAll('.home-faq details')[1];
    });
    assert.equal(await firstFaq.getAttribute('open'), null);
    assert.equal(await secondFaq.getAttribute('open'), '');

    await page.locator('.home-faq details').first().hover();
    await page.waitForTimeout(180);
    const faqHover = await page
      .locator('.home-faq details')
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(faqHover, 'rgba(0, 0, 0, 0)');
    assert.notEqual(faqHover, 'rgb(255, 255, 255)');

    const mobileFaqFontSize = await page
      .locator('.home-faq summary')
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    assert.ok(mobileFaqFontSize <= 20);

    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await desktopPage.goto(server.baseUrl, { waitUntil: 'networkidle' });

    const desktopHeadingLineTops = await desktopPage
      .locator('.os-hero h1 [data-hero-line]')
      .evaluateAll((lines) =>
        lines.map((line) => Math.round(line.getBoundingClientRect().top)),
      );
    assert.equal(new Set(desktopHeadingLineTops).size, 2);

    const desktopWordmarkFontSize = await desktopPage
      .locator('.os-header__wordmark')
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
    assert.ok(desktopWordmarkFontSize >= 24);

    const desktopFaqFontSize = await desktopPage
      .locator('.home-faq summary')
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
    assert.ok(desktopFaqFontSize <= 28);
  } finally {
    await browser.close();
    await server.stop();
  }
});
