import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyLeadConnectorProductionEdge } from '../src/deployment/worker-release.js';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const result = await verifyLeadConnectorProductionEdge({
  baseUrl: required('LEADCONNECTOR_PRODUCTION_EMBED_URL'),
  javascriptSha256: sha256(
    join(
      packageRoot,
      'dist',
      'embed-app',
      'consuelo-lead-connector-click-to-call.js',
    ),
  ),
  cssSha256: sha256(
    join(
      packageRoot,
      'dist',
      'embed-app',
      'consuelo-lead-connector-click-to-call.css',
    ),
  ),
});
process.stdout.write(`${JSON.stringify(result)}\n`);
if (!result.ok) process.exit(1);
