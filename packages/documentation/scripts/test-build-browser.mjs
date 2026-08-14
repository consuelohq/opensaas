import {
  launchDocumentationBrowser,
  startDocumentationServer,
  stopDocumentationServer,
} from './lib/documentation-browser-test.mjs';

const port = 4329;
const origin = `http://127.0.0.1:${port}`;
const server = startDocumentationServer({ port });
let output = '';
server.stdout.on('data', (chunk) => (output += chunk));
server.stderr.on('data', (chunk) => (output += chunk));

const routes = [
  ['Tools', '/tools/'],
  ['Tool List', '/tools/tool-list/'],
  ['Subagents', '/tools/subagents/'],
  ['How tools work', '/build/tools/how-tools-work/'],
  ['Workspace', '/build/tools/workspace/'],
  ['Browser', '/build/tools/browser/'],
  ['Artifacts', '/build/tools/artifacts/'],
  ['Media', '/build/tools/media/'],
  ['Workflows', '/build/workflows/'],
  ['Sites', '/sites/'],
  ['Skills', '/skills/'],
  ['How skills work', '/build/skills/how-skills-work/'],
  ['Install a skill', '/build/skills/install-a-skill/'],
  ['Create a skill', '/build/skills/create-a-skill/'],
  ['Skill structure', '/build/skills/skill-structure/'],
  ['Skill Templates', '/build/skills/bundled/'],
  ['Steering', '/steering/'],
  ['How steering works', '/build/steering/how-steering-works/'],
  ['Workspace steering', '/build/steering/workspace-steering/'],
  ['Project steering', '/build/steering/project-steering/'],
  ['Memory', '/memory/'],
  ['Workpads', '/memory/workpads/'],
  ['Handoffs', '/memory/handoffs/'],
  ['Streams', '/memory/streams/'],
  ['Memory tool and traces', '/memory/saved-memory-and-traces/'],
  ['Shared memory and context', '/build/shared-memory-and-context/'],
  ['Files and artifacts', '/build/files-and-artifacts/'],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/`);
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

  await page.goto(`${origin}/tools/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('heading', { name: 'Tools', level: 1 }).isVisible())) throw new Error('Tools overview did not render');
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Tools sidebar is missing its back link');

  const sidebar = page.locator('#starlight__sidebar');
  const toolGroups = sidebar.locator('details');
  if ((await toolGroups.count()) !== 2) throw new Error(`Expected Tools plus nested Sites groups, found ${await toolGroups.count()}`);
  for (let index = 0; index < await toolGroups.count(); index += 1) {
    if (!(await toolGroups.nth(index).evaluate((element) => element.open))) throw new Error('A Tools navigation group started collapsed');
  }
  for (const label of ['Tool List', 'Subagents', 'Workflows', 'Sites']) {
    if (!(await sidebar.getByText(label, { exact: true }).first().isVisible())) throw new Error(`${label} is missing from Tools navigation`);
  }

  for (const [label, href] of routes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${href} returned ${response.status}`);
    const markdownHref = href.endsWith('/') ? `${href.slice(0, -1)}.md` : `${href}.md`;
    const normalizedMarkdownHref = markdownHref === '/tools.md' || markdownHref === '/skills.md' || markdownHref === '/steering.md' || markdownHref === '/memory.md' || markdownHref === '/sites.md'
      ? markdownHref
      : markdownHref;
    const markdown = await fetch(`${origin}${normalizedMarkdownHref}`);
    if (!markdown.ok) throw new Error(`${normalizedMarkdownHref} returned ${markdown.status}`);
    const markdownText = await markdown.text();
    if (!markdownText.includes(`# ${label}`)) throw new Error(`${normalizedMarkdownHref} is missing its page heading`);
  }

  const legacyBuild = await fetch(`${origin}/build/`);
  if (!legacyBuild.ok) throw new Error(`/build/ returned ${legacyBuild.status}`);
  await page.goto(`${origin}/build/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('heading', { name: 'Workspace capabilities', level: 1 }).isVisible())) throw new Error('Legacy Build compatibility page did not render');
  if (!(await page.getByRole('main').getByRole('link', { name: 'Tools', exact: true }).isVisible())) throw new Error('Legacy Build page does not point to current top-level capabilities');

  const contentChecks = [
    ['/build/tools/how-tools-work/', 'tools.search'],
    ['/tools/subagents/', 'instructionPath'],
    ['/build/skills/install-a-skill/', 'picker shows only skill templates'],
    ['/build/steering/project-steering/', 'does not automatically merge'],
    ['/memory/workpads/', 'task'],
  ];
  for (const [href, text] of contentChecks) {
    await page.goto(`${origin}${href}`, { waitUntil: 'networkidle' });
    if (!(await page.getByText(text, { exact: false }).first().isVisible())) throw new Error(`${href} is missing verified boundary text: ${text}`);
  }

  await page.goto(`${origin}/build/steering/project-steering/`, { waitUntil: 'networkidle' });
  const steeringSidebar = page.locator('#starlight__sidebar');
  if (!(await steeringSidebar.getByRole('link', { name: 'Project steering', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Project steering current');

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/tools/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if (viewport.name === 'mobile') {
      await page.locator('button[aria-controls="starlight__sidebar"]').click();
      const mobileSidebar = page.locator('#starlight__sidebar');
      for (const label of ['Subagents', 'Workflows', 'Sites']) {
        if (!(await mobileSidebar.getByText(label, { exact: true }).first().isVisible())) throw new Error(`${label} is unavailable in mobile Tools navigation`);
      }
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
