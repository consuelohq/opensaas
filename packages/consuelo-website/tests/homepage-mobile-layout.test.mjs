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

test('homepage mobile layout and content follow the launch contract', { timeout: 60_000 }, async () => {
  const server = await startDevServer();
  const browser = await chromium.launch();

  try {
    for (const width of [320, 360, 375, 390, 430]) {
      const heroPage = await browser.newPage({ viewport: { width, height: 844 } });
      await heroPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
      await heroPage.locator('.os-hero h1').waitFor({ state: 'attached' });

      const heroContract = await heroPage.evaluate(() => {
        const heading = document.querySelector('.os-hero h1');
        const lines = Array.from(document.querySelectorAll('.os-hero__heading-line'));
        if (!(heading instanceof HTMLElement) || lines.length !== 2) {
          throw new Error('Expected the current two-line rotating-assistant hero');
        }

        return {
          inlineSize: heading.style.getPropertyValue('--hero-title-size'),
          lines: lines.map((line) => ({
            clientWidth: line.clientWidth,
            scrollWidth: line.scrollWidth,
          })),
        };
      });

      assert.equal(heroContract.inlineSize, '');
      for (const line of heroContract.lines) {
        assert.ok(
          line.scrollWidth <= line.clientWidth + 1,
          `Expected ${width}px hero line to fit (${line.scrollWidth}px > ${line.clientWidth}px)`,
        );
      }
      await heroPage.close();
    }

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.os-hero h1').waitFor({ state: 'attached' });

    const captureHeadlineGeometry = () =>
      page.evaluate(() => {
        const hero = document.querySelector('.os-hero h1');
        const cloud = document.querySelector('.cloud-cta h2');
        if (!(hero instanceof HTMLElement) || !(cloud instanceof HTMLElement)) {
          throw new Error('Expected hero and cloud headings');
        }
        const heroBox = hero.getBoundingClientRect();
        const cloudBox = cloud.getBoundingClientRect();
        return {
          hero: {
            fontSize: getComputedStyle(hero).fontSize,
            height: heroBox.height,
            top: heroBox.top,
            inlineSize: hero.style.getPropertyValue('--hero-title-size'),
          },
          cloud: {
            fontSize: getComputedStyle(cloud).fontSize,
            height: cloudBox.height,
            top: cloudBox.top,
            inlineSize: cloud.style.getPropertyValue('--cloud-title-size'),
          },
        };
      });

    const firstHeadlineFrame = await captureHeadlineGeometry();
    await page.waitForTimeout(350);
    const settledHeadlineFrame = await captureHeadlineGeometry();
    assert.deepEqual(settledHeadlineFrame, firstHeadlineFrame);
    assert.equal(firstHeadlineFrame.hero.inlineSize, '');
    assert.equal(firstHeadlineFrame.cloud.inlineSize, '');
    assert.ok(Number.parseFloat(firstHeadlineFrame.hero.fontSize) >= 32);
    assert.ok(Number.parseFloat(firstHeadlineFrame.hero.fontSize) <= 52);
    assert.ok(Number.parseFloat(firstHeadlineFrame.cloud.fontSize) >= 32);
    assert.ok(Number.parseFloat(firstHeadlineFrame.cloud.fontSize) <= 55);
    await page.locator('main').waitFor();

    const mobileHeader = page.locator('.os-header__mobile');
    await assert.doesNotReject(() => mobileHeader.waitFor({ state: 'visible' }));
    const mobileSideLinks = mobileHeader.locator('.os-header__side-link');
    assert.equal(
      await mobileSideLinks.first().innerText(),
      'DOCS',
    );
    assert.equal(
      await mobileSideLinks.first().getAttribute('href'),
      'https://docs.consuelohq.com',
    );
    assert.equal(
      await mobileSideLinks.last().innerText(),
      'CLOUD',
    );
    assert.equal(
      await mobileSideLinks.last().getAttribute('href'),
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
      await heading.getAttribute('aria-label'),
      'Give ChatGPT or Claude access to your files',
    );
    const headingLineTops = await heading.locator('.os-hero__heading-line').evaluateAll(
      (lines) =>
        lines.map((line) => Math.round(line.getBoundingClientRect().top)),
    );
    assert.equal(new Set(headingLineTops).size, 2);

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
    assert.equal(await page.locator('.os-hero .cloud-field__body').count(), 4);
    assert.equal(
      await page.locator('.os-hero .cloud-field__body').first().getAttribute('src'),
      '/images/clouds/dialer-cloud-01.webp',
    );
    assert.equal(await page.locator('.os-hero__button svg').count(), 1);
    assert.equal(
      await page.locator('.product-panel__preview .cloud-field__body').first().getAttribute('src'),
      '/images/clouds/dialer-cloud-02.webp',
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
      .locator('.product-story__chapter')
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

    const connectSequence = await page
      .locator('.feature-evidence__sequence [data-agent]')
      .allInnerTexts();
    assert.deepEqual(connectSequence, ['01\nChatGPT', '02\nGrok', '03\nCodex', '04\nOpenCode']);

    const connectStageBox = await page.locator('.feature-evidence__stage').boundingBox();
    assert.ok(connectStageBox);
    assert.ok(Math.abs(connectStageBox.width / connectStageBox.height - 2032 / 1192) < 0.02);

    const mobileFeatureStory = await page.evaluate(() => {
      const chapters = Array.from(document.querySelectorAll('[data-feature-chapter]'));
      const visual = document.querySelector('.product-story__visual');
      if (!(visual instanceof HTMLElement)) {
        throw new Error('Expected the mobile feature story visual');
      }
      return {
        chapterCount: chapters.length,
        visualPosition: getComputedStyle(visual).position,
        memoryCount: document.querySelectorAll('[data-memory-story]').length,
        observeCount: document.querySelectorAll('[data-observe-story]').length,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(mobileFeatureStory.chapterCount, 3);
    assert.equal(mobileFeatureStory.visualPosition, 'static');
    assert.equal(mobileFeatureStory.memoryCount, 0);
    assert.equal(mobileFeatureStory.observeCount, 0);
    assert.equal(mobileFeatureStory.horizontalOverflow, 0);

    const featureTabletPage = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
    await featureTabletPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await featureTabletPage.locator('.product-story').waitFor({ state: 'attached' });
    const tabletFeatureGeometry = await featureTabletPage.evaluate(() => {
      const chapter = document.querySelector('.product-story__chapter');
      const visual = document.querySelector('.product-story__visual');
      const stage = document.querySelector('.feature-evidence__stage');
      if (!(chapter instanceof HTMLElement) || !(visual instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
        throw new Error('Expected tablet feature story and CONNECT evidence stage');
      }
      const stageBox = stage.getBoundingClientRect();
      return {
        columns: getComputedStyle(chapter).gridTemplateColumns.split(' ').filter(Boolean).length,
        visualPosition: getComputedStyle(visual).position,
        stageRatio: stageBox.width / stageBox.height,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(tabletFeatureGeometry.columns, 1);
    assert.equal(tabletFeatureGeometry.visualPosition, 'static');
    assert.ok(Math.abs(tabletFeatureGeometry.stageRatio - 2032 / 1192) < 0.02);
    assert.equal(tabletFeatureGeometry.horizontalOverflow, 0);
    await featureTabletPage.close();

    const featureDesktopPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await featureDesktopPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await featureDesktopPage.locator('.product-story').waitFor({ state: 'attached' });
    const desktopFeatureStory = await featureDesktopPage.evaluate(() => {
      const chapter = document.querySelector('.product-story__chapter');
      const visual = document.querySelector('.product-story__visual');
      if (!(chapter instanceof HTMLElement) || !(visual instanceof HTMLElement)) {
        throw new Error('Expected desktop feature story');
      }
      return {
        columns: getComputedStyle(chapter).gridTemplateColumns.split(' ').filter(Boolean).length,
        visualPosition: getComputedStyle(visual).position,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(desktopFeatureStory.columns, 2);
    assert.equal(desktopFeatureStory.visualPosition, 'static');
    assert.equal(desktopFeatureStory.horizontalOverflow, 0);
    await featureDesktopPage.close();

    for (const width of [768, 834, 1024, 1180, 1440, 1920]) {
      const alignedPage = await browser.newPage({ viewport: { width, height: 1000 } });
      await alignedPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
      const rows = await alignedPage.locator('.product-story__chapter:not(.product-story__chapter--demo)').evaluateAll((chapters) =>
        chapters.map((chapter) => ['.product-panel__index', 'h3', '.product-panel__description', '.product-story__actions'].map((selector) =>
          chapter.querySelector(selector).getBoundingClientRect().top)),
      );
      assert.equal(rows.length, 2);
      for (let row = 0; row < 4; row += 1) {
        assert.ok(Math.abs(rows[0][row] - rows[1][row]) <= 1,
          `Expected aligned feature row ${row} at ${width}px: ${rows[0][row]} vs ${rows[1][row]}`);
      }
      await alignedPage.close();
    }


    assert.equal(
      (await page.locator('.cloud-cta__copy > p').first().innerText()).trim(),
      'ONE WORKSPACE FOR PEOPLE AND AGENTS',
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

    for (const width of [768, 1024, 1180]) {
      const responsivePage = await browser.newPage({
        viewport: { width, height: 900 },
      });
      await responsivePage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
      await responsivePage.locator('.os-hero h1').waitFor({ state: 'attached' });

      const firstFrame = await responsivePage.evaluate(() => {
        const hero = document.querySelector('.os-hero h1');
        const cloud = document.querySelector('.cloud-cta h2');
        if (!(hero instanceof HTMLElement) || !(cloud instanceof HTMLElement)) {
          throw new Error('Expected responsive headings');
        }
        return {
          heroFont: getComputedStyle(hero).fontSize,
          heroHeight: hero.getBoundingClientRect().height,
          heroInline: hero.style.getPropertyValue('--hero-title-size'),
          cloudFont: getComputedStyle(cloud).fontSize,
          cloudHeight: cloud.getBoundingClientRect().height,
          cloudInline: cloud.style.getPropertyValue('--cloud-title-size'),
        };
      });
      await responsivePage.waitForTimeout(350);
      const settledFrame = await responsivePage.evaluate(() => {
        const hero = document.querySelector('.os-hero h1');
        const cloud = document.querySelector('.cloud-cta h2');
        if (!(hero instanceof HTMLElement) || !(cloud instanceof HTMLElement)) {
          throw new Error('Expected responsive headings');
        }
        return {
          heroFont: getComputedStyle(hero).fontSize,
          heroHeight: hero.getBoundingClientRect().height,
          heroInline: hero.style.getPropertyValue('--hero-title-size'),
          cloudFont: getComputedStyle(cloud).fontSize,
          cloudHeight: cloud.getBoundingClientRect().height,
          cloudInline: cloud.style.getPropertyValue('--cloud-title-size'),
        };
      });
      assert.deepEqual(settledFrame, firstFrame);
      assert.equal(firstFrame.heroInline, '');
      assert.equal(firstFrame.cloudInline, '');
      assert.ok(Number.parseFloat(firstFrame.heroFont) > 0);
      assert.ok(Number.parseFloat(firstFrame.cloudFont) >= 40);
      assert.ok(Number.parseFloat(firstFrame.cloudFont) <= 100);

      const responsiveContract = await responsivePage.evaluate(() => {
        const lines = Array.from(document.querySelectorAll('.os-hero__heading-line'));
        return {
          lineTops: lines.map((line) => Math.round(line.getBoundingClientRect().top)),
          lineFits: lines.map((line) => line.scrollWidth <= line.clientWidth + 1),
          horizontalOverflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      assert.equal(new Set(responsiveContract.lineTops).size, 2);
      assert.ok(responsiveContract.lineFits.every(Boolean));
      assert.equal(responsiveContract.horizontalOverflow, 0);
      await responsivePage.close();
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const initialFooterState = await page.locator('[data-cloud-reveal]').evaluate((footer) => ({
      opacity: Number.parseFloat(getComputedStyle(footer).opacity),
      pointerEvents: getComputedStyle(footer).pointerEvents,
      inert: footer.hasAttribute('inert'),
    }));
    assert.equal(initialFooterState.opacity, 0);
    assert.equal(initialFooterState.pointerEvents, 'none');
    assert.equal(initialFooterState.inert, true);

    await page.evaluate(() => {
      const scrollLimit = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      window.scrollTo(0, Math.max(0, scrollLimit - window.innerHeight * 0.9));
    });
    await page.waitForTimeout(200);
    const earlyFooterState = await page.locator('[data-cloud-reveal]').evaluate((footer) => ({
      opacity: Number.parseFloat(getComputedStyle(footer).opacity),
      pointerEvents: getComputedStyle(footer).pointerEvents,
      inert: footer.hasAttribute('inert'),
    }));
    assert.ok(earlyFooterState.opacity > 0.25);
    assert.ok(earlyFooterState.opacity < 0.55);
    assert.equal(earlyFooterState.pointerEvents, 'none');
    assert.equal(earlyFooterState.inert, true);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => {
      const footer = document.querySelector('[data-cloud-reveal]');
      return (
        footer instanceof HTMLElement &&
        Number.parseFloat(getComputedStyle(footer).opacity) >= 0.98 &&
        getComputedStyle(footer).pointerEvents === 'auto' &&
        !footer.hasAttribute('inert')
      );
    });

    const mobileFooterContract = await page.evaluate(() => {
      const copy = document.querySelector('.cloud-cta__copy');
      const version = document.querySelector('.cloud-cta__version');
      const signature = document.querySelector('.cloud-cta__signature');
      const button = document.querySelector('.cloud-cta__primary');
      if (!(copy instanceof HTMLElement) || !(version instanceof HTMLElement) ||
          !(signature instanceof HTMLElement) || !(button instanceof HTMLAnchorElement)) {
        throw new Error('Expected team invitation and footer signature');
      }
      const box = copy.getBoundingClientRect();
      return {
        artMissing: document.querySelector('.cloud-cta__art') === null,
        titleLines: Array.from(document.querySelectorAll('[data-cloud-title-line]')).map((line) => Math.round(line.getBoundingClientRect().top)),
        copyTop: box.top,
        copyBottom: box.bottom,
        centerOffset: Math.abs(box.top + box.height / 2 - window.innerHeight / 2),
        primaryHref: button.href,
        versionText: version.textContent?.replace(/\s+/g, ' ').trim(),
        versionWhiteSpace: getComputedStyle(version).whiteSpace,
        signatureLeft: signature.getBoundingClientRect().left,
      };
    });
    assert.equal(new Set(mobileFooterContract.titleLines).size, 2);
    assert.equal(mobileFooterContract.artMissing, true);
    assert.ok(mobileFooterContract.copyTop >= 24);
    assert.ok(mobileFooterContract.copyBottom < 770);
    assert.ok(mobileFooterContract.centerOffset <= 1);
    assert.equal(mobileFooterContract.primaryHref, 'https://os.consuelohq.com/');
    assert.equal(mobileFooterContract.versionText, 'CONSUELO OS V0.10.3');
    assert.equal(mobileFooterContract.versionWhiteSpace, 'nowrap');
    assert.ok(mobileFooterContract.signatureLeft <= 20);

    const reducedMotionPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await reducedMotionPage.emulateMedia({ reducedMotion: 'reduce' });
    await reducedMotionPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await reducedMotionPage.locator('[data-cloud-reveal]').waitFor({ state: 'attached' });
    const reducedMotionFooter = await reducedMotionPage
      .locator('[data-cloud-reveal]')
      .evaluate((footer) => ({
        opacity: Number.parseFloat(getComputedStyle(footer).opacity),
        transitionDuration: getComputedStyle(footer).transitionDuration,
        inert: footer.hasAttribute('inert'),
      }));
    assert.equal(reducedMotionFooter.opacity, 1);
    assert.equal(reducedMotionFooter.transitionDuration, '0s');
    assert.equal(reducedMotionFooter.inert, false);
    await reducedMotionPage.close();

    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await desktopPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await desktopPage.locator('main').waitFor();

    const desktopHeadingLineTops = await desktopPage
      .locator('.os-hero__heading-line')
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

    await desktopPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await desktopPage.waitForFunction(() => {
      const footer = document.querySelector('[data-cloud-reveal]');
      return (
        footer instanceof HTMLElement &&
        Number.parseFloat(getComputedStyle(footer).opacity) >= 0.98
      );
    });

    const checkCenteredFooter = async (footerPage) => {
      const contract = await footerPage.evaluate(() => {
        const copy = document.querySelector('.cloud-cta__copy');
        const button = document.querySelector('.cloud-cta__primary');
        const version = document.querySelector('.cloud-cta__version');
        const signature = document.querySelector('.cloud-cta__signature');
        if (!(copy instanceof HTMLElement) || !(button instanceof HTMLElement) ||
            !(version instanceof HTMLElement) || !(signature instanceof HTMLElement)) {
          throw new Error('Expected complete team invitation');
        }
        const box = copy.getBoundingClientRect();
        return {
          copyTop: box.top,
          copyBottom: box.bottom,
          viewportHeight: window.innerHeight,
          centerOffset: Math.abs(box.top + box.height / 2 - window.innerHeight / 2),
          titleLinesFit: Array.from(copy.querySelectorAll('[data-cloud-title-line]'))
            .every((line) => line.scrollWidth <= line.clientWidth + 1),
          buttonWidth: button.getBoundingClientRect().width,
          primaryHref: button.getAttribute('href'),
          secondaryHref: copy.querySelector('.cloud-cta__secondary')?.getAttribute('href'),
          versionLeft: version.getBoundingClientRect().left,
          signatureRightGap: window.innerWidth - signature.getBoundingClientRect().right,
          artMissing: document.querySelector('.cloud-cta__art') === null,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      assert.ok(contract.copyTop >= 32);
      assert.ok(contract.copyBottom < contract.viewportHeight - 80);
      assert.ok(contract.centerOffset <= 1);
      assert.equal(contract.titleLinesFit, true);
      assert.ok(contract.buttonWidth >= 180);
      assert.equal(contract.primaryHref, 'https://os.consuelohq.com/');
      assert.equal(contract.secondaryHref, '/pricing');
      assert.ok(contract.versionLeft >= 50);
      assert.ok(contract.signatureRightGap >= 50);
      assert.equal(contract.artMissing, true);
      assert.equal(contract.overflow, 0);
    };
    await checkCenteredFooter(desktopPage);

    const tabletPage = await browser.newPage({ viewport: { width: 768, height: 900 } });
    await tabletPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await tabletPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await tabletPage.waitForFunction(() => {
      const footer = document.querySelector('[data-cloud-reveal]');
      return footer instanceof HTMLElement && Number.parseFloat(getComputedStyle(footer).opacity) >= 0.98;
    });
    await checkCenteredFooter(tabletPage);
    await tabletPage.close();
  } finally {
    await browser.close();
    await server.stop();
  }
});
