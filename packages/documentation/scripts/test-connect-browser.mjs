import {
  launchDocumentationBrowser,
  startDocumentationServer,
  stopDocumentationServer,
} from './lib/documentation-browser-test.mjs';

const port = 4328;
const origin = `http://127.0.0.1:${port}`;
const server = startDocumentationServer({ port });
let output = '';
server.stdout.on('data', (chunk) => (output += chunk));
server.stderr.on('data', (chunk) => (output += chunk));

const routes = [
  ['Overview', '/connect/'],
  ['ChatGPT', '/connect/agents/chatgpt/'],
  ['Codex', '/connect/agents/codex/'],
  ['Claude Code', '/connect/agents/claude-code/'],
  ['Cursor', '/connect/agents/cursor/'],
  ['OpenCode', '/connect/agents/opencode/'],
  ['Gemini', '/connect/agents/gemini/'],
  ['Other agents', '/connect/agents/other-agents/'],
  ['How nodes work', '/connect/nodes/how-nodes-work/'],
  ['Home node', '/connect/nodes/home-node/'],
  ['Local nodes', '/connect/nodes/local-nodes/'],
  ['Cloud nodes', '/connect/nodes/cloud-nodes/'],
  ['Apps and services', '/connect/apps-and-services/'],
  ['Google Workspace', '/connect/apps-and-services/google-workspace/'],
  ['Gmail', '/connect/apps-and-services/gmail/'],
  ['Google Drive', '/connect/apps-and-services/google-drive/'],
  ['Google Calendar', '/connect/apps-and-services/google-calendar/'],
  ['Slack', '/connect/apps-and-services/slack/'],
  ['Notion', '/connect/apps-and-services/notion/'],
  ['GitHub', '/connect/apps-and-services/github/'],
  ['Linear', '/connect/apps-and-services/linear/'],
  ['Cloudflare', '/connect/apps-and-services/cloudflare/'],
  ['Railway', '/connect/apps-and-services/railway/'],
  ['Vercel', '/connect/apps-and-services/vercel/'],
  ['Datadog', '/connect/apps-and-services/datadog/'],
  ['Sentry', '/connect/apps-and-services/sentry/'],
  ['Snowflake', '/connect/apps-and-services/snowflake/'],
  ['Supabase', '/connect/apps-and-services/supabase/'],
  ['GoHighLevel', '/connect/apps-and-services/gohighlevel/'],
  ['Salesforce', '/connect/apps-and-services/salesforce/'],
  ['HubSpot', '/connect/apps-and-services/hubspot/'],
  ['Stripe', '/connect/apps-and-services/stripe/'],
  ['Twilio', '/connect/apps-and-services/twilio/'],
  ['Additional services', '/connect/apps-and-services/additional-services/'],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/connect/`);
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

  await page.goto(`${origin}/connect/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('heading', { name: 'Connect', level: 1 }).isVisible())) throw new Error('Connect overview did not render');
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Connect sidebar is missing its back link');

  const sidebar = page.locator('#starlight__sidebar');
  const groups = sidebar.locator('details');
  const expectedGroups = 11;
  if ((await groups.count()) !== expectedGroups) throw new Error(`Expected ${expectedGroups} expanded Connect groups, found ${await groups.count()}`);
  for (let index = 0; index < await groups.count(); index += 1) {
    if (!(await groups.nth(index).evaluate((element) => element.open))) throw new Error('A Connect navigation group started collapsed');
  }

  for (const [label, href] of routes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${href} returned ${response.status}`);
    const markdownHref = href === '/connect/' ? '/connect.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`${markdownHref} returned ${markdown.status}`);
    const markdownText = await markdown.text();
    if (!markdownText.includes(`# ${label === 'Overview' ? 'Connect' : label}`)) throw new Error(`${markdownHref} is missing its page heading`);
    const navLabel = href === '/connect/' || href === '/connect/apps-and-services/' ? 'Overview' : label;
    if ((await sidebar.getByRole('link', { name: navLabel, exact: true }).count()) < 1) throw new Error(`${label} is missing from Connect navigation`);
  }

  await page.goto(`${origin}/connect/apps-and-services/google-workspace/`, { waitUntil: 'networkidle' });
  if (!(await page.getByText('openclaw/gogcli', { exact: false }).first().isVisible())) throw new Error('Google Workspace gog guidance is missing');
  if (!(await page.getByText('Native Consuelo tool: Planned', { exact: false }).first().isVisible())) throw new Error('Google Workspace planned status is missing');
  if (!(await sidebar.getByRole('link', { name: 'Google Workspace', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Google Workspace current');

  await page.goto(`${origin}/connect/apps-and-services/railway/`, { waitUntil: 'networkidle' });
  if (!(await page.getByText('railway.logs', { exact: false }).first().isVisible())) throw new Error('Railway partial support guidance is missing');

  await page.goto(`${origin}/connect/nodes/local-nodes/`, { waitUntil: 'networkidle' });
  if (!(await page.getByText('cloudflare-tunnel', { exact: false }).first().isVisible())) throw new Error('Local node transport guidance is missing');

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/connect/apps-and-services/google-workspace/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if (viewport.name === 'mobile') {
      await page.locator('button[aria-controls="starlight__sidebar"]').click();
      if (!(await page.getByRole('link', { name: 'Additional services', exact: true }).isVisible())) throw new Error('Nested Apps and services navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, groups: expectedGroups, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
