import {
  launchDocumentationBrowser,
  startDocumentationServer,
  stopDocumentationServer,
} from './lib/documentation-browser-test.mjs';

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
  const globalGroups = page.locator('#starlight__sidebar ul.top-level > li > details');
  const globalCount = await globalGroups.count();
  if (globalCount !== 7) throw new Error(`Expected 7 global sidebar groups, found ${globalCount}`);
  for (let index = 0; index < globalCount; index += 1) {
    if (await globalGroups.nth(index).evaluate((element) => element.open)) throw new Error('Global sidebar group started expanded');
  }

  await page.goto(`${origin}/start/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Missing All documentation link');
  const localGroups = page.locator('#starlight__sidebar details');
  if ((await localGroups.count()) !== 1) throw new Error('Section sidebar must show one group');
  if (!(await localGroups.first().evaluate((element) => element.open))) throw new Error('Section sidebar must start expanded');

  const startRoutes = [
    ['Overview', '/start/'],
    ['Install Consuelo OS', '/start/install-consuelo-os/'],
    ['Create a workspace', '/start/create-a-workspace/'],
    ['Connect your first agent', '/start/connect-your-first-agent/'],
    ['Local and Consuelo Cloud', '/start/local-and-consuelo-cloud/'],
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

  await page.goto(`${origin}/start/connect-your-first-agent/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('heading', { name: 'Connect your first agent', level: 1 }).isVisible())) throw new Error('First-agent guide did not render');
  if (!(await page.getByRole('heading', { name: 'What “verified” means', level: 2 }).isVisible())) throw new Error('First-agent verification guidance is missing');
  await page.goto(`${origin}/start/`, { waitUntil: 'networkidle' });

  const markdownResponse = await fetch(`${origin}/start.md`);
  if (!markdownResponse.ok) throw new Error('Markdown endpoint failed');
  const expectedMarkdown = await markdownResponse.text();
  const legacyMarkdown = await fetch(`${origin}/os/concepts/configuration.md`, { redirect: 'manual' });
  if (legacyMarkdown.status !== 308) throw new Error(`Legacy Markdown returned ${legacyMarkdown.status}`);
  if (legacyMarkdown.headers.get('location') !== '/reference/configuration.md') throw new Error('Legacy Markdown redirect points to the wrong route');
  if (await page.locator('.page-actions-menu').isVisible()) throw new Error('Page actions menu is visible before opening details');
  await page.getByRole('button', { name: 'Copy page' }).click();
  await page.waitForTimeout(100);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (copied !== expectedMarkdown) throw new Error('Copy page did not use canonical Markdown output');

  await page.getByLabel('More page actions').click();
  const markdownLink = page.getByRole('link', { name: 'View as Markdown' });
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

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/start/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if ((await page.locator('main h1#_top').count()) !== 1) throw new Error(`Missing page title on ${viewport.name}`);

    if (viewport.name === 'mobile') {
      const menuButton = page.locator('button[aria-controls="starlight__sidebar"]');
      await menuButton.click();
      if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Section navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, globalGroups: globalCount, markdownBytes: expectedMarkdown.length, paragraphWidth, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
