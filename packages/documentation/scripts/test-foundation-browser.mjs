import {
  launchDocumentationBrowser,
  startDocumentationServer,
  stopDocumentationServer,
} from './lib/documentation-browser-test.mjs';
import { readFileSync } from 'node:fs';

const port = 4327;
const origin = `http://127.0.0.1:${port}`;
const server = startDocumentationServer({ port });
let output = '';
server.stdout.on('data', (chunk) => (output += chunk));
server.stderr.on('data', (chunk) => (output += chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Documentation server did not start.\n${output}`);
}

let browser;
try {
  await waitForServer();
  browser = await launchDocumentationBrowser();
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();

  await page.goto(origin, { waitUntil: 'networkidle' });
  if ((await page.locator('main h1#_top').count()) !== 1) throw new Error('Homepage must render one page title');
  const siteTitle = page.locator('.consuelo-site-title');
  if ((await siteTitle.textContent())?.trim() !== 'Consuelo OS') throw new Error('Header brand must read Consuelo OS');
  const siteTitleLogo = siteTitle.locator('img');
  if ((await siteTitleLogo.getAttribute('src')) !== '/favicon.svg') throw new Error('Header brand must use the docs favicon');
  const mainFrameAnimation = await page.locator('.main-frame').evaluate((element) => getComputedStyle(element).animationName);
  if (mainFrameAnimation !== 'docs-page-in') throw new Error(`Main frame entrance animation is ${mainFrameAnimation}`);
  const globalLinks = page.locator('#starlight__sidebar .global-sidebar-desktop a.global-section-link');
  const globalCount = await globalLinks.count();
  if (globalCount !== 11) throw new Error(`Expected 11 direct desktop global section links, found ${globalCount}`);
  if (await page.locator('#starlight__sidebar .global-sidebar-mobile').isVisible()) throw new Error('Mobile accordion navigation must be hidden on desktop');
  const startGlobalLink = page.locator('#starlight__sidebar .global-sidebar-desktop').getByRole('link', { name: 'Start', exact: true });
  if ((await startGlobalLink.getAttribute('href')) !== '/start/') throw new Error('Start must link directly to its overview');
  const nodesGlobalLink = page.locator('#starlight__sidebar .global-sidebar-desktop').getByRole('link', { name: 'Nodes', exact: true });
  if ((await nodesGlobalLink.getAttribute('href')) !== '/nodes/') throw new Error('Nodes must link directly to its overview');
  const globalLinkRest = await startGlobalLink.evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  await startGlobalLink.hover();
  const globalLinkHover = await startGlobalLink.evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  if (globalLinkHover.backgroundColor !== 'rgba(0, 0, 0, 0)') throw new Error(`Global sidebar hover has a background: ${globalLinkHover.backgroundColor}`);
  if (globalLinkHover.color === globalLinkRest.color) throw new Error('Global sidebar hover must brighten the text');

  const assertPointerFocusIsQuiet = async (locator, label) => {
    try {
      await locator.dispatchEvent('pointerdown', { pointerType: 'mouse' });
      await locator.focus();
      const focusStyle = await locator.evaluate((element) => ({
        boxShadow: getComputedStyle(element).boxShadow,
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: getComputedStyle(element).outlineWidth,
      }));
      if (focusStyle.boxShadow !== 'none') throw new Error(`${label} pointer focus has a box shadow: ${focusStyle.boxShadow}`);
      if (focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth !== '0px') throw new Error(`${label} pointer focus has an outline: ${JSON.stringify(focusStyle)}`);
    } catch (error) {
      throw new Error(`${label} pointer-focus verification failed`, { cause: error });
    }
  };
  const header = page.getByRole('banner');
  if ((await header.getByLabel('Translate this page').count()) !== 0) throw new Error('Translate selector must not be visible');
  for (const label of ['Use system appearance', 'Use light appearance', 'Use dark appearance']) {
    await assertPointerFocusIsQuiet(header.getByRole('button', { name: label }), `${label} button`);
  }
  const lightThemeButton = header.getByRole('button', { name: 'Use light appearance' });
  const darkThemeButton = header.getByRole('button', { name: 'Use dark appearance' });
  const autoThemeButton = header.getByRole('button', { name: 'Use system appearance' });
  await lightThemeButton.click();
  if ((await page.locator('html').getAttribute('data-theme')) !== 'light') throw new Error('Light display toggle did not set the light theme');
  if ((await page.evaluate(() => localStorage.getItem('starlight-theme'))) !== 'light') throw new Error('Light display preference was not persisted');
  const lightPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--docs-paper').trim());
  if (lightPaper !== '#faf7f2') throw new Error(`Light docs paper is ${lightPaper}, not the launcher cream`);
  await darkThemeButton.click();
  if ((await page.locator('html').getAttribute('data-theme')) !== 'dark') throw new Error('Dark display toggle did not set the dark theme');
  const darkPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--docs-paper').trim());
  if (darkPaper !== '#0f0f0d') throw new Error(`Dark docs paper is ${darkPaper}, not the launcher brown-black`);
  await autoThemeButton.click();
  if ((await page.evaluate(() => localStorage.getItem('starlight-theme'))) !== null) throw new Error('System display toggle must clear the explicit theme preference');
  if ((await autoThemeButton.getAttribute('aria-pressed')) !== 'true') throw new Error('System display toggle did not become selected');
  const searchButton = page.getByRole('button', { name: /Search/ }).first();
  await assertPointerFocusIsQuiet(searchButton, 'Search button');

  await page.keyboard.press('Tab');
  await startGlobalLink.focus();
  const keyboardFocusStyle = await startGlobalLink.evaluate((element) => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
  }));
  if (keyboardFocusStyle.outlineStyle === 'none' || keyboardFocusStyle.outlineWidth === '0px') {
    throw new Error(`Keyboard focus indicator is missing: ${JSON.stringify(keyboardFocusStyle)}`);
  }
  await startGlobalLink.click();
  await page.waitForURL(`${origin}/start/`);
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Missing All documentation link');
  const localGroups = page.locator('#starlight__sidebar details');
  if ((await localGroups.count()) !== 1) throw new Error('Section sidebar must show one group');
  if (!(await localGroups.first().evaluate((element) => element.open))) throw new Error('Section sidebar must start expanded');
  const activeStartStyle = await page.locator('#starlight__sidebar a[aria-current="page"]').evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    boxShadow: getComputedStyle(element).boxShadow,
  }));
  if (activeStartStyle.boxShadow !== 'none') throw new Error(`Active sidebar item still has an accent bar: ${activeStartStyle.boxShadow}`);
  if (activeStartStyle.backgroundColor === 'rgba(0, 0, 0, 0)') throw new Error('Active sidebar item must keep a neutral gray background');

  const startRoutes = [
    ['Overview', '/start/'],
    ['Install Consuelo OS', '/start/install-consuelo-os/'],
    ['Create a workspace', '/start/create-a-workspace/'],
    ['Connect your first agent', '/start/connect-your-first-agent/'],
    ['Core concepts', '/start/core-concepts/'],
  ];
  const sectionNavigation = page.locator('#starlight__sidebar');
  for (const [label, href] of startRoutes) {
    const link = sectionNavigation.getByRole('link', { name: label, exact: true });
    if ((await link.getAttribute('href')) !== href) throw new Error(`${label} is missing from the Start navigation`);
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${label} returned ${response.status}`);
    const markdownHref = href === '/start/' ? '/start.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`${label} Markdown returned ${markdown.status}`);
  }

  const nodeRoutes = [
    ['Overview', '/nodes/'],
    ['Local nodes', '/nodes/local/'],
    ['Cloud nodes', '/nodes/cloud/'],
    ['Routing work', '/nodes/routing/'],
  ];
  for (const [label, href] of nodeRoutes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`Nodes: ${label} returned ${response.status}`);
    const markdownHref = href === '/nodes/' ? '/nodes.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`Nodes: ${label} Markdown returned ${markdown.status}`);
  }

  await page.goto(`${origin}/start/connect-your-first-agent/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('heading', { name: 'Connect your first agent', level: 1 }).isVisible())) throw new Error('First-agent guide did not render');
  if (!(await page.getByRole('heading', { name: 'What “verified” means', level: 2 }).isVisible())) throw new Error('First-agent verification guidance is missing');
  await page.goto(`${origin}/start/`, { waitUntil: 'networkidle' });

  await page.goto(origin, { waitUntil: 'networkidle' });
  const startCard = page.locator('a.mintlify-card[href="/start/"]');
  await startCard.hover();
  const cardHover = await startCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderWidth: style.borderTopWidth, borderColor: style.borderTopColor, boxShadow: style.boxShadow };
  });
  if (cardHover.borderWidth !== '1px') throw new Error(`Start card hover border is ${cardHover.borderWidth}`);
  if (cardHover.boxShadow !== 'none') throw new Error(`Start card hover has a doubled outline: ${cardHover.boxShadow}`);
  await assertPointerFocusIsQuiet(startCard, 'Start card');
  await page.goto(`${origin}/start/`, { waitUntil: 'networkidle' });

  const markdownResponse = await fetch(`${origin}/start.md`);
  if (!markdownResponse.ok) throw new Error('Markdown endpoint failed');
  const expectedMarkdown = await markdownResponse.text();
  const legacyMarkdown = await fetch(`${origin}/os/concepts/configuration.md`, { redirect: 'manual' });
  if (legacyMarkdown.status !== 308) throw new Error(`Legacy Markdown returned ${legacyMarkdown.status}`);
  if (legacyMarkdown.headers.get('location') !== '/reference/configuration.md') throw new Error('Legacy Markdown redirect points to the wrong route');
  if (await page.locator('.page-actions-menu').isVisible()) throw new Error('Page actions menu is visible before opening details');
  const copyActions = page.locator('.page-actions');
  const copyButton = page.getByRole('button', { name: 'Copy page', exact: true }).first();
  const moreActionsButton = page.getByLabel('More page actions');
  const [copyBox, moreBox] = await Promise.all([copyButton.boundingBox(), moreActionsButton.boundingBox()]);
  if (!copyBox || !moreBox) throw new Error('Could not measure Copy page split control');
  if (Math.abs(copyBox.y - moreBox.y) > 1 || Math.abs(copyBox.height - moreBox.height) > 1) {
    throw new Error(`Copy page split control is vertically misaligned: ${JSON.stringify({ copyBox, moreBox })}`);
  }
  if (Math.abs(copyBox.x + copyBox.width - moreBox.x) > 1) {
    throw new Error(`Copy page split segments do not meet cleanly: ${JSON.stringify({ copyBox, moreBox })}`);
  }
  const normalCopyBackground = await copyButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  await copyButton.click();
  await page.waitForTimeout(100);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (copied !== expectedMarkdown) throw new Error('Copy page did not use canonical Markdown output');
  if ((await copyActions.getAttribute('data-copy-state')) !== 'success') throw new Error('Copy page did not enter success state');
  if (!(await copyActions.locator('.page-action-success-icon').isVisible())) throw new Error('Copy success check icon is not visible');
  if (await copyActions.locator('.page-action-chevron').isVisible()) throw new Error('Copy success did not replace the down arrow');
  const successCopyBackground = await copyButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  if (successCopyBackground === normalCopyBackground) throw new Error('Copy success did not change the button color');
  await page.waitForTimeout(1800);
  if (await copyActions.getAttribute('data-copy-state')) throw new Error('Copy success state did not reset');
  if (!(await copyActions.locator('.page-action-chevron').isVisible())) throw new Error('Copy down arrow did not return after success');

  await page.getByLabel('More page actions').click();
  const actionMenu = page.locator('.page-actions-menu');
  if ((await actionMenu.locator('[data-page-action], a').count()) !== 4) throw new Error('Page action menu must contain four actions');
  for (const description of [
    'Copy page as Markdown for LLMs',
    'Open this page as plain text',
    'Copy this page and open ChatGPT',
    'Copy this page and open Claude',
  ]) {
    if (!(await actionMenu.getByText(description, { exact: true }).isVisible())) throw new Error(`Missing page-action description: ${description}`);
  }
  if ((await actionMenu.locator('.page-action-icon').count()) !== 4) throw new Error('Every menu action must have an icon');
  const markdownLink = page.getByRole('link', { name: /View as Markdown/ });
  if ((await markdownLink.getAttribute('href')) !== '/start.md') throw new Error('View as Markdown points to the wrong route');
  await page.keyboard.press('Escape');
  if (await page.locator('.page-actions details').evaluate((element) => element.open)) throw new Error('Escape did not close the action menu');

  const paragraphWidth = await page.locator('.sl-markdown-content p').first().evaluate((element) => element.getBoundingClientRect().width);
  if (paragraphWidth > 700) throw new Error(`Prose measure is too wide: ${paragraphWidth}px`);

  const providerLinks = {
    'Open in ChatGPT': 'https://chatgpt.com/',
    'Open in Claude': 'https://claude.ai/new',
  };
  await page.getByLabel('More page actions').click();
  for (const [label, href] of Object.entries(providerLinks)) {
    const link = page.getByRole('link', { name: label });
    if ((await link.getAttribute('href')) !== href) throw new Error(`${label} points to the wrong web app`);
    if ((await link.getAttribute('target')) !== '_blank') throw new Error(`${label} must open on the web`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/build/tools/how-tools-work/`, { waitUntil: 'networkidle' });
  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  for (const label of ['Tools', 'How tools work']) {
    if (!(await breadcrumbs.getByText(label, { exact: true }).isVisible())) throw new Error(`Missing breadcrumb: ${label}`);
  }
  if ((await breadcrumbs.getByText('Build with OS', { exact: true }).count()) !== 0) throw new Error('Build with OS must not remain in promoted breadcrumbs');

  const toolManifest = JSON.parse(readFileSync(new URL('../../os/manifests/generated/tool.manifest.json', import.meta.url), 'utf8'));
  const expectedToolNames = toolManifest.tools.map((tool) => tool.name).filter(Boolean).sort((left, right) => left.localeCompare(right));
  await page.goto(`${origin}/tools/tool-list/`, { waitUntil: 'networkidle' });
  const toolTocLabels = (await page.locator('starlight-toc a').allTextContents()).map((label) => label.trim());
  const missingToolTocEntries = expectedToolNames.filter((name) => !toolTocLabels.includes(name));
  if (missingToolTocEntries.length !== 0) throw new Error(`Tool List TOC is missing ${missingToolTocEntries.length} tools: ${missingToolTocEntries.slice(0, 5).join(', ')}`);
  await page.goto(`${origin}/build/tools/how-tools-work/`, { waitUntil: 'networkidle' });
  const siteFooter = page.locator('[data-docs-site-footer]');
  if ((await siteFooter.count()) !== 1) throw new Error('Missing dedicated site footer');
  const siteFooterPlacement = await siteFooter.evaluate((element) => ({
    parentIsPage: element.parentElement?.classList.contains('page') ?? false,
    previousIsMainFrame: element.previousElementSibling?.classList.contains('main-frame') ?? false,
    rect: element.getBoundingClientRect(),
    viewportWidth: document.documentElement.clientWidth,
  }));
  if (!siteFooterPlacement.parentIsPage || !siteFooterPlacement.previousIsMainFrame) {
    throw new Error('Desktop site footer must be a page-level section after the documentation shell');
  }
  if (Math.abs(siteFooterPlacement.rect.left) > 1 || Math.abs(siteFooterPlacement.rect.width - siteFooterPlacement.viewportWidth) > 2) {
    throw new Error(`Desktop site footer is not full width: ${JSON.stringify(siteFooterPlacement)}`);
  }

  const shellStyles = await page.evaluate(() => ({
    headerPosition: getComputedStyle(document.querySelector('.header')).position,
    leftPosition: getComputedStyle(document.querySelector('.sidebar-pane')).position,
    rightPosition: getComputedStyle(document.querySelector('.right-sidebar')).position,
    nestedGuideWidth: getComputedStyle(document.querySelector('#starlight__sidebar ul ul li')).borderInlineStartWidth,
  }));
  if (shellStyles.headerPosition !== 'fixed') throw new Error(`Header is ${shellStyles.headerPosition}, not fixed`);
  if (shellStyles.leftPosition !== 'sticky') throw new Error(`Left sidebar is ${shellStyles.leftPosition}, not sticky`);
  if (shellStyles.rightPosition !== 'sticky') throw new Error(`Right sidebar is ${shellStyles.rightPosition}, not sticky`);
  if (shellStyles.nestedGuideWidth !== '0px') throw new Error(`Nested sidebar guide remains ${shellStyles.nestedGuideWidth}`);

  const registry = page.locator('.docs-registry-grid');
  if ((await registry.locator('.docs-registry-column').count()) !== 11) throw new Error('Footer registry must contain eleven sections');
  const desktopColumns = await registry.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  if (desktopColumns !== 7) throw new Error(`Footer registry must use seven desktop columns, found ${desktopColumns}`);
  const lastHeadingY = await page.locator('#tools-skills-and-scripts').evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  );
  for (let scrollY = 0; scrollY <= lastHeadingY; scrollY += 200) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), scrollY);
    await page.waitForTimeout(60);
  }
  await page.evaluate((nextY) => window.scrollTo(0, nextY), lastHeadingY);
  await page.waitForTimeout(250);
  const siteFooterY = await siteFooter.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((nextY) => window.scrollTo(0, nextY), siteFooterY);
  await page.waitForTimeout(250);
  const footerBoundary = await page.evaluate(() => {
    const footer = document.querySelector('[data-docs-site-footer]')?.getBoundingClientRect();
    const left = document.querySelector('.sidebar-pane')?.getBoundingClientRect();
    const right = document.querySelector('.right-sidebar')?.getBoundingClientRect();
    return { footerTop: footer?.top, leftBottom: left?.bottom, rightBottom: right?.bottom };
  });
  if (footerBoundary.footerTop === undefined || footerBoundary.leftBottom === undefined || footerBoundary.rightBottom === undefined) {
    throw new Error(`Could not measure footer boundary: ${JSON.stringify(footerBoundary)}`);
  }
  if (footerBoundary.leftBottom > footerBoundary.footerTop + 2 || footerBoundary.rightBottom > footerBoundary.footerTop + 2) {
    throw new Error(`Sticky documentation navigation overlaps the site footer: ${JSON.stringify(footerBoundary)}`);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  const currentToc = page.locator('starlight-toc a[aria-current="true"]');
  if ((await currentToc.textContent())?.trim() !== 'Tools, skills, and scripts') throw new Error(`Final TOC item was not selected at page end: ${(await currentToc.textContent())?.trim()}`);

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/start/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    const responsiveCopyButton = page.getByRole('button', { name: 'Copy page', exact: true }).first();
    const responsiveMoreButton = page.getByLabel('More page actions');
    if (!(await responsiveCopyButton.isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if ((await page.locator('main h1#_top').count()) !== 1) throw new Error(`Missing page title on ${viewport.name}`);
    const [responsiveCopyBox, responsiveMoreBox] = await Promise.all([responsiveCopyButton.boundingBox(), responsiveMoreButton.boundingBox()]);
    if (!responsiveCopyBox || !responsiveMoreBox) throw new Error(`Could not measure Copy page on ${viewport.name}`);
    if (Math.abs(responsiveCopyBox.y - responsiveMoreBox.y) > 1 || Math.abs(responsiveCopyBox.height - responsiveMoreBox.height) > 1) {
      throw new Error(`Copy page split control is misaligned on ${viewport.name}: ${JSON.stringify({ responsiveCopyBox, responsiveMoreBox })}`);
    }

    if ((await page.locator('#starlight__mobile-toc').count()) !== 0) throw new Error(`Legacy mobile TOC row is still rendered on ${viewport.name}`);
    const tocTrigger = page.getByRole('button', { name: 'On this page', exact: true });
    if (!(await tocTrigger.isVisible())) throw new Error(`On this page trigger is hidden on ${viewport.name}`);
    await tocTrigger.click();
    const tocSheet = page.locator('[data-docs-mobile-toc-sheet]');
    await tocSheet.waitFor({ state: 'visible' });
    if ((await page.locator('body').getAttribute('data-docs-toc-open')) === null) throw new Error(`TOC sheet did not lock scroll on ${viewport.name}`);
    const tocPanel = page.locator('[data-docs-mobile-toc-panel]');
    const tocPanelBox = await tocPanel.boundingBox();
    if (!tocPanelBox || Math.abs(tocPanelBox.x) > 2 || Math.abs(tocPanelBox.width - viewport.width) > 3) {
      throw new Error(`TOC sheet is not full-width on ${viewport.name}: ${JSON.stringify(tocPanelBox)}`);
    }
    await page.keyboard.press('Escape');
    await tocSheet.waitFor({ state: 'hidden' });

    const titleLabel = page.locator('.consuelo-site-title-label');
    if (viewport.name === 'mobile' && await titleLabel.isVisible()) throw new Error('Mobile header still shows the Consuelo OS wordmark');
    if (viewport.name === 'tablet' && !(await titleLabel.isVisible())) throw new Error('Tablet header unexpectedly hides the Consuelo OS wordmark');

    const footerIsNested = await page.locator('[data-docs-site-footer]').evaluate(
      (element) => element.parentElement?.hasAttribute('data-docs-site-footer-home') ?? false,
    );
    if (!footerIsNested) throw new Error(`${viewport.name} site footer must remain inside the page footer`);
    const mobileColumns = await page.locator('.docs-registry-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
    if (mobileColumns !== 2) throw new Error(`Footer registry must use two ${viewport.name} columns, found ${mobileColumns}`);

    const browseTrigger = page.getByRole('button', { name: 'Browse documentation' });
    if (!(await browseTrigger.isVisible())) throw new Error(`Browse trigger is hidden on ${viewport.name}`);
    await browseTrigger.click();
    const browseOverlay = page.locator('[data-docs-browse-overlay]');
    await browseOverlay.waitFor({ state: 'visible' });
    const browseBox = await browseOverlay.boundingBox();
    if (!browseBox || Math.abs(browseBox.x) > 1 || Math.abs(browseBox.y) > 1 || Math.abs(browseBox.width - viewport.width) > 2 || Math.abs(browseBox.height - viewport.height) > 2) {
      throw new Error(`Browse overlay is not full-screen on ${viewport.name}: ${JSON.stringify(browseBox)}`);
    }
    if ((await page.getByText('Ask AI', { exact: true }).count()) !== 0) throw new Error('Browse overlay must not include Ask AI');
    const browseLinks = {
      Changelog: 'https://consuelohq.com/changelog',
      Blog: 'https://consuelohq.com/blog',
      Community: 'https://discord.gg/87YtkVUBvc',
      Templates: '/build/skills/bundled/',
      'Getting started': 'https://os.consuelohq.com/',
      'Sign up': 'https://os.consuelohq.com/',
      'Log in': 'https://os.consuelohq.com/',
    };
    for (const [label, href] of Object.entries(browseLinks)) {
      const link = browseOverlay.getByRole('link', { name: label, exact: true });
      if ((await link.getAttribute('href')) !== href) throw new Error(`${label} browse link points to ${(await link.getAttribute('href'))}`);
    }
    for (const label of ['Changelog', 'Blog', 'Community']) {
      if ((await browseOverlay.getByRole('link', { name: label, exact: true }).getAttribute('target')) !== '_blank') throw new Error(`${label} must open outside docs`);
    }
    await page.keyboard.press('Escape');
    await browseOverlay.waitFor({ state: 'hidden' });

    const menuButton = page.locator('button[aria-controls="starlight__sidebar"]');
    const menuStyle = await menuButton.evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      borderWidth: getComputedStyle(element).borderTopWidth,
      boxShadow: getComputedStyle(element).boxShadow,
    }));
    if (menuStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' || menuStyle.borderWidth !== '0px' || menuStyle.boxShadow !== 'none') {
      throw new Error(`Menu button still has boxed chrome on ${viewport.name}: ${JSON.stringify(menuStyle)}`);
    }
    await menuButton.click();
    const responsiveSidebarPane = page.locator('#starlight__sidebar');
    await responsiveSidebarPane.waitFor({ state: 'visible' });
    await page.waitForTimeout(450);
    if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error(`Section navigation is unavailable on ${viewport.name}`);
    const sidebarSearch = responsiveSidebarPane.getByRole('button', { name: 'Search Docs', exact: true });
    if (!(await sidebarSearch.isVisible())) throw new Error(`Search Docs box is missing from ${viewport.name} sidebar`);
    const sidebarBox = await responsiveSidebarPane.boundingBox();
    const expectedSidebarWidth = viewport.name === 'tablet' ? viewport.width / 2 : viewport.width;
    if (!sidebarBox || Math.abs(sidebarBox.width - expectedSidebarWidth) > 3) {
      throw new Error(`${viewport.name} sidebar width is wrong: ${JSON.stringify(sidebarBox)}`);
    }
    await sidebarSearch.click();
    const searchDialog = page.locator('site-search dialog');
    await searchDialog.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await searchDialog.waitFor({ state: 'hidden' });
    await responsiveSidebarPane.waitFor({ state: 'hidden' });

    await page.goto(origin, { waitUntil: 'networkidle' });
    const globalMenuButton = page.locator('button[aria-controls="starlight__sidebar"]');
    await globalMenuButton.click();
    await page.waitForTimeout(450);
    const mobileSidebar = page.locator('#starlight__sidebar .global-sidebar-mobile');
    if (!(await mobileSidebar.isVisible())) throw new Error(`${viewport.name} accordion navigation is not visible`);
    const mobileGlobalLabels = (await mobileSidebar.locator(':scope > ul > li > details > summary').allTextContents()).map((label) => label.trim());
    const expectedGlobalLabels = ['Start', 'Connect', 'Nodes', 'Tools', 'Sites', 'Skills', 'Steering', 'Memory', 'Observe', 'Secure', 'Reference'];
    if (JSON.stringify(mobileGlobalLabels) !== JSON.stringify(expectedGlobalLabels)) {
      throw new Error(`${viewport.name} global navigation order is wrong: ${JSON.stringify(mobileGlobalLabels)}`);
    }
    const startDetails = mobileSidebar.locator(':scope > ul > li > details').filter({ has: page.locator('summary', { hasText: 'Start' }) }).first();
    const urlBeforeToggle = page.url();
    await startDetails.locator(':scope > summary').click();
    if (page.url() !== urlBeforeToggle) throw new Error(`Tapping a ${viewport.name} top-level section navigated instead of toggling`);
    if (!(await startDetails.evaluate((element) => element.open))) throw new Error(`Tapping Start did not expand the ${viewport.name} section`);
    if (!(await startDetails.getByRole('link', { name: 'Overview', exact: true }).isVisible())) throw new Error(`Expanded Start section does not reveal its overview link on ${viewport.name}`);

    const mobilePreferences = page.locator('[data-docs-mobile-preferences]');
    const githubLink = mobilePreferences.getByRole('link', { name: 'GitHub' });
    const mobileThemeToggle = mobilePreferences.locator('[data-docs-theme-toggle]');
    if (!(await githubLink.isVisible()) || !(await mobileThemeToggle.isVisible())) throw new Error(`GitHub and display controls must both be visible in the ${viewport.name} footer`);
    const [githubBox, themeBox] = await Promise.all([githubLink.boundingBox(), mobileThemeToggle.boundingBox()]);
    if (!githubBox || !themeBox) throw new Error(`Could not measure the ${viewport.name} footer controls`);
    if (Math.abs((githubBox.y + githubBox.height / 2) - (themeBox.y + themeBox.height / 2)) > 8) throw new Error(`GitHub and display controls are not aligned on ${viewport.name}`);
    if (themeBox.x <= githubBox.x) throw new Error(`Display control must sit to the right of GitHub on ${viewport.name}`);
    if ((await mobilePreferences.locator('select').count()) !== 0) throw new Error(`${viewport.name} footer must not contain language or theme dropdowns`);
    await page.keyboard.press('Escape');
    await page.locator('#starlight__sidebar').waitFor({ state: 'hidden' });
    viewportChecks.push({ name: viewport.name, overflow });
  }

  const translationContext = await browser.newContext({ locale: 'es-ES' });
  const translationPage = await translationContext.newPage();
  let translationRequestUrl = null;
  let translationRequestCount = 0;
  await translationPage.route('**/api/docs/translate?*', async (route) => {
    try {
      translationRequestCount += 1;
      translationRequestUrl = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          cached: false,
          provider: 'google',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          route: '/start/',
          contentHash: 'browser-test',
          cacheKey: 'browser-test:es',
          title: 'Inicio',
          description: null,
          segments: ['Contenido traducido de prueba.'],
        }),
      });
    } catch (error) {
      throw new Error('Failed to stub automatic translation', { cause: error });
    }
  });
  await translationPage.goto(`${origin}/start/`, { waitUntil: 'networkidle' });
  await translationPage.locator('[data-docs-runtime-translation-panel]').waitFor({ state: 'visible' });
  if (!translationRequestUrl || translationRequestUrl.searchParams.get('lang') !== 'es') throw new Error(`Browser locale did not request Spanish translation: ${translationRequestUrl}`);
  if (translationRequestCount !== 1) throw new Error(`Automatic translation made ${translationRequestCount} requests for one page load`);
  if ((await translationPage.locator('html').getAttribute('lang')) !== 'es') throw new Error('Translated page did not update the document language');
  if ((await translationPage.locator('html').getAttribute('data-docs-translation-state')) !== 'ready') throw new Error('Automatic translation did not reach the ready state');
  if (!(await translationPage.getByText('Contenido traducido de prueba.', { exact: true }).isVisible())) throw new Error('Automatic translation payload was not rendered');
  if ((await translationPage.getByLabel('Translate this page').count()) !== 0) throw new Error('Automatic translation must not expose a translate selector');
  if ((await translationPage.getByRole('button', { name: /Show English|Dismiss/ }).count()) !== 0) throw new Error('Automatic translation must not expose a manual clear button');
  await translationContext.close();

  process.stdout.write(`${JSON.stringify({ ok: true, globalLinks: globalCount, markdownBytes: expectedMarkdown.length, paragraphWidth, viewportChecks, automaticTranslation: 'es' }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
