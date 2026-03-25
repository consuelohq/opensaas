import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';

import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
import remarkToc from 'remark-toc';
import remarkCollapse from 'remark-collapse';

export default defineConfig({
  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"]
    }
  },
  markdown: {
    remarkPlugins: [
      remarkToc,
      [
        remarkCollapse,
        {
          test: 'Table of contents',
        },
      ],
    ],
  },
  site: 'https://www.consuelohq.com',
  integrations: [react(), icon(), sitemap()],
  adapter: cloudflare(),
});