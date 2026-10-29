import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

const channel = process.env.PUBLIC_SITE_CHANNEL ?? 'preview';
if (!['preview', 'production'].includes(channel)) throw new Error('Unknown website channel');
export default defineConfig({
  output: 'static',
  site: channel === 'production' ? 'https://consuelohq.com' : 'https://consuelo-dialer-website-preview.pages.dev',
  integrations: [react(), icon(), sitemap({
    filter: (page) => {
      const pathname = new URL(page).pathname;
      return !pathname.startsWith('/calls/api/') && !/^\/login(?:\/|$)/.test(pathname)
        && !/^\/404(?:\.|\/|$)/.test(pathname) && !/\.(?:txt|xml|md)$/.test(pathname);
    },
  })],
});
