import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from 'astro-icon';
const channel = process.env.PUBLIC_SITE_CHANNEL ?? 'preview';
if (!['preview', 'production'].includes(channel)) throw new Error('Unknown website channel');
export default defineConfig({ output: 'static', site: channel === 'production' ? 'https://consuelohq.com' : 'https://consuelo-dialer-website-preview.pages.dev', integrations: [react(), icon()] });
