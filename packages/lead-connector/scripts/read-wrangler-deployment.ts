import { readFileSync } from 'node:fs';

import { parseWranglerDeploymentOutput } from '../src/deployment/worker-release.js';

const path = process.argv[2]?.trim();
if (!path) throw new Error('Wrangler output file path is required');
process.stdout.write(
  `${JSON.stringify(parseWranglerDeploymentOutput(readFileSync(path, 'utf8')))}\n`,
);
