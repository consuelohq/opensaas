import { extractTranslationSegments } from './text';

const docsModules = import.meta.glob<string>('../../content/docs/**/*.{md,mdx}', {
  eager: true,
  import: 'default',
  query: '?raw',
});

export type DocumentationTranslationSource = {
  route: string;
  slug: string;
  contentHash: string;
  title: string;
  description: string | null;
  segments: string[];
};

export function normalizeDocumentationPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const withoutOrigin = pathname.startsWith('http') ? new URL(pathname).pathname : pathname;
  const clean = withoutOrigin.split('?')[0]?.split('#')[0]?.replace(/^\/+/, '').replace(/\/+$/, '') ?? '';
  if (clean.startsWith('api/') || clean.startsWith('_astro/')) return null;
  return clean === '' ? 'index' : clean;
}

export async function getDocumentationTranslationSource(pathname: string | null): Promise<DocumentationTranslationSource | null> {
  try {
    const slug = normalizeDocumentationPath(pathname);
    if (!slug) return null;

    const moduleKey = findModuleKey(slug);
    if (!moduleKey) return null;

    const raw = docsModules[moduleKey];
    if (typeof raw !== 'string') return null;

    const metadata = parseFrontmatter(raw);
    const segments = extractTranslationSegments(raw);
    if (segments.length === 0) return null;

    return {
      route: slug === 'index' ? '/' : `/${slug}/`,
      slug,
      contentHash: await sha256Hex(raw),
      title: metadata.title ?? titleFromSlug(slug),
      description: metadata.description ?? null,
      segments,
    };
  } catch {
    return null;
  }
}

function findModuleKey(slug: string): string | null {
  const candidates = [
    `../../content/docs/${slug}.mdx`,
    `../../content/docs/${slug}.md`,
    `../../content/docs/${slug}/index.mdx`,
    `../../content/docs/${slug}/index.md`,
  ];
  return candidates.find((candidate) => candidate in docsModules) ?? null;
}

function parseFrontmatter(raw: string): { title?: string; description?: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const metadata: { title?: string; description?: string } = {};
  for (const line of match[1].split('\n')) {
    const title = line.match(/^title:\s*["']?(.+?)["']?\s*$/);
    if (title?.[1]) metadata.title = title[1];
    const description = line.match(/^description:\s*["']?(.+?)["']?\s*$/);
    if (description?.[1]) metadata.description = description[1];
  }
  return metadata;
}

function titleFromSlug(slug: string): string {
  return slug
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') ?? 'Consuelo Docs';
}

async function sha256Hex(input: string): Promise<string> {
  try {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch (error: unknown) {
    throw new Error('Failed to hash documentation translation source.', { cause: error });
  }
}
