// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import starlight from '@astrojs/starlight';
import { legacyRedirects } from './src/lib/legacy-redirects.mjs';

const sidebar = [
  {
    label: 'User Guide',
    items: [
      {
        label: 'User Stories & Use Cases',
        slug: 'user-guide/user-stories-use-cases',
      },
      {
        label: 'Getting Started',
        items: [
          { label: 'Introduction', slug: 'user-guide/introduction' },
          {
            label: 'Capabilities',
            items: [
              {
                label: 'What is Consuelo?',
                slug: 'user-guide/getting-started/capabilities/what-is-consuelo',
              },
              {
                label: 'Implementation Services',
                slug: 'user-guide/getting-started/capabilities/implementation-services',
              },
              {
                label: 'Glossary',
                slug: 'user-guide/getting-started/capabilities/glossary',
              },
              {
                label: 'Keyboard Shortcuts',
                slug: 'user-guide/getting-started/capabilities/keyboard-shortcuts',
              },
            ],
          },
          {
            label: 'How-Tos',
            items: [
              {
                label: 'Create a Workspace',
                slug: 'user-guide/getting-started/how-tos/create-workspace',
              },
              {
                label: 'Navigate Around Consuelo',
                slug: 'user-guide/getting-started/how-tos/navigate-around-consuelo',
              },
              {
                label: 'Configure Your Workspace',
                slug: 'user-guide/getting-started/how-tos/configure-your-workspace',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: 'Consuelo OS',
    items: [
      { label: 'Overview', slug: 'os/overview' },
      { label: 'How It Works', slug: 'os/how-it-works' },
      { label: 'Glossary', slug: 'os/glossary' },
      {
        label: 'Getting Started',
        items: [
          { label: 'Install', slug: 'os/getting-started/install' },
          {
            label: 'Workspace Launcher',
            slug: 'os/getting-started/workspace-launcher',
          },
          {
            label: 'Connect Agents',
            slug: 'os/getting-started/connect-agents',
          },
        ],
      },
      {
        label: 'Concepts',
        items: [
          { label: 'Portal', slug: 'os/concepts/portal' },
          { label: 'Configuration', slug: 'os/concepts/configuration' },
          { label: 'Skills', slug: 'os/concepts/skills' },
          { label: 'Scripts', slug: 'os/concepts/scripts' },
          {
            label: 'Files and Artifacts',
            slug: 'os/concepts/files-and-artifacts',
          },
          { label: 'Approvals', slug: 'os/concepts/approvals' },
          {
            label: 'Data Model and GraphQL',
            slug: 'os/concepts/data-model-and-graphql',
          },
          {
            label: 'Context and Memory',
            slug: 'os/concepts/context-and-memory',
          },
          {
            label: 'Integrations and Capabilities',
            slug: 'os/concepts/integrations-and-capabilities',
          },
          { label: 'Observability', slug: 'os/concepts/observability' },
          { label: 'Local and Cloud', slug: 'os/concepts/local-and-cloud' },
          {
            label: 'MCP Ingress Security',
            slug: 'os/concepts/mcp-ingress-security',
          },
        ],
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Overview', slug: 'tools/overview' },
      { label: 'Sites', slug: 'tools/sites/overview' },
      { label: 'Office', slug: 'tools/office' },
      { label: 'Media', slug: 'tools/media/getting-started' },
      {
        label: 'Workspace Tools',
        items: [
          { label: 'Overview', slug: 'os/tools/overview' },
          { label: 'Browser Tools', slug: 'os/tools/browser-tools' },
        ],
      },
    ],
  },
  {
    label: 'Developer Guide',
    items: [
      { label: 'Getting Started', slug: 'developers/introduction' },
      {
        label: 'Agent Development',
        items: [
          { label: 'Agent Overview', slug: 'developers/agent/overview' },
          {
            label: 'Tool System & Code Mode',
            slug: 'developers/agent/tool-system',
          },
          { label: 'CRM Tools', slug: 'developers/agent/crm-tools' },
          {
            label: 'Integrations & Tracing',
            slug: 'developers/agent/integrations',
          },
        ],
      },
      {
        label: 'API',
        items: [
          { label: 'Overview', slug: 'developers/api/overview' },
          { label: 'Authentication', slug: 'developers/api/auth' },
          { label: 'GraphQL API', slug: 'developers/api/graphql' },
          { label: 'Contacts API', slug: 'developers/api/contacts' },
          { label: 'Voice API', slug: 'developers/api/voice' },
        ],
      },
    ],
  },
];

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
      components: {
        LanguageSelect:
          './src/components/translation/RuntimeLanguageSelect.astro',
      },
      sidebar,
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
