import {
  launchDocumentationBrowser,
  startDocumentationServer,
  stopDocumentationServer,
} from './lib/documentation-browser-test.mjs';
import net from 'node:net';

const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    const selected = typeof address === 'object' && address ? address.port : 4331;
    probe.close((error) => error ? reject(error) : resolve(selected));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = startDocumentationServer({ port });
let output = '';
server.stdout.on('data', (chunk) => (output += chunk));
server.stderr.on('data', (chunk) => (output += chunk));

const routes = [
  ['Sites', '/sites/'],
  ['Create a site', '/sites/create-a-site/'],
  ['Pages and content', '/sites/pages-and-content/'],
  ['Preview locally', '/sites/preview-locally/'],
  ['Publish', '/sites/publish/'],
  ['Domains', '/sites/domains/'],
  ['Troubleshooting', '/sites/troubleshooting/'],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/sites/`);
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${origin}/sites/`, { waitUntil: 'networkidle' });

  if (!(await page.getByRole('heading', { name: 'Sites', level: 1 }).isVisible())) throw new Error('Sites overview did not render');
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Sites sidebar is missing its back link');

  const sidebar = page.locator('#starlight__sidebar');
  const groups = sidebar.locator('details');
  if ((await groups.count()) !== 2) throw new Error(`Expected Tools plus nested Sites groups, found ${await groups.count()}`);
  for (let index = 0; index < await groups.count(); index += 1) {
    if (!(await groups.nth(index).evaluate((element) => element.open))) throw new Error('Sites navigation started collapsed');
  }

  for (const [label, href] of routes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${href} returned ${response.status}`);
    const markdownHref = href === '/sites/' ? '/sites.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`${markdownHref} returned ${markdown.status}`);
    const markdownText = await markdown.text();
    if (!markdownText.includes(`# ${label}`)) throw new Error(`${markdownHref} is missing its page heading`);
    if ((await sidebar.getByRole('link', { name: label === 'Sites' ? 'Overview' : label, exact: true }).count()) < 1) {
      throw new Error(`${label} is missing from Sites navigation`);
    }
  }

  const contentChecks = [
    ['/sites/create-a-site/', 'There is no standalone'],
    ['/sites/pages-and-content/', 'SECTION_CONFLICT'],
    ['/sites/publish/', 'STALE_SITES_PUBLISH'],
    ['/sites/domains/', 'not currently self-service'],
    ['/sites/troubleshooting/', 'CONSUELO_HOME'],
  ];
  for (const [href, text] of contentChecks) {
    await page.goto(`${origin}${href}`, { waitUntil: 'networkidle' });
    if (!(await page.getByText(text, { exact: false }).first().isVisible())) throw new Error(`${href} is missing verified boundary text: ${text}`);
  }

  await page.goto(`${origin}/sites/domains/`, { waitUntil: 'networkidle' });
  if (!(await sidebar.getByRole('link', { name: 'Domains', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Domains current');

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/sites/pages-and-content/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if (viewport.name === 'mobile') {
      await page.locator('button[aria-controls="starlight__sidebar"]').click();
      if (!(await page.locator('#starlight__sidebar').getByRole('link', { name: 'Troubleshooting', exact: true }).isVisible())) throw new Error('Sites navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, groups: 2, port, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
