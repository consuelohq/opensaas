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
  ['Bring your own', '/connect/agents/create-your-own/'],
  ['Applications', '/connect/apps-and-services/'],
  ['Cloudflare', '/connect/apps-and-services/cloudflare/'],
  ['Datadog', '/connect/apps-and-services/datadog/'],
  ['GitHub', '/connect/apps-and-services/github/'],
  ['Gmail', '/connect/apps-and-services/gmail/'],
  ['GoHighLevel', '/connect/apps-and-services/gohighlevel/'],
  ['Google Calendar', '/connect/apps-and-services/google-calendar/'],
  ['Google Drive', '/connect/apps-and-services/google-drive/'],
  ['Google Workspace', '/connect/apps-and-services/google-workspace/'],
  ['HubSpot', '/connect/apps-and-services/hubspot/'],
  ['LeadConnector dialer', '/connect/apps-and-services/leadconnector-dialer/'],
  ['Linear', '/connect/apps-and-services/linear/'],
  ['Notion', '/connect/apps-and-services/notion/'],
  ['Railway', '/connect/apps-and-services/railway/'],
  ['Salesforce', '/connect/apps-and-services/salesforce/'],
  ['Sentry', '/connect/apps-and-services/sentry/'],
  ['Slack', '/connect/apps-and-services/slack/'],
  ['Snowflake', '/connect/apps-and-services/snowflake/'],
  ['Stripe', '/connect/apps-and-services/stripe/'],
  ['Supabase', '/connect/apps-and-services/supabase/'],
  ['Twilio', '/connect/apps-and-services/twilio/'],
  ['Vercel', '/connect/apps-and-services/vercel/'],
  ['Bring your own', '/connect/apps-and-services/create-your-own/'],
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
  const expectedGroups = 3;
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
    const isGroupOverview = href === '/connect/apps-and-services/';
    if (!isGroupOverview && (await sidebar.getByRole('link', { name: label, exact: true }).count()) < 1) throw new Error(`${label} is missing from Connect navigation`);
  }

  await page.goto(`${origin}/connect/apps-and-services/google-workspace/`, { waitUntil: 'networkidle' });
  if (!(await page.getByText('openclaw/gogcli', { exact: false }).first().isVisible())) throw new Error('Google Workspace gog guidance is missing');
  if (!(await page.getByText('Native Consuelo tool: Planned', { exact: false }).first().isVisible())) throw new Error('Google Workspace planned status is missing');
  if (!(await sidebar.getByRole('link', { name: 'Google Workspace', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Google Workspace current');

  await page.goto(`${origin}/connect/apps-and-services/railway/`, { waitUntil: 'networkidle' });
  if (!(await page.getByText('deployment.logs', { exact: false }).first().isVisible())) throw new Error('Railway canonical deployment guidance is missing');

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
      if (!(await page.locator('#starlight__sidebar').getByRole('link', { name: 'Bring your own', exact: true }).last().isVisible())) throw new Error('Applications Bring your own navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, groups: expectedGroups, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
