import type { APIRoute, GetStaticPaths } from 'astro';
import { legacyRedirects } from '../lib/legacy-redirects.mjs';
import {
  normalizeMdxToMarkdown,
  pagePathToMarkdownHref,
  sourcePathToMarkdownSlug,
} from '../lib/markdown-pages';

export const prerender = true;

const sources = import.meta.glob('../content/docs/**/*.{md,mdx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

type MarkdownPageProps = { source?: string; redirectTo?: string };

export const getStaticPaths: GetStaticPaths = () => {
  const sourcePages = Object.entries(sources).map(([sourcePath, source]) => ({
    params: { slug: sourcePathToMarkdownSlug(sourcePath) },
    props: { source } satisfies MarkdownPageProps,
  }));
  const sourceSlugs = new Set(sourcePages.map((page) => page.params.slug));
  const redirectPages = Object.entries(legacyRedirects)
    .map(([from, to]) => ({
      params: { slug: from.replace(/^\/+|\/+$/g, '') || 'index' },
      props: { redirectTo: pagePathToMarkdownHref(to) } satisfies MarkdownPageProps,
    }))
    .filter((page) => !sourceSlugs.has(page.params.slug));
  return [...sourcePages, ...redirectPages];
};

export const GET: APIRoute = ({ props }) => {
  const { source, redirectTo } = props as MarkdownPageProps;
  if (redirectTo) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: redirectTo,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  }
  if (source === undefined) return new Response('Markdown page not found.\n', { status: 404 });
  return new Response(normalizeMdxToMarkdown(source), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
