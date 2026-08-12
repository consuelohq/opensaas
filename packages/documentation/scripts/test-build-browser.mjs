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
  ['Overview', '/build/'],
  ['How tools work', '/build/tools/how-tools-work/'],
  ['Workspace', '/build/tools/workspace/'],
  ['Browser', '/build/tools/browser/'],
  ['Artifacts', '/build/tools/artifacts/'],
  ['Media', '/build/tools/media/'],
  ['How skills work', '/build/skills/how-skills-work/'],
  ['Install a skill', '/build/skills/install-a-skill/'],
  ['Create a skill', '/build/skills/create-a-skill/'],
  ['Skill structure', '/build/skills/skill-structure/'],
  ['Skill Templates', '/build/skills/bundled/'],
  ['How steering works', '/build/steering/how-steering-works/'],
  ['Workspace steering', '/build/steering/workspace-steering/'],
  ['Project steering', '/build/steering/project-steering/'],
  ['Workflows', '/build/workflows/'],
  ['Shared memory and context', '/build/shared-memory-and-context/'],
  ['Files and artifacts', '/build/files-and-artifacts/'],
  ['Approvals', '/build/approvals/'],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/build/`);
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

  await page.goto(`${origin}/build/`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('heading', { name: 'Build with OS', level: 1 }).isVisible())) throw new Error('Build with OS overview did not render');
  if (!(await page.getByRole('link', { name: 'All documentation' }).isVisible())) throw new Error('Build sidebar is missing its back link');

  const sidebar = page.locator('#starlight__sidebar');
  const groups = sidebar.locator('details');
  if ((await groups.count()) !== 5) throw new Error(`Expected Build plus Tools, Skills, Skill Templates, and Steering groups, found ${await groups.count()}`);
  if (!(await sidebar.getByText('Skill Templates', { exact: true }).isVisible())) throw new Error('Skill Templates group is missing from Build navigation');
  for (let index = 0; index < await groups.count(); index += 1) {
    if (!(await groups.nth(index).evaluate((element) => element.open))) throw new Error('A Build navigation group started collapsed');
  }

  for (const [label, href] of routes) {
    const response = await fetch(`${origin}${href}`);
    if (!response.ok) throw new Error(`${href} returned ${response.status}`);
    const markdownHref = href === '/build/' ? '/build.md' : `${href.slice(0, -1)}.md`;
    const markdown = await fetch(`${origin}${markdownHref}`);
    if (!markdown.ok) throw new Error(`${markdownHref} returned ${markdown.status}`);
    const markdownText = await markdown.text();
    if (!markdownText.includes(label === 'Overview' ? '# Build with OS' : `# ${label}`)) {
      throw new Error(`${markdownHref} is missing its page heading`);
    }
    if (label !== 'Overview' && label !== 'Skill Templates') {
      const matches = sidebar.getByRole('link', { name: label, exact: true });
      if ((await matches.count()) < 1) throw new Error(`${label} is missing from Build navigation`);
    }
  }

  const contentChecks = [
    ['/build/tools/how-tools-work/', 'tools.search'],
    ['/build/skills/install-a-skill/', 'picker shows only skill templates'],
    ['/build/steering/project-steering/', 'does not automatically merge'],
    ['/build/approvals/', 'APPROVAL_REQUIRED'],
  ];
  for (const [href, text] of contentChecks) {
    await page.goto(`${origin}${href}`, { waitUntil: 'networkidle' });
    if (!(await page.getByText(text, { exact: false }).first().isVisible())) throw new Error(`${href} is missing verified boundary text: ${text}`);
  }

  await page.goto(`${origin}/build/steering/project-steering/`, { waitUntil: 'networkidle' });
  if (!(await sidebar.getByRole('link', { name: 'Project steering', exact: true }).getAttribute('aria-current'))) throw new Error('Deep link did not mark Project steering current');

  const viewportChecks = [];
  for (const viewport of [
    { name: 'tablet', width: 900, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${origin}/build/tools/how-tools-work/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} layout overflows by ${overflow}px`);
    if (!(await page.getByRole('button', { name: 'Copy page' }).isVisible())) throw new Error(`Copy page is hidden on ${viewport.name}`);
    if (viewport.name === 'mobile') {
      await page.locator('button[aria-controls="starlight__sidebar"]').click();
      if (!(await page.locator('#starlight__sidebar').getByRole('link', { name: 'Approvals', exact: true }).isVisible())) throw new Error('Nested Build navigation is unavailable on mobile');
      await page.keyboard.press('Escape');
    }
    viewportChecks.push({ name: viewport.name, overflow });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, routes: routes.length, groups: 5, viewportChecks }, null, 2)}\n`);
} finally {
  await browser?.close();
  await stopDocumentationServer(server);
}
