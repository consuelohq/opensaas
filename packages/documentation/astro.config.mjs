// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import starlight from '@astrojs/starlight';
import { legacyRedirects } from './src/lib/legacy-redirects.mjs';
import { docsSidebar } from './src/lib/docs-navigation';

export default defineConfig({
  site: 'https://docs.consuelohq.com',
  redirects: legacyRedirects,
  adapter: cloudflare({
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  integrations: [
    starlight({
      title: 'Consuelo Docs',
      favicon: 'https://consuelohq.com/favicon.svg',
      customCss: ['./src/styles/docs.css'],
      components: {
        LanguageSelect: './src/components/translation/RuntimeLanguageSelect.astro',
        PageTitle: './src/components/PageTitle.astro',
        Sidebar: './src/components/Sidebar.astro',
        Footer: './src/components/Footer.astro',
      },
      sidebar: docsSidebar,
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/consuelohq/opensaas',
        },
      ],
    }),
  ],
});
