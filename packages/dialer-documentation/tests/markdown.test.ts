import { expect, it } from 'bun:test';
import { normalizeMdxToMarkdown, pagePathToMarkdownHref } from '../src/lib/markdown-pages';

it('keeps integrator code examples while removing presentation imports from Markdown', () => {
  const source = "---\ntitle: SDK guide\n---\nimport Card from './Card.astro';\n\n```ts\nimport { Dialer } from '@consuelo/dialer';\n```\n\n<Note>Use verified rep identity.</Note>";
  const output = normalizeMdxToMarkdown(source);
  expect(output).toStartWith('# SDK guide');
  expect(output).toContain("import { Dialer } from '@consuelo/dialer'");
  expect(output).not.toContain("import Card");
  expect(output).toContain('> [!NOTE]');
  expect(pagePathToMarkdownHref('/reference/sdk/?mode=copy#example')).toBe('/reference/sdk.md');
});


it('keeps migrated OS Markdown destinations on the OS origin and mounted index', () => {
  expect(pagePathToMarkdownHref('https://os.consuelohq.com/docs/')).toBe('https://os.consuelohq.com/docs/index.md');
  expect(pagePathToMarkdownHref('https://os.consuelohq.com/docs/start/install-consuelo-os/')).toBe('https://os.consuelohq.com/docs/start/install-consuelo-os.md');
  expect(pagePathToMarkdownHref('/inbound/routing/')).toBe('/inbound/routing.md');
});
