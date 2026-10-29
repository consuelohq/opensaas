import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import { prefixMarkdownUrls } from './src/lib/markdown-base.mjs';

const base = process.env.OS_SITE_BASE ?? '/';
if (!['/', '/about'].includes(base)) throw new Error('Unsupported OS website base');

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_ORIGIN ?? 'https://consuelohq.com',
  base,
  outDir: process.env.OS_SITE_OUT_DIR ?? './dist',
  markdown: { rehypePlugins: [[prefixMarkdownUrls, { base }]] },
  integrations: [react(), icon(), sitemap()],
});
