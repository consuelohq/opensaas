import type { TemplateFile, DeployConfig } from './types.js';
import { railwayTemplates } from './railway.js';
import { vercelTemplates } from './vercel.js';
import { dockerTemplates } from './docker.js';
import { awsTemplates } from './aws.js';

export type DeployPlatform = 'railway' | 'vercel' | 'docker' | 'aws';

export type { TemplateFile, DeployConfig } from './types.js';

const generators: Record<DeployPlatform, (config: DeployConfig) => TemplateFile[]> = {
  railway: railwayTemplates,
  vercel: vercelTemplates,
  docker: dockerTemplates,
  aws: awsTemplates,
};

export function generateDeployFiles(platform: DeployPlatform, config: DeployConfig): TemplateFile[] {
  const gen = generators[platform];
  if (!gen) throw new Error('unsupported platform: ' + platform);
  return gen(config);
}
