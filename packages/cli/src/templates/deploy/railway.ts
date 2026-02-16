import type { TemplateFile, DeployConfig } from './types.js';

export function railwayTemplates(config: DeployConfig): TemplateFile[] {
  const railway = JSON.stringify({
    $schema: 'https://railway.app/railway.schema.json',
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
    deploy: {
      startCommand: 'node packages/twenty-server/dist/src/main.js',
      healthcheckPath: '/healthz',
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 10,
    },
  }, null, 2);

  const dockerfile = `FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages/twenty-server/package.json packages/twenty-server/
COPY packages/twenty-shared/package.json packages/twenty-shared/
${config.twentyEnabled ? 'COPY packages/twenty-front/package.json packages/twenty-front/\n' : ''}RUN corepack enable && yarn install --immutable

COPY packages/twenty-shared packages/twenty-shared
RUN yarn workspace twenty-shared build
COPY packages/twenty-server packages/twenty-server
RUN yarn workspace twenty-server build
${config.twentyEnabled ? 'COPY packages/twenty-front packages/twenty-front\nRUN yarn workspace twenty-front build\n' : ''}
FROM node:24-alpine
RUN addgroup -S consuelo && adduser -S consuelo -G consuelo
WORKDIR /app
COPY --from=builder --chown=consuelo:consuelo /app .
USER consuelo
EXPOSE ${config.serverPort}
CMD ["node", "packages/twenty-server/dist/src/main.js"]
`;

  return [
    { path: 'railway.json', content: railway },
    { path: 'Dockerfile', content: dockerfile },
  ];
}
