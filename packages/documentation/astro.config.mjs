// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import starlight from '@astrojs/starlight';
import { legacyRedirects } from './src/lib/legacy-redirects.mjs';
import { docsSidebar } from './src/lib/docs-navigation';
import { prefixMarkdownUrls } from './src/lib/markdown-base.mjs';

const base = process.env.DOCS_BASE_PATH ?? '/';
if (!['/', '/docs'].includes(base)) throw new Error('Unsupported OS documentation base');

export default defineConfig({
  site: process.env.DOCS_SITE_URL ?? 'https://docs.consuelohq.com',
  base,
  outDir: process.env.DOCS_OUT_DIR ?? './dist',
  ...(base === '/docs' ? { session: { driver: sessionDrivers.memory() } } : {}),
  markdown: { rehypePlugins: [[prefixMarkdownUrls, { base }]] },
  redirects: Object.fromEntries(Object.entries(legacyRedirects).map(([from, to]) => [from, base === '/' || !to.startsWith('/') ? to : base + to])),
  adapter: cloudflare({
    configPath: process.env.DOCS_WRANGLER_CONFIG ?? './wrangler.jsonc',
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
        Header: './src/components/Header.astro',
        LanguageSelect: './src/components/translation/RuntimeLanguageSelect.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
        MobileMenuToggle: './src/components/MobileMenuToggle.astro',
        MobileTableOfContents: './src/components/MobileTableOfContents.astro',
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
