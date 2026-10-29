import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';
export default defineConfig({ output: 'static', site: 'https://consuelo-dialer-website-preview.pages.dev', integrations: [react(), icon()] });
