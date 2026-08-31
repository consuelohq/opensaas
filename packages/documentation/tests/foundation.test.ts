import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { normalizeMdxToMarkdown, pagePathToMarkdownHref, sourcePathToMarkdownSlug } from '../src/lib/markdown-pages';
import {
  expandCurrentSidebarPath,
  footerSections,
  getBreadcrumbs,
  globalSectionLinks,
  selectSectionSidebar,
} from '../src/lib/docs-navigation';
import type { DocsSidebarEntry } from '../src/lib/docs-navigation';

describe('standalone documentation package', () => {
  test('declares the browser regression runtime', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { devDependencies?: Record<string, string> };

    expect(packageJson.devDependencies?.playwright).toBe('^1.56.1');
  });
});

describe('normalized Markdown pages', () => {
  test('removes runtime-only MDX while preserving readable content and code', () => {
    const source = `---
title: Example
status: shipped
---

import Note from '../../components/Note.astro';

# Example

<Note>
Keep this visible.
</Note>

<CardGroup cols={2}>
  <Card title="Open docs" href="/start/">
    Start here.
  </Card>
</CardGroup>

<VimeoEmbed videoId="927066829" title="Video demonstration" />

\`\`\`ts
import { call } from '@consuelo/os';
\`\`\`
`;
    const markdown = normalizeMdxToMarkdown(source);
    expect(markdown).not.toContain('title: Example');
    expect(markdown).not.toContain("import Note from");
    expect(markdown).not.toContain('<Card');
    expect(markdown).toContain('> [!NOTE]');
    expect(markdown).toContain('Keep this visible.');
    expect(markdown).toContain('### [Open docs](/start/)');
    expect(markdown).toContain('[Video demonstration](https://vimeo.com/927066829)');
    expect(markdown).toContain("import { call } from '@consuelo/os';");
  });


  test('adds the frontmatter title when the only H1 is inside a code fence', () => {
    const source = `---
title: Create a skill
---

Use this structure:

\`\`\`md
# Purpose
\`\`\`
`;
    const markdown = normalizeMdxToMarkdown(source);
    expect(markdown).toStartWith('# Create a skill\n\n');
    expect(markdown).toContain('# Purpose');
  });

  test('normalizes every existing docs source without leaking supported MDX adapters', () => {
    const docsRoot = new URL('../src/content/docs/', import.meta.url);
    const files: URL[] = [];
    const visit = (directory: URL) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        if (entry.isDirectory()) visit(child);
        else if (/\.mdx?$/.test(entry.name) && statSync(child).isFile()) files.push(child);
      }
    };
    visit(docsRoot);
    expect(files.length).toBeGreaterThan(40);
    for (const file of files) {
      const markdown = normalizeMdxToMarkdown(readFileSync(file, 'utf8'));
      const prose = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
      expect(prose).not.toMatch(/<(Note|Warning|AgentContext|Card|CardGroup|CardTitle|VimeoEmbed)\b/);
      expect(prose).not.toMatch(/^import\s+.+components\/mintlify/m);
    }
  });

  test('maps source files and browser routes to stable .md URLs', () => {
    expect(sourcePathToMarkdownSlug('/src/content/docs/index.mdx')).toBe('index');
    expect(sourcePathToMarkdownSlug('/src/content/docs/os/overview.mdx')).toBe('os/overview');
    expect(sourcePathToMarkdownSlug('../content/docs/start/index.mdx')).toBe('start');
    expect(pagePathToMarkdownHref('/')).toBe('/index.md');
    expect(pagePathToMarkdownHref('/os/overview/')).toBe('/os/overview.md');
  });
});

describe('documentation navigation', () => {
  const sidebar = [
    { type: 'group', label: 'Start', collapsed: true, entries: [{ type: 'link', label: 'Overview', href: '/start/', isCurrent: false, attrs: {} }] },
    { type: 'group', label: 'Connect', collapsed: true, entries: [{ type: 'link', label: 'Overview', href: '/connect/', isCurrent: true, attrs: {} }] },
    { type: 'group', label: 'Nodes', collapsed: true, entries: [{ type: 'link', label: 'Overview', href: '/nodes/', isCurrent: false, attrs: {} }] },
  ] satisfies DocsSidebarEntry[];

  test('derives direct global links, breadcrumbs, and footer columns from one registry', () => {
    expect(globalSectionLinks).toEqual([
      { label: 'Start', href: '/start/' },
      { label: 'Connect', href: '/connect/' },
      { label: 'Nodes', href: '/nodes/' },
      { label: 'Tools', href: '/tools/' },
      { label: 'Sites', href: '/sites/' },
      { label: 'Skills', href: '/skills/' },
      { label: 'Workflows', href: '/workflows/' },
      { label: 'Steering', href: '/steering/' },
      { label: 'Memory', href: '/memory/' },
      { label: 'Observe', href: '/observe/' },
      { label: 'Secure', href: '/secure/' },
      { label: 'Reference', href: '/reference/' },
    ]);

    expect(getBreadcrumbs('/')).toEqual([]);
    expect(getBreadcrumbs('/start/')).toEqual([
      { label: 'Start', href: '/start/', current: true },
    ]);
    expect(getBreadcrumbs('/nodes/routing/')).toEqual([
      { label: 'Nodes', href: '/nodes/' },
      { label: 'Routing work', href: '/nodes/routing/', current: true },
    ]);
    expect(getBreadcrumbs('/connect/nodes/how-nodes-work/')).toEqual([]);
    expect(getBreadcrumbs('/build/tools/how-tools-work/')).toEqual([
      { label: 'Tools', href: '/tools/' },
      { label: 'How tools work', href: '/build/tools/how-tools-work/', current: true },
    ]);
    expect(getBreadcrumbs('/build/skills/how-skills-work/')).toEqual([
      { label: 'Skills', href: '/skills/' },
      { label: 'How skills work', href: '/build/skills/how-skills-work/', current: true },
    ]);
    expect(getBreadcrumbs('/workflows/branch-graph/')).toEqual([
      { label: 'Workflows', href: '/workflows/' },
      { label: 'Branch Graph', href: '/workflows/branch-graph/', current: true },
    ]);
    expect(getBreadcrumbs('/sites/publish/')).toEqual([
      { label: 'Sites', href: '/sites/' },
      { label: 'Publish', href: '/sites/publish/', current: true },
    ]);

    expect(footerSections).toHaveLength(12);
    expect(footerSections.find((section) => section.label === 'Start')?.links).toContainEqual({
      label: 'Install Consuelo OS',
      href: '/start/install-consuelo-os/',
    });
    expect(footerSections.find((section) => section.label === 'Tools')?.links).toContainEqual({
      label: 'How tools work',
      href: '/build/tools/how-tools-work/',
    });
  });

  test('keeps the global index and scopes section routes to one expanded group', () => {
    expect(selectSectionSidebar(sidebar, '/')).toEqual({ mode: 'global', entries: sidebar });
    const selected = selectSectionSidebar(sidebar, '/connect/');
    expect(selected.mode).toBe('section');
    expect(selected.sectionLabel).toBe('Connect');
    expect(selected.entries).toHaveLength(1);
    const selectedGroup = selected.entries[0];
    expect(selectedGroup?.type).toBe('group');
    if (selectedGroup?.type !== 'group') throw new Error('Expected a section group');
    expect(selectedGroup.collapsed).toBe(false);
  });

  test('keeps the full global tree on responsive routes and expands the current path', () => {
    const expanded = expandCurrentSidebarPath(sidebar);
    expect(expanded).toHaveLength(3);
    const connect = expanded[1];
    expect(connect?.type).toBe('group');
    if (connect?.type !== 'group') throw new Error('Expected Connect group');
    expect(connect.collapsed).toBe(false);
    const start = expanded[0];
    expect(start?.type).toBe('group');
    if (start?.type !== 'group') throw new Error('Expected Start group');
    expect(start.collapsed).toBe(true);
  });
});

describe('foundation source contract', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

  test('declares the twelve approved top-level areas and Starlight overrides', () => {
    const config = read('astro.config.mjs');
    const navigation = read('src/lib/docs-navigation.ts');
    for (const label of ['Start', 'Connect', 'Nodes', 'Tools', 'Sites', 'Skills', 'Workflows', 'Steering', 'Memory', 'Observe', 'Secure', 'Reference']) {
      expect(navigation).toContain(`label: '${label}'`);
    }
    expect(navigation).not.toContain("label: 'Build with OS'");
    expect(config).toContain('PageTitle:');
    expect(config).toContain('Sidebar:');
    expect(config).toContain('Footer:');
    expect(config).toContain('ThemeSelect:');
    expect(config).toContain('MobileMenuFooter:');
    expect(config).toContain('Header:');
    expect(config).toContain('MobileMenuToggle:');
    expect(config).toContain('MobileTableOfContents:');
    expect(config).toContain('customCss:');
  });

  test('scaffolds every top-level route', () => {
    for (const route of ['start', 'connect', 'nodes', 'tools', 'sites', 'skills', 'workflows', 'steering', 'memory', 'observe', 'secure', 'reference']) {
      expect(existsSync(new URL(`../src/content/docs/${route}/index.mdx`, import.meta.url))).toBe(true);
    }
  });

  test('adds the approved Vercel-style page actions and no ask-AI action', () => {
    const component = read('src/components/PageTitle.astro');
    for (const label of ['Copy page', 'View as Markdown', 'Open in ChatGPT', 'Open in Claude']) {
      expect(component).toContain(label);
    }
    for (const description of [
      'Copy page as Markdown for LLMs',
      'Open this page as plain text',
      'Copy this page and open ChatGPT',
      'Copy this page and open Claude',
    ]) {
      expect(component).toContain(description);
    }
    expect(component).toContain('page-action-icon');
    expect(component).toContain('page-breadcrumbs');
    expect(component).toContain('data-copy-state');
    expect(component).toContain('page-action-success-icon');
    expect(component).toContain("copyState = 'success'");
    expect(component).not.toContain('Ask AI');
  });

  test('renders a separate site footer and simplified sidebar hierarchy', () => {
    const sidebar = read('src/components/Sidebar.astro');
    const footer = read('src/components/Footer.astro');
    const siteFooter = read('src/components/SiteFooter.astro');
    const card = read('src/components/mintlify/Card.astro');
    const themeSelect = read('src/components/ThemeSelect.astro');
    const mobileMenuFooter = read('src/components/MobileMenuFooter.astro');
    const runtimeLanguageSelect = read('src/components/translation/RuntimeLanguageSelect.astro');
    const css = read('src/styles/docs.css');

    expect(sidebar).toContain('global-section-link');
    expect(sidebar).toContain('globalSectionLinks');
    expect(sidebar).toContain('global-sidebar-mobile');
    expect(sidebar).toContain('SidebarSublist sublist={mobileNavigation}');
    expect(sidebar).toContain('expandCurrentSidebarPath');
    expect(footer).toContain('SiteFooter');
    expect(footer).toContain('data-docs-site-footer-home');
    expect(siteFooter).toContain('footerSections');
    expect(siteFooter).toContain('data-docs-site-footer');
    expect(siteFooter).toContain('docs-registry-grid');
    expect(card).not.toContain('border: 2px solid var(--sl-color-text-accent)');
    expect(card).toContain('border-color: var(--sl-color-gray-4)');
    expect(card).toContain(':focus:not(:focus-visible)');
    expect(themeSelect).toContain('data-docs-theme-toggle');
    expect(themeSelect).toContain('data-theme-value="auto"');
    expect(themeSelect).toContain('data-theme-value="light"');
    expect(themeSelect).toContain('data-theme-value="dark"');
    expect(themeSelect).not.toContain('<select');
    expect(mobileMenuFooter).toContain('SocialIcons');
    expect(mobileMenuFooter).toContain('ThemeSelect');
    expect(mobileMenuFooter).not.toContain('LanguageSelect');
    expect(runtimeLanguageSelect).toContain('navigator.languages');
    expect(runtimeLanguageSelect).toContain('resolvePreferredTranslationLanguage');
    expect(runtimeLanguageSelect).not.toContain('Translate this page');
    expect(runtimeLanguageSelect).not.toContain('<select');
    expect(runtimeLanguageSelect).not.toContain('Show English');
    expect(css).toContain("#starlight__sidebar a:focus:not(:focus-visible)");
    expect(css).toContain("#starlight__sidebar a[aria-current='page']");
    expect(css).toContain('var(--docs-panel)');
    expect(css).toContain('box-shadow: none');
    expect(css).not.toContain('box-shadow: inset 3px 0 0 var(--sl-color-text-accent)');
    expect(css).toContain('#starlight__sidebar ul ul li');
    expect(css).toContain('border-inline-start: 0');
    expect(css).toContain('.page > .docs-site-footer');
    expect(css).toContain('position: sticky');
  });

  test('uses quiet Consuelo OS shell branding and pointer interactions', () => {
    const config = read('astro.config.mjs');
    const packageJson = read('package.json');
    const head = read('src/components/Head.astro');
    const header = read('src/components/Header.astro');
    const browseMenu = read('src/components/BrowseMenu.astro');
    const docsMenuTriggerPath = new URL('../src/components/DocsMenuTrigger.astro', import.meta.url);
    const docsMenuTrigger = existsSync(docsMenuTriggerPath) ? readFileSync(docsMenuTriggerPath, 'utf8') : '';
    const mobileMenuToggle = read('src/components/MobileMenuToggle.astro');
    const mobileToc = read('src/components/MobileTableOfContents.astro');
    const siteTitle = read('src/components/SiteTitle.astro');
    const sidebar = read('src/components/Sidebar.astro');
    const css = read('src/styles/docs.css');

    expect(config).toContain("title: 'Consuelo OS'");
    expect(config).toContain("favicon: '/favicon.svg'");
    expect(config).toContain("Head: './src/components/Head.astro'");
    expect(config).toContain("SiteTitle: './src/components/SiteTitle.astro'");
    expect(siteTitle).toContain('src="/favicon.svg"');
    expect(siteTitle).toContain('href="/"');
    expect(siteTitle).toContain('consuelo-site-title-slash');
    expect(siteTitle).toContain('>Docs<');
    expect(siteTitle).not.toContain('>Consuelo OS<');
    expect(siteTitle).toContain('color: var(--sl-color-white)');
    expect(sidebar).toContain('color: var(--sl-color-gray-2)');
    expect(sidebar).toContain('data-docs-sidebar-search-trigger');
    expect(sidebar).toContain('Search Docs');
    expect(sidebar).not.toContain('var(--sl-color-text-accent) 12%');
    expect(header).toContain('DocsMenuTrigger');
    expect(header).not.toContain('<BrowseMenu />');
    expect(header).toContain('data-docs-header-search');
    expect(existsSync(docsMenuTriggerPath)).toBe(true);
    expect(docsMenuTrigger).toContain('data-docs-menu-toggle');
    expect(docsMenuTrigger).toContain('starlight__sidebar');
    expect(docsMenuTrigger).toContain('aria-label="Open docs menu"');
    expect(docsMenuTrigger).toContain('xPercent: -100');
    expect(docsMenuTrigger).toContain("from 'gsap'");
    expect(browseMenu).toContain('data-docs-build-trigger');
    expect(browseMenu).toContain('data-docs-browse-overlay');
    expect(browseMenu).toContain("from 'gsap'");
    expect(browseMenu).toContain('https://consuelohq.com/changelog');
    expect(browseMenu).toContain('https://consuelohq.com/blog');
    expect(browseMenu).toContain('https://discord.gg/87YtkVUBvc');
    expect(browseMenu).toContain('/build/skills/bundled/');
    expect(browseMenu).toContain('https://os.consuelohq.com/');
    expect(browseMenu).not.toContain('Ask AI');
    expect(mobileMenuToggle).toContain('BrowseMenu');
    expect(mobileMenuToggle).not.toContain('starlight__sidebar');
    expect(browseMenu).toContain('M4 9h16');
    expect(browseMenu).toContain('M4 15h16');
    expect(mobileToc).toContain("from 'gsap'");
    expect(mobileToc).toContain('data-docs-mobile-toc-sheet');
    expect(mobileToc).not.toContain('starlight__mobile-toc');
    expect(head).toContain("dataset.docsInputModality = 'pointer'");
    expect(head).toContain("event.key === 'Tab'");
    expect(css).toContain("html[data-docs-input-modality='pointer']");
    expect(css).toContain('animation: docs-page-in 150ms');
    expect(css).toContain('@keyframes docs-page-in');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(packageJson).toContain('"gsap"');
  });

  test('uses a left docs drawer, clean page chrome, and a landing-page home', () => {
    const css = read('src/styles/docs.css');
    const pageTitle = read('src/components/PageTitle.astro');
    const home = read('src/content/docs/index.mdx');
    expect(css).toContain('left: 0');
    expect(css).toContain('right: auto');
    expect(css).toContain('border-right: 0');
    expect(css).toContain('.content-panel + .content-panel');
    expect(css).toContain('border-top: 0');
    expect(css).toContain('.page > header.header');
    expect(css).toContain('border-bottom: 0');
    expect(css).toContain('.sl-markdown-content .sl-anchor-link');
    expect(css).toContain('display: none');
    expect(pageTitle).toContain('isHome');
    for (const href of ['/start/', '/connect/', '/tools/']) expect(pageTitle).toContain(`href="${href}"`);
    expect(pageTitle).not.toContain('docs-home-kicker');
    expect(pageTitle).not.toContain('Consuelo OS documentation');
    expect(pageTitle).toContain('<span class="docs-home-title-line">Digital workers</span>');
    expect(pageTitle).toContain('<span class="docs-home-title-line">built on Consuelo</span>');
    expect(home).toContain('title: Digital workers built on Consuelo');
    expect(pageTitle).toContain('.docs-home-title-line');
    expect(pageTitle).not.toContain('grid-column: 1 / -1');
    expect(home).toContain('data-home-install-command');
    expect(home).toContain('data-home-install-copy');
    expect(home).not.toContain('```bash');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('.home-install-command button');
    expect(pageTitle).toContain("closest('[data-home-install-copy]')");
  });

  test('uses the approved Vercel-derived responsive type, controls, canvas, and drawer', () => {
    const css = read('src/styles/docs.css');
    const sidebar = read('src/components/Sidebar.astro');
    const pageTitle = read('src/components/PageTitle.astro');
    const docsMenuTrigger = read('src/components/DocsMenuTrigger.astro');

    expect(sidebar).toContain('SidebarSublist sublist={mobileNavigation}');
    expect(sidebar).toContain('expandCurrentSidebarPath');
    expect(sidebar).toContain('.section-sidebar');
    expect(sidebar).toContain('display: none');
    expect(css).toContain('width: min(75vw, 25rem)');
    expect(css).toContain('box-shadow: 0 18px 55px');
    expect(css).toContain('body[data-mobile-menu-expanded]::after');
    expect(css).toContain('transition: opacity 300ms ease');
    expect(css).toContain('animation: none;');
    expect(css).toContain('font-size: 1.5rem');
    expect(css).toContain('line-height: 2rem');
    expect(pageTitle).toContain('font-size: 2.5rem');
    expect(pageTitle).toContain('line-height: 3rem');
    expect(css).toContain('max-width: none');
    expect(pageTitle).toContain('min-height: 2.25rem');
    expect(pageTitle).toContain('font-weight: 500');
    expect(pageTitle).toContain('transition: background-color 150ms ease');
    expect(docsMenuTrigger).toContain('duration: 0.22');
    expect(docsMenuTrigger).toContain('duration: 0.2');
  });

  test('keeps the responsive Browse menu collapsed, divider-free, and compact', () => {
    const browseMenu = read('src/components/BrowseMenu.astro');

    expect(browseMenu).not.toContain('data-docs-browse-group open');
    expect(browseMenu).toContain('.docs-browse-header {');
    expect(browseMenu).toContain('border-bottom: 0;');
    expect(browseMenu).toContain('.docs-browse-group {');
    expect(browseMenu).not.toContain('border-bottom: 1px solid var(--docs-line);');
    expect(browseMenu).toContain('font-size: 1rem;');
    expect(browseMenu).toContain('line-height: 1.5rem;');
    expect(browseMenu).toContain('font-size: 0.9375rem;');
    expect(browseMenu).toContain('min-height: 2.25rem;');
    expect(browseMenu).toContain('border-radius: 0.375rem;');
  });

  test('uses compact neutral desktop docs chrome and a two-column home', () => {
    const css = read('src/styles/docs.css');
    const sidebar = read('src/components/Sidebar.astro');
    const pageTitle = read('src/components/PageTitle.astro');
    expect(css).toContain('--sl-sidebar-width: 18rem');
    expect(css).toContain('.right-sidebar {');
    expect(css).toContain('.right-sidebar-container {');
    expect(css).toContain('width: 15rem');
    expect(css).toContain('border-left: 0');
    expect(css).toContain(".right-sidebar a[aria-current=\'true\']");
    expect(css).toContain('font-weight: 500');
    expect(css).toContain('.main-frame:has(.docs-home-hero) .right-sidebar-container');
    expect(css).toContain('display: none');
    expect(css).toContain(":has(> #start-in-one-command)");
    expect(css).toContain('#pick-up-where-you-need');
    expect(pageTitle).toContain('docs-home-quick-start');
    expect(pageTitle).toContain('.docs-home-quick-start {');
    expect(pageTitle).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(sidebar).toContain('font-size: 0.875rem');
    expect(sidebar).toContain('font-weight: 400');
    expect(sidebar).toContain('min-height: 2.25rem');
    expect(pageTitle).toContain('font-size: clamp(3.25rem, 4.4vw, 3.75rem)');
    expect(pageTitle).toContain('min-height: 2.25rem');
  });

  test('uses the launcher warm editorial palette without changing fonts', () => {
    const css = read('src/styles/docs.css');
    for (const token of [
      '--docs-paper: #0f0f0d',
      '--docs-ink: #f7efe7',
      '--docs-surface: #191814',
      '--docs-muted: #c3b4a7',
      '--docs-accent: #e06b3e',
      '--docs-paper: #faf7f2',
      '--docs-ink: #1c1a17',
      '--docs-surface: #fffaf3',
      '--docs-muted: #8a817a',
      '--docs-accent: #c0512f',
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain('--sl-mobile-toc-height: 0rem');
    expect(css).not.toContain('@font-face');
    expect(css).not.toContain('--sl-font:');
  });

  test('uses a calm reading measure without changing the font family', () => {
    const css = read('src/styles/docs.css');
    expect(css).toContain('--sl-content-width: 44rem');
    expect(css).toContain('max-width: 65ch');
    expect(css).not.toContain('@font-face');
  });
});
