import type { APIRoute, GetStaticPaths } from 'astro';
import {
  normalizeMdxToMarkdown,
  sourcePathToMarkdownSlug,
} from '../lib/markdown-pages';

export const prerender = true;

const sources = import.meta.glob('../content/docs/**/*.{md,mdx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(sources).map(([sourcePath, source]) => ({
    params: { slug: sourcePathToMarkdownSlug(sourcePath) },
    props: { source },
  }));

export const GET: APIRoute = ({ props }) =>
  new Response(normalizeMdxToMarkdown(String(props.source)), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
