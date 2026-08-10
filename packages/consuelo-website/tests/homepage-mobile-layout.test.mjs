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
    assert.ok(Math.abs(Number.parseFloat(firstHeadlineFrame.cloud.fontSize) - 57.33) < 0.35);
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
      'Make ChatGPT or Claude your digital worker',
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
    assert.equal(await page.locator('.os-hero__cloud').count(), 4);
    assert.equal(
      await page.locator('.os-hero__cloud').first().getAttribute('src'),
      '/images/home/dither/cloud-1.png',
    );
    assert.equal(await page.locator('.os-hero__button svg').count(), 1);
    assert.equal(
      await page.locator('.product-panel__preview-art').getAttribute('src'),
      '/images/home/dither/cloud-2.png',
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
      'FREE • PLUS • SUPER • ULTRA',
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
      const expectedCloudFonts = { 768: 54.528, 1024: 45.056, 1180: 51.92 };
      assert.ok(Number.parseFloat(firstFrame.heroFont) > 0);
      assert.ok(Math.abs(Number.parseFloat(firstFrame.cloudFont) - expectedCloudFonts[width]) < 0.4);

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
      const art = document.querySelector('.cloud-cta__art');
      const wordmark = document.querySelector('.cloud-cta__wordmark');
      const version = document.querySelector('.cloud-cta__version');
      const signature = document.querySelector('.cloud-cta__signature');
      const badge = document.querySelector('.cloud-cta__badge');
      if (
        !(art instanceof HTMLImageElement) ||
        !(wordmark instanceof HTMLElement) ||
        !(version instanceof HTMLElement) ||
        !(signature instanceof HTMLElement) ||
        !(badge instanceof HTMLElement)
      ) {
        throw new Error('Expected complete cloud footer composition');
      }
      const artBox = art.getBoundingClientRect();
      const badgeBox = badge.getBoundingClientRect();
      const badgeImage = badge.querySelector('img');
      if (!(badgeImage instanceof HTMLImageElement)) {
        throw new Error('Expected generated badge image');
      }
      const canvas = document.createElement('canvas');
      canvas.width = art.naturalWidth;
      canvas.height = art.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        throw new Error('Expected canvas context for footer art inspection');
      }
      context.drawImage(art, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let bluePixels = 0;
      let whitePixels = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const alpha = pixels[index + 3];
        if (alpha > 220 && red < 20 && green < 20 && blue > 220) {
          bluePixels += 1;
        }
        if (alpha > 220 && red > 240 && green > 240 && blue > 240) {
          whitePixels += 1;
        }
      }
      const titleLines = Array.from(
        document.querySelectorAll('[data-cloud-title-line]'),
      ).map((line) => Math.round(line.getBoundingClientRect().top));

      return {
        artFilter: getComputedStyle(art).filter,
        artSrc: art.getAttribute('src'),
        artTop: artBox.top,
        artBottom: artBox.bottom,
        artHeight: artBox.height,
        bluePixels,
        whitePixels,
        badgeDisplay: getComputedStyle(badge).display,
        badgeSrc: badgeImage.getAttribute('src'),
        badgeNaturalWidth: badgeImage.naturalWidth,
        badgeNaturalHeight: badgeImage.naturalHeight,
        badgeHeight: badgeBox.height,
        badgeWidth: badgeBox.width,
        signatureFontWeight: Number.parseInt(getComputedStyle(signature).fontWeight, 10),
        signatureJustifyItems: getComputedStyle(signature).justifyItems,
        signatureLeft: signature.getBoundingClientRect().left,
        signatureTextAlign: getComputedStyle(signature).textAlign,
        titleLines,
        versionFontWeight: Number.parseInt(getComputedStyle(version).fontWeight, 10),
        versionText: version.textContent?.replace(/\s+/g, ' ').trim(),
        versionWhiteSpace: getComputedStyle(version).whiteSpace,
        viewportHeight: window.innerHeight,
        wordmarkDisplay: getComputedStyle(wordmark).display,
      };
    });
    assert.equal(new Set(mobileFooterContract.titleLines).size, 2);
    assert.ok(mobileFooterContract.artTop >= 0);
    assert.ok(mobileFooterContract.artBottom <= mobileFooterContract.viewportHeight + 1);
    assert.equal(
      mobileFooterContract.artSrc,
      '/generated/holding-world-editorial.png?v=20260810-smooth-fill',
    );
    assert.ok(mobileFooterContract.artHeight <= 408);
    assert.equal(mobileFooterContract.artFilter, 'none');
    assert.ok(mobileFooterContract.bluePixels > 1000);
    assert.ok(mobileFooterContract.whitePixels > 1000);
    assert.equal(mobileFooterContract.wordmarkDisplay, 'none');
    assert.equal(mobileFooterContract.versionText, 'CONSUELO OS V0.10.3');
    assert.equal(mobileFooterContract.versionWhiteSpace, 'nowrap');
    assert.ok(mobileFooterContract.versionFontWeight <= 500);
    assert.ok(mobileFooterContract.signatureFontWeight <= 500);
    assert.equal(mobileFooterContract.signatureJustifyItems, 'start');
    assert.equal(mobileFooterContract.signatureTextAlign, 'left');
    assert.ok(mobileFooterContract.signatureLeft <= 20);
    assert.equal(mobileFooterContract.badgeDisplay, 'none');

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

    const desktopFooterContract = await desktopPage.evaluate(() => {
      const heading = document.querySelector('.cloud-cta h2');
      const copy = document.querySelector('.cloud-cta__copy');
      const description = document.querySelector('.cloud-cta__description');
      const button = document.querySelector('.cloud-cta__copy a');
      const art = document.querySelector('.cloud-cta__art');
      const wordLines = Array.from(document.querySelectorAll('[data-cloud-word-line]'));
      const version = document.querySelector('.cloud-cta__version');
      const signature = document.querySelector('.cloud-cta__signature');
      const badge = document.querySelector('.cloud-cta__badge');
      if (
        !(heading instanceof HTMLElement) ||
        !(copy instanceof HTMLElement) ||
        !(description instanceof HTMLElement) ||
        !(button instanceof HTMLElement) ||
        !(art instanceof HTMLImageElement) ||
        !(version instanceof HTMLElement) ||
        !(signature instanceof HTMLElement) ||
        !(badge instanceof HTMLElement) ||
        wordLines.length !== 2
      ) {
        throw new Error('Expected complete desktop cloud poster composition');
      }

      const headingBox = heading.getBoundingClientRect();
      const copyBox = copy.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      const artBox = art.getBoundingClientRect();
      const versionBox = version.getBoundingClientRect();
      const signatureBox = signature.getBoundingClientRect();
      const badgeBox = badge.getBoundingClientRect();
      const badgeImage = badge.querySelector('img');
      if (!(badgeImage instanceof HTMLImageElement)) {
        throw new Error('Expected desktop badge image');
      }
      const firstWordStyle = getComputedStyle(wordLines[0]);
      const secondWordStyle = getComputedStyle(wordLines[1]);

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        titleWidth: headingBox.width,
        titleTop: headingBox.top,
        copyTop: copyBox.top,
        buttonWidth: buttonBox.width,
        descriptionText: description.textContent?.replace(/\s+/g, ' ').trim(),
        descriptionFontFamily: getComputedStyle(description).fontFamily,
        eyebrowFontFamily: getComputedStyle(document.querySelector('.cloud-cta__eyebrow')).fontFamily,
        artTop: artBox.top,
        artBottom: artBox.bottom,
        artWidth: artBox.width,
        wordLineDisplays: wordLines.map((line) => getComputedStyle(line).display),
        firstWordSize: Number.parseFloat(firstWordStyle.fontSize),
        secondWordSize: Number.parseFloat(secondWordStyle.fontSize),
        versionLeft: versionBox.left,
        signatureRightGap: window.innerWidth - signatureBox.right,
        signatureTextAlign: getComputedStyle(signature).textAlign,
        signatureJustifyItems: getComputedStyle(signature).justifyItems,
        badgeDisplay: getComputedStyle(badge).display,
        badgeSrc: badgeImage.getAttribute('src'),
        badgeNaturalWidth: badgeImage.naturalWidth,
        badgeNaturalHeight: badgeImage.naturalHeight,
        badgeRatio: badgeBox.height / badgeBox.width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.ok(desktopFooterContract.titleWidth >= desktopFooterContract.viewportWidth * 0.35);
    assert.ok(desktopFooterContract.titleWidth <= desktopFooterContract.viewportWidth * 0.52);
    assert.ok(desktopFooterContract.titleTop <= desktopFooterContract.viewportHeight * 0.16);
    assert.ok(desktopFooterContract.copyTop <= desktopFooterContract.viewportHeight * 0.08);
    assert.ok(desktopFooterContract.buttonWidth >= 180);
    assert.equal(
      desktopFooterContract.descriptionText,
      'KEEP THE SAME WORKSPACE AND LET CONSUELO RUN THE HOME NODE FOR YOU',
    );
    assert.equal(
      desktopFooterContract.descriptionFontFamily,
      desktopFooterContract.eyebrowFontFamily,
    );
    assert.ok(desktopFooterContract.artTop <= desktopFooterContract.viewportHeight * 0.38);
    assert.ok(Math.abs(desktopFooterContract.artBottom - desktopFooterContract.viewportHeight) <= 1);
    assert.ok(desktopFooterContract.artWidth >= 520);
    assert.ok(desktopFooterContract.artWidth <= 545);
    assert.deepEqual(desktopFooterContract.wordLineDisplays, ['block', 'block']);
    assert.ok(desktopFooterContract.secondWordSize < desktopFooterContract.firstWordSize);
    assert.ok(desktopFooterContract.versionLeft >= desktopFooterContract.viewportWidth * 0.075);
    assert.ok(desktopFooterContract.signatureRightGap >= desktopFooterContract.viewportWidth * 0.075);
    assert.equal(desktopFooterContract.signatureTextAlign, 'right');
    assert.equal(desktopFooterContract.signatureJustifyItems, 'end');
    assert.notEqual(desktopFooterContract.badgeDisplay, 'none');
    assert.equal(desktopFooterContract.badgeSrc, '/generated/consuelo-footer-badge.png');
    assert.equal(desktopFooterContract.badgeNaturalWidth, 242);
    assert.equal(desktopFooterContract.badgeNaturalHeight, 346);
    assert.ok(desktopFooterContract.badgeRatio >= 1.35);
    assert.ok(desktopFooterContract.badgeRatio <= 1.5);
    assert.equal(desktopFooterContract.overflow, 0);

    const tabletPage = await browser.newPage({
      viewport: { width: 768, height: 900 },
    });
    await tabletPage.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
    await tabletPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await tabletPage.waitForFunction(() => {
      const footer = document.querySelector('[data-cloud-reveal]');
      return (
        footer instanceof HTMLElement &&
        Number.parseFloat(getComputedStyle(footer).opacity) >= 0.98
      );
    });

    const tabletFooterContract = await tabletPage.evaluate(() => {
      const heading = document.querySelector('.cloud-cta h2');
      const art = document.querySelector('.cloud-cta__art');
      const wordmark = document.querySelector('.cloud-cta__wordmark');
      const badge = document.querySelector('.cloud-cta__badge');
      if (
        !(heading instanceof HTMLElement) ||
        !(art instanceof HTMLImageElement) ||
        !(wordmark instanceof HTMLElement) ||
        !(badge instanceof HTMLElement)
      ) {
        throw new Error('Expected tablet cloud poster composition');
      }

      const headingBox = heading.getBoundingClientRect();
      const artBox = art.getBoundingClientRect();
      return {
        titleWidth: headingBox.width,
        artAspect: artBox.width / artBox.height,
        naturalArtAspect: art.naturalWidth / art.naturalHeight,
        artTop: artBox.top,
        artBottom: artBox.bottom,
        wordmarkDisplay: getComputedStyle(wordmark).display,
        badgeDisplay: getComputedStyle(badge).display,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.ok(tabletFooterContract.titleWidth >= 540);
    assert.ok(
      Math.abs(tabletFooterContract.artAspect - tabletFooterContract.naturalArtAspect) <= 0.01,
    );
    assert.ok(tabletFooterContract.artTop >= 325);
    assert.ok(tabletFooterContract.artTop <= 345);
    assert.ok(Math.abs(tabletFooterContract.artBottom - 900) <= 1);
    assert.notEqual(tabletFooterContract.wordmarkDisplay, 'none');
    assert.notEqual(tabletFooterContract.badgeDisplay, 'none');
    assert.equal(tabletFooterContract.overflow, 0);
    await tabletPage.close();
  } finally {
    await browser.close();
    await server.stop();
  }
});
