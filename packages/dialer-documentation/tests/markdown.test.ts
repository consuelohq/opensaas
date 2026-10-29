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

it('exports Starlight note and warning directives as safe Markdown callouts outside code fences', () => {
  const source = [
    '---', 'title: Inbound guidance', '---',
    ':::note[Launch preview]', 'The service is **not** generally available.', ':::',
    ':::warning', 'Do not assume a ringing call was answered.', ':::',
    '```md', ':::note[Literal code sample]', 'This is example markup.', ':::', '```',
  ].join('\n');
  const output = normalizeMdxToMarkdown(source);
  expect(output).toContain('> [!NOTE]\n> **Launch preview**\n> The service is **not** generally available.');
  expect(output).toContain('> [!WARNING]\n> Do not assume a ringing call was answered.');
  expect(output).toContain('```md\n:::note[Literal code sample]\nThis is example markup.\n:::\n```');
  expect(output).not.toContain(':::warning');
});


it('keeps migrated OS Markdown destinations on the OS origin and mounted index', () => {
  expect(pagePathToMarkdownHref('https://os.consuelohq.com/docs/')).toBe('https://os.consuelohq.com/docs/index.md');
  expect(pagePathToMarkdownHref('https://os.consuelohq.com/docs/start/install-consuelo-os/')).toBe('https://os.consuelohq.com/docs/start/install-consuelo-os.md');
  expect(pagePathToMarkdownHref('/inbound/routing/')).toBe('/inbound/routing.md');
});


it('keeps retired Dialer guide bookmarks in curated Dialer documentation', async () => {
  const { legacyRedirects } = await import('../src/lib/legacy-redirects.mjs');
  const routes = {
    '/user-guide/dialer/overview': '/start/',
    '/user-guide/dialer/making-calls': '/outbound/',
    '/user-guide/dialer/hold-mute': '/troubleshooting/audio/',
    '/user-guide/dialer/how-tos/discord-setup': '/team/devices/',
    '/user-guide/dialer/transfers': '/inbound/routing/',
    '/user-guide/highlevel/overview': '/start/',
    '/user-guide/highlevel/embedded/getting-started': '/start/install/',
  };
  for (const [from, to] of Object.entries(routes)) {
    expect(legacyRedirects[from]).toBe(to);
    expect(pagePathToMarkdownHref(legacyRedirects[from])).toBe(to.replace(/\/$/, '') + '.md');
  }
});
