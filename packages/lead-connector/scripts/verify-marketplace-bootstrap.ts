import { readFileSync } from 'node:fs';

import { verifyLeadConnectorMarketplaceBootstrap } from '../src/deployment/marketplace-bootstrap.js';

const path = process.argv[2]?.trim();
if (!path) throw new Error('Marketplace bootstrap artifact path is required');

const expectedSha256 =
  process.env.LEADCONNECTOR_MARKETPLACE_BOOTSTRAP_SHA256?.trim();
if (!expectedSha256) {
  throw new Error('LEADCONNECTOR_MARKETPLACE_BOOTSTRAP_SHA256 is required');
}

const evidence = verifyLeadConnectorMarketplaceBootstrap({
  contents: readFileSync(path, 'utf8'),
  expectedSha256,
});

process.stdout.write(`${JSON.stringify({ ok: true, ...evidence })}\n`);
