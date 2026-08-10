import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://consuelohq.com',
  integrations: [react(), icon(), sitemap()],
});
