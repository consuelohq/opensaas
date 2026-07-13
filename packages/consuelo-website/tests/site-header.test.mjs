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

test('home page header follows the Consuelo OS desktop and mobile contract', async () => {
  const server = await startDevServer();
  const browser = await chromium.launch();

  try {
    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await desktopPage.goto(server.baseUrl, { waitUntil: 'networkidle' });

    const header = desktopPage.locator('[data-os-header]');
    await assert.doesNotReject(() => header.waitFor({ state: 'visible' }));

    const desktopSlots = await desktopPage
      .locator('.os-header__desktop > a, .os-header__desktop > .os-header__identity')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent?.replace(/\s+/g, ' ').trim(),
            center: rect.left + rect.width / 2,
          };
        }),
      );

    assert.deepEqual(
      desktopSlots.map((slot) => slot.text),
      ['CONSUELO', 'DOCS', 'CONSUELO OS', 'PRICING', 'CLOUD'],
    );
    for (let index = 1; index < desktopSlots.length; index += 1) {
      assert.ok(desktopSlots[index - 1].center < desktopSlots[index].center);
    }
    assert.ok(Math.abs(desktopSlots[2].center - 720) < 64);
    assert.equal(
      await header.evaluate((element) => getComputedStyle(element).position),
      'absolute',
    );

    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await mobilePage.goto(server.baseUrl, { waitUntil: 'networkidle' });

    const mobileHeader = mobilePage.locator('.os-header__mobile');
    await assert.doesNotReject(() => mobileHeader.waitFor({ state: 'visible' }));
    const mobileSlots = await mobileHeader
      .locator(':scope > a, :scope > .os-header__mobile-identity, :scope > button')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent?.replace(/\s+/g, ' ').trim(),
            center: rect.left + rect.width / 2,
          };
        }),
      );

    assert.deepEqual(
      mobileSlots.map((slot) => slot.text),
      ['CLOUD', 'CONSUELO OS', 'MENU'],
    );
    assert.ok(mobileSlots[0].center < mobileSlots[1].center);
    assert.ok(mobileSlots[1].center < mobileSlots[2].center);
    assert.ok(Math.abs(mobileSlots[1].center - 195) < 32);

    const typography = await mobileHeader.evaluate((element) => {
      const wordmark = element.querySelector('.os-header__mobile-wordmark');
      const label = element.querySelector(':scope > a');
      const github = element.querySelector('[aria-label="GitHub"] svg');

      if (!(wordmark && label && github)) {
        throw new Error('Expected mobile header content');
      }

      return {
        wordmark: Number.parseFloat(getComputedStyle(wordmark).fontSize),
        label: Number.parseFloat(getComputedStyle(label).fontSize),
        icon: github.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.ok(typography.wordmark >= 19);
    assert.ok(typography.label >= 12);
    assert.ok(typography.icon >= 16);
    assert.equal(typography.overflow, 0);
    assert.equal(await mobileHeader.locator('[aria-label="Discord"]').isVisible(), true);
    assert.equal(await mobileHeader.locator('[aria-label="GitHub"]').isVisible(), true);
  } finally {
    await browser.close();
    await server.stop();
  }
});
