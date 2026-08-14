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
      title: 'Consuelo OS',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/docs.css'],
      components: {
        Head: './src/components/Head.astro',
        LanguageSelect: './src/components/translation/RuntimeLanguageSelect.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
        PageTitle: './src/components/PageTitle.astro',
        Sidebar: './src/components/Sidebar.astro',
        SiteTitle: './src/components/SiteTitle.astro',
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
