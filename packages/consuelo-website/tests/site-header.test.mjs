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
    throw new Error(`Astro dev server exited before tests completed with code ${code}.
${output}`);
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

const getHeaderText = async (page) =>
  (await page.locator('[data-launch-header]').innerText())
    .replace(/\s+/g, ' ')
    .trim();

const disallowedHeaderText = [
  'NOUS',
  'Hermes Agent',
  'Mercury',
  'Enterprise',
  'Login',
  'Free',
];

test('home page header follows the Consuelo OS desktop and mobile contract', async () => {
  const server = await startDevServer();
  const browser = await chromium.launch();

  try {
    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 720 },
    });
    await desktopPage.goto(server.baseUrl, { waitUntil: 'networkidle' });

    const header = desktopPage.locator('[data-launch-header]');
    await assert.doesNotReject(() => header.waitFor({ state: 'visible' }));

    const headerText = await getHeaderText(desktopPage);

    for (const expectedText of [
      'Consuelo',
      'Consuelo OS',
      'Portal',
      'Docs',
      'Install',
    ]) {
      assert.equal(
        headerText.includes(expectedText),
        true,
        `Expected header to include ${expectedText}`,
      );
    }

    for (const blockedText of disallowedHeaderText) {
      assert.equal(
        headerText.includes(blockedText),
        false,
        `Expected header to omit ${blockedText}`,
      );
    }

    assert.equal(
      await desktopPage.locator('[data-header-brand]').innerText(),
      'Consuelo',
    );

    const getDesktopSlots = async (page) =>
      page
        .locator('[data-header-brand], [data-desktop-header-slot]')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            return {
              text: element.textContent?.replace(/\s+/g, ' ').trim(),
              visible:
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0,
              center: rect.left + rect.width / 2,
            };
          }),
        );

    const desktopSlots = await getDesktopSlots(desktopPage);
    assert.deepEqual(
      desktopSlots.map((slot) => slot.text),
      ['Consuelo', 'Docs', 'Consuelo OS', 'Portal', 'Install →'],
    );
    assert.equal(
      desktopSlots.every((slot) => slot.visible),
      true,
    );
    for (let index = 1; index < desktopSlots.length; index += 1) {
      assert.ok(desktopSlots[index - 1].center < desktopSlots[index].center);
    }
    assert.ok(Math.abs(desktopSlots[2].center - 720) < 64);

    const tabletPage = await browser.newPage({
      viewport: { width: 820, height: 1180 },
      isMobile: true,
    });
    await tabletPage.goto(server.baseUrl, { waitUntil: 'networkidle' });
    const tabletSlots = await getDesktopSlots(tabletPage);
    assert.deepEqual(
      tabletSlots.map((slot) => slot.text),
      ['Consuelo', 'Docs', 'Consuelo OS', 'Portal', 'Install →'],
    );
    assert.equal(
      tabletSlots.every((slot) => slot.visible),
      true,
    );
    for (let index = 1; index < tabletSlots.length; index += 1) {
      assert.ok(tabletSlots[index - 1].center < tabletSlots[index].center);
    }
    assert.ok(Math.abs(tabletSlots[2].center - 410) < 48);

    const headerPosition = await header.evaluate(
      (element) => window.getComputedStyle(element).position,
    );
    assert.notEqual(headerPosition, 'fixed');
    assert.notEqual(headerPosition, 'sticky');

    await desktopPage.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 320);
    });
    await desktopPage.waitForFunction(() => window.scrollY > 80);
    const scrolledHeaderTop = await header.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    assert.ok(scrolledHeaderTop < 0);
    await desktopPage.evaluate(() => window.scrollTo(0, 0));

    const heroHeading = (await desktopPage.locator('h1').first().innerText())
      .replace(/\s+/g, ' ')
      .trim();
    assert.doesNotMatch(heroHeading, /superpowers\.$/);
    assert.doesNotMatch(heroHeading, /superpowers\./);

    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await mobilePage.goto(server.baseUrl, { waitUntil: 'networkidle' });

    const mobileSlots = await mobilePage
      .locator('[data-mobile-header-slot]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return {
            text: element.textContent?.replace(/\s+/g, ' ').trim(),
            visible:
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0,
            left: rect.left,
            center: rect.left + rect.width / 2,
            right: rect.right,
          };
        }),
      );

    assert.deepEqual(
      mobileSlots.map((slot) => slot.text),
      ['Portal', 'Consuelo OS', 'Docs'],
    );
    assert.equal(
      mobileSlots.every((slot) => slot.visible),
      true,
    );
    assert.ok(mobileSlots[0].center < mobileSlots[1].center);
    assert.ok(mobileSlots[1].center < mobileSlots[2].center);
    assert.ok(Math.abs(mobileSlots[1].center - 195) < 32);
  } finally {
    await browser.close();
    await server.stop();
  }
});
