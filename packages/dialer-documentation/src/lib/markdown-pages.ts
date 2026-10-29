const DOCS_ROOT_PATTERN = /(?:^|\/)(?:src\/)?content\/docs\//;

function stripFrontmatter(source: string): { body: string; title?: string } {
  if (!source.startsWith('---')) return { body: source };
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { body: source };
  const titleMatch = match[1].match(/^title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  return { body: source.slice(match[0].length), title };
}

function removeRuntimeImports(source: string): string {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let fence: string | undefined;
  let skippingImport = false;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      fence = fence ? undefined : fenceMatch[1];
      output.push(line);
      continue;
    }
    if (fence) {
      output.push(line);
      continue;
    }
    if (skippingImport) {
      if (/;\s*$/.test(line)) skippingImport = false;
      continue;
    }
    if (/^\s*import\s/.test(line)) {
      if (!/;\s*$/.test(line)) skippingImport = true;
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

function callout(label: string, body: string): string {
  const lines = body.trim().split(/\r?\n/);
  return [`> [!${label}]`, ...lines.map((line) => (line ? `> ${line}` : '>'))].join('\n');
}

export function normalizeMdxToMarkdown(source: string): string {
  const { body: withoutFrontmatter, title } = stripFrontmatter(source);
  let markdown = removeRuntimeImports(withoutFrontmatter);

  markdown = markdown.replace(
    /<(Note|Warning|AgentContext)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g,
    (_match, name: string, body: string) =>
      callout(name === 'Warning' ? 'WARNING' : name === 'AgentContext' ? 'TIP' : 'NOTE', body),
  );

  markdown = markdown.replace(
    /<Card\s+([^>]*?)>([\s\S]*?)<\/Card>/g,
    (_match, attributes: string, cardBody: string) => {
      const titleValue = attributes.match(/title=["']([^"']+)["']/)?.[1] ?? 'Related page';
      const href = attributes.match(/href=["']([^"']+)["']/)?.[1];
      const heading = href ? `### [${titleValue}](${href})` : `### ${titleValue}`;
      return `${heading}\n\n${cardBody.trim()}`;
    },
  );
  markdown = markdown.replace(/<\/?CardGroup(?:\s[^>]*)?>/g, '');
  markdown = markdown.replace(/<\/?CardTitle(?:\s[^>]*)?>/g, '');
  markdown = markdown.replace(
    /<VimeoEmbed\s+([^>]*?)\s*\/>/g,
    (_match, attributes: string) => {
      const id = attributes.match(/videoId=["']([^"']+)["']/)?.[1];
      const titleValue = attributes.match(/title=["']([^"']+)["']/)?.[1] ?? 'Video';
      return id ? `[${titleValue}](https://vimeo.com/${id})` : titleValue;
    },
  );

  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
  const proseWithoutFences = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
  if (title && !/^#\s+/m.test(proseWithoutFences)) markdown = `# ${title}\n\n${markdown}`.trim();
  return `${markdown}\n`;
}

export function sourcePathToMarkdownSlug(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/');
  const relative = normalized.split(DOCS_ROOT_PATTERN)[1];
  if (!relative) throw new Error(`Not a documentation source path: ${sourcePath}`);
  return relative.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '') || 'index';
}

export function pagePathToMarkdownHref(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return `/${clean || 'index'}.md`;
}
