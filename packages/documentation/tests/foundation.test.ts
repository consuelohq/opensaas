import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { normalizeMdxToMarkdown, pagePathToMarkdownHref, sourcePathToMarkdownSlug } from '../src/lib/markdown-pages';
import {
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
      { label: 'Skills', href: '/skills/' },
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
    expect(getBreadcrumbs('/sites/publish/')).toEqual([
      { label: 'Tools', href: '/tools/' },
      { label: 'Sites' },
      { label: 'Publish', href: '/sites/publish/', current: true },
    ]);

    expect(footerSections).toHaveLength(10);
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
});

describe('foundation source contract', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

  test('declares the ten approved top-level areas and Starlight overrides', () => {
    const config = read('astro.config.mjs');
    const navigation = read('src/lib/docs-navigation.ts');
    for (const label of ['Start', 'Connect', 'Nodes', 'Tools', 'Skills', 'Steering', 'Memory', 'Observe', 'Secure', 'Reference']) {
      expect(navigation).toContain(`label: '${label}'`);
    }
    expect(navigation).not.toContain("label: 'Build with OS'");
    expect(config).toContain('PageTitle:');
    expect(config).toContain('Sidebar:');
    expect(config).toContain('Footer:');
    expect(config).toContain('customCss:');
  });

  test('scaffolds every top-level route', () => {
    for (const route of ['start', 'connect', 'nodes', 'tools', 'skills', 'steering', 'memory', 'observe', 'secure', 'reference']) {
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
    const css = read('src/styles/docs.css');

    expect(sidebar).toContain('global-section-link');
    expect(sidebar).toContain('globalSectionLinks');
    expect(footer).toContain('SiteFooter');
    expect(footer).toContain('data-docs-site-footer-home');
    expect(siteFooter).toContain('footerSections');
    expect(siteFooter).toContain('data-docs-site-footer');
    expect(siteFooter).toContain('docs-registry-grid');
    expect(card).toContain('border: 2px solid var(--sl-color-text-accent)');
    expect(card).toContain(':focus:not(:focus-visible)');
    expect(css).toContain("#starlight__sidebar a:focus:not(:focus-visible)");
    expect(css).toContain("#starlight__sidebar a[aria-current='page']");
    expect(css).toContain('var(--sl-color-gray');
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
    const siteTitle = read('src/components/SiteTitle.astro');
    const sidebar = read('src/components/Sidebar.astro');
    const css = read('src/styles/docs.css');

    expect(config).toContain("title: 'Consuelo OS'");
    expect(config).toContain("favicon: '/favicon.svg'");
    expect(config).toContain("Head: './src/components/Head.astro'");
    expect(config).toContain("SiteTitle: './src/components/SiteTitle.astro'");
    expect(siteTitle).toContain('src="/favicon.svg"');
    expect(siteTitle).toContain('Consuelo OS');
    expect(siteTitle).toContain('color: var(--sl-color-white)');
    expect(sidebar).toContain('color: var(--sl-color-gray-2)');
    expect(sidebar).not.toContain('var(--sl-color-text-accent) 12%');
    expect(head).toContain("dataset.docsInputModality = 'pointer'");
    expect(head).toContain("event.key === 'Tab'");
    expect(css).toContain("html[data-docs-input-modality='pointer']");
    expect(css).toContain('animation: docs-page-in 150ms');
    expect(css).toContain('@keyframes docs-page-in');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(packageJson).not.toContain('"gsap"');
  });

  test('uses a calm reading measure without changing the font family', () => {
    const css = read('src/styles/docs.css');
    expect(css).toContain('--sl-content-width: 44rem');
    expect(css).toContain('max-width: 65ch');
    expect(css).not.toContain('@font-face');
  });
});
