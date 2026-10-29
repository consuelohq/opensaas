import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requirePreviewOrigin } from './lib/preview-deploy.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, DOCS_SITE_URL: requirePreviewOrigin(process.env.DOCS_SITE_URL), PUBLIC_DOCS_PREVIEW: '1' };
for (const args of [['run', 'build'], ['x', 'wrangler', 'deploy', '--config', 'dist/server/wrangler.json']]) {
  const result = spawnSync('bun', args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
