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
  ['Secure', '/secure/'],
  ['Security model', '/secure/security-model/'],
  ['Access and permissions', '/secure/access-and-permissions/'],
  ['Credentials', '/secure/credentials/'],
  ['Approvals', '/secure/approvals/'],
  ['Nodes and network access', '/secure/nodes-and-network-access/'],
  ['Tailscale', '/secure/tailscale/'],
  ['Hosted MCP ingress', '/secure/hosted-mcp-ingress/'],
  ['Security reference', '/secure/security-reference/'],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/secure/`);
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
  await page.goto(`${origin}/secure/`, { waitUntil: 'networkidle' });

  if (!(await page.getByRole('heading', { name: 'Secure', level: 1 }).isVisible())) throw new Error('Secure overview did not render');
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Secure sidebar is missing its back link');

  const sidebar = page.locator('#starlight__sidebar');
  const groups = sidebar.locator('details');
  if ((await groups.count()) !== 1) throw new Error(`Expected one expanded Secure group, found ${await groups.count()}`);
  if (!(await groups.first().evaluate((element) => element.open))) throw new Error('Secure navigation started collapsed');

  for (const [label, href] of routes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${href} returned ${response.status}`);
    const markdownHref = href === '/secure/' ? '/secure.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`${markdownHref} returned ${markdown.status}`);
    const markdownText = await markdown.text();
    if (!markdownText.includes(`# ${label}`)) throw new Error(`${markdownHref} is missing its page heading`);
    const navLabel = label === 'Secure' ? 'Overview' : label;
    if ((await sidebar.getByRole('link', { name: navLabel, exact: true }).count()) < 1) throw new Error(`${label} is missing from Secure navigation`);
  }

  const contentChecks = [
    ['/secure/security-model/', 'static Sites snapshot'],
    ['/secure/access-and-permissions/', 'UNKNOWN_TOOL_SCOPE'],
    ['/secure/credentials/', 'MCP_BEARER_TOKEN'],
    ['/secure/approvals/', 'device public key'],
    ['/secure/nodes-and-network-access/', '127.0.0.1:46321'],
    ['/secure/tailscale/', 'private Tailnet'],
    ['/secure/hosted-mcp-ingress/', 'route:/mcp:read'],
    ['/secure/security-reference/', 'REPLAYED_NONCE'],
  ];
  for (const [href, text] of contentChecks) {
    await page.goto(`${origin}${href}`, { waitUntil: 'networkidle' });
    if (!(await page.getByText(text, { exact: false }).first().isVisible())) throw new Error(`${href} is missing verified text: ${text}`);
  }

  await page.goto(`${origin}/secure/hosted-mcp-ingress/`, { waitUntil: 'networkidle' });
  if (!(await sidebar.getByRole('link', { name: 'Hosted MCP ingress', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Hosted MCP ingress current');

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/secure/security-reference/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if (viewport.name === 'mobile') {
      await page.locator('button[aria-controls="starlight__sidebar"]').click();
      if (!(await page.getByRole('link', { name: 'Hosted MCP ingress', exact: true }).isVisible())) throw new Error('Secure navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, groups: 1, port, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
