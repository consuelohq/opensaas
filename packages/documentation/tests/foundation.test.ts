import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { normalizeMdxToMarkdown, pagePathToMarkdownHref, sourcePathToMarkdownSlug } from '../src/lib/markdown-pages';
import { selectSectionSidebar } from '../src/lib/docs-navigation';
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
  ] satisfies DocsSidebarEntry[];

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

  test('declares the seven approved top-level areas and Starlight overrides', () => {
    const config = read('astro.config.mjs');
    const navigation = read('src/lib/docs-navigation.ts');
    for (const label of ['Start', 'Connect', 'Build with OS', 'Sites', 'Observe', 'Secure', 'Reference']) {
      expect(navigation).toContain(`label: '${label}'`);
    }
    expect(config).toContain('PageTitle:');
    expect(config).toContain('Sidebar:');
    expect(config).toContain('customCss:');
  });

  test('scaffolds every top-level route', () => {
    for (const route of ['start', 'connect', 'build', 'sites', 'observe', 'secure', 'reference']) {
      expect(existsSync(new URL(`../src/content/docs/${route}/index.mdx`, import.meta.url))).toBe(true);
    }
  });

  test('adds the approved page actions and no ask-AI action', () => {
    const component = read('src/components/PageTitle.astro');
    for (const label of ['Copy page', 'View as Markdown', 'Open in ChatGPT', 'Open in Claude']) {
      expect(component).toContain(label);
    }
    expect(component).not.toContain('Ask AI');
  });

  test('uses a calm reading measure without changing the font family', () => {
    const css = read('src/styles/docs.css');
    expect(css).toContain('--sl-content-width: 44rem');
    expect(css).toContain('max-width: 65ch');
    expect(css).not.toContain('@font-face');
  });
});
