import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import remarkCollapse from 'remark-collapse';

export default defineConfig({
  output: 'static',
  site: 'https://www.consuelohq.com',
  integrations: [react(), icon(), sitemap()],
  markdown: {
    remarkPlugins: [
      remarkToc,
      [remarkCollapse, { test: "Table of contents", summary: "Open Table of contents" }],
    ],
  },
});
