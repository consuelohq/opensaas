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

function convertStarlightDirectives(source: string): string {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let fence: { marker: string; length: number } | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      output.push(line);
      if (fenceMatch && fenceMatch[1][0] === fence.marker
        && fenceMatch[1].length >= fence.length && /^\s{0,3}(`{3,}|~{3,})\s*$/.test(line)) fence = undefined;
      continue;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      output.push(line);
      continue;
    }

    const directive = line.match(/^\s*:::(note|warning)(?:\[([^\]\r\n]+)\])?\s*$/i);
    if (directive) {
      let end = i + 1;
      while (end < lines.length && !/^\s*:::\s*$/.test(lines[end])) end++;
      if (end < lines.length) {
        const title = directive[2]?.trim();
        const body = [...(title ? [`**${title}**`] : []), ...lines.slice(i + 1, end)].join('\n');
        output.push(callout(directive[1].toUpperCase(), body));
        i = end;
        continue;
      }
    }
    output.push(line);
  }

  return output.join('\n');
}

export function normalizeMdxToMarkdown(source: string): string {
  const { body: withoutFrontmatter, title } = stripFrontmatter(source);
  let markdown = removeRuntimeImports(withoutFrontmatter);

  markdown = markdown.replace(
    /<(Note|Warning|AgentContext)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g,
    (_match, name: string, body: string) =>
      callout(name === 'Warning' ? 'WARNING' : name === 'AgentContext' ? 'TIP' : 'NOTE', body),
  );
  markdown = convertStarlightDirectives(markdown);

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
  const absolute = /^https?:\/\//.test(pathname) ? new URL(pathname) : undefined;
  const path = absolute?.pathname ?? pathname.split(/[?#]/)[0];
  const clean = path.replace(/^\/+|\/+$/g, '');
  const output = `/${clean === 'docs' && absolute ? 'docs/index' : clean || 'index'}.md`;
  if (absolute) { absolute.pathname = output; return absolute.toString(); }
  return output;
}
