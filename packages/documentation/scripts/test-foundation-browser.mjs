import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = 4327;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('bun', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url),
  stdio: ['ignore', 'pipe', 'pipe'],
});
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
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();

  await page.goto(origin, { waitUntil: 'networkidle' });
  if ((await page.locator('main h1#_top').count()) !== 1) throw new Error('Homepage must render one page title');
  const globalGroups = page.locator('#starlight__sidebar details');
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

  const markdownResponse = await fetch(`${origin}/start.md`);
  if (!markdownResponse.ok) throw new Error('Markdown endpoint failed');
  const expectedMarkdown = await markdownResponse.text();
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
  server.kill('SIGTERM');
}
