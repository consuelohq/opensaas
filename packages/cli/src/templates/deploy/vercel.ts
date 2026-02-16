import type { TemplateFile, DeployConfig } from './types.js';

export function vercelTemplates(config: DeployConfig): TemplateFile[] {
  const vercelJson = JSON.stringify({
    version: 2,
    name: 'consuelo',
    builds: [
      { src: 'packages/twenty-server/dist/src/main.js', use: '@vercel/node' },
      ...(config.twentyEnabled ? [{ src: 'packages/twenty-front/dist/**', use: '@vercel/static' }] : []),
    ],
    routes: [
      { src: '/healthz', dest: 'packages/twenty-server/dist/src/main.js' },
      { src: '/api/(.*)', dest: 'packages/twenty-server/dist/src/main.js' },
      { src: '/metadata/(.*)', dest: 'packages/twenty-server/dist/src/main.js' },
      ...(config.twentyEnabled ? [{ src: '/(.*)', dest: 'packages/twenty-front/dist/$1' }] : []),
    ],
  }, null, 2);

  const ignore = `node_modules
.git
.env
.env.*
*.log
packages/twenty-e2e-testing
packages/twenty-website
`;

  return [
    { path: 'vercel.json', content: vercelJson },
    { path: '.vercelignore', content: ignore },
  ];
}
