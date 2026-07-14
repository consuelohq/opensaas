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
    const selected = typeof address === 'object' && address ? address.port : 4332;
    probe.close((error) => error ? reject(error) : resolve(selected));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = startDocumentationServer({ port, force: true });
let output = '';
server.stdout.on('data', (chunk) => (output += chunk));
server.stderr.on('data', (chunk) => (output += chunk));

const routes = [
  ['Reference', '/reference/'],
  ['CLI', '/reference/cli/'],
  ['Configuration', '/reference/configuration/'],
  ['MCP', '/reference/mcp/'],
  ['Tools', '/reference/tools/'],
  ['Skills and manifests', '/reference/skills-and-manifests/'],
  ['Result and error formats', '/reference/result-and-error-formats/'],
  ['Environment variables', '/reference/environment-variables/'],
  ['URLs and ports', '/reference/urls-and-ports/'],
  ['Glossary', '/reference/glossary/'],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/reference/`);
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
  await page.goto(`${origin}/reference/`, { waitUntil: 'networkidle' });

  if (!(await page.getByRole('heading', { name: 'Reference', level: 1 }).isVisible())) throw new Error('Reference overview did not render');
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Reference sidebar is missing its back link');

  const sidebar = page.locator('#starlight__sidebar');
  const groups = sidebar.locator('details');
  if ((await groups.count()) !== 1) throw new Error(`Expected one expanded Reference group, found ${await groups.count()}`);
  if (!(await groups.first().evaluate((element) => element.open))) throw new Error('Reference navigation started collapsed');

  for (const [label, href] of routes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${href} returned ${response.status}`);
    const markdownHref = href === '/reference/' ? '/reference.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`${markdownHref} returned ${markdown.status}`);
    const markdownText = await markdown.text();
    if (!markdownText.includes(`# ${label}`)) throw new Error(`${markdownHref} is missing its page heading`);
    const navLabel = label === 'Reference' ? 'Overview' : label;
    if ((await sidebar.getByRole('link', { name: navLabel, exact: true }).count()) < 1) throw new Error(`${label} is missing from Reference navigation`);
  }

  const contentChecks = [
    ['/reference/cli/', 'bun ./scripts/os.ts'],
    ['/reference/configuration/', 'manifest.overlay.json'],
    ['/reference/mcp/', '2024-11-05'],
    ['/reference/tools/', 'sessionRequired'],
    ['/reference/skills-and-manifests/', 'consuelo-os-core-manifest'],
    ['/reference/result-and-error-formats/', 'TASK_SESSION_REQUIRED'],
    ['/reference/environment-variables/', 'CONSUELO_WORKSPACE_CONFIG'],
    ['/reference/urls-and-ports/', '127.0.0.1:46321'],
    ['/reference/glossary/', 'Static snapshot'],
  ];
  for (const [href, text] of contentChecks) {
    await page.goto(`${origin}${href}`, { waitUntil: 'networkidle' });
    if (!(await page.getByText(text, { exact: false }).first().isVisible())) throw new Error(`${href} is missing verified text: ${text}`);
  }

  await page.goto(`${origin}/reference/environment-variables/`, { waitUntil: 'networkidle' });
  if (!(await sidebar.getByRole('link', { name: 'Environment variables', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Environment variables current');

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/reference/result-and-error-formats/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if (viewport.name === 'mobile') {
      await page.locator('button[aria-controls="starlight__sidebar"]').click();
      if (!(await page.getByRole('link', { name: 'Environment variables', exact: true }).isVisible())) throw new Error('Reference navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, groups: 1, port, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
