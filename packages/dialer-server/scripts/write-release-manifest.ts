import { readFileSync, writeFileSync } from 'node:fs';

import { buildDialerReleaseManifest } from '../src/release/production-release.js';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith('--') || !value)
    throw new Error('Invalid manifest arguments');
  args.set(key.slice(2), value);
}
const required = (name: string): string => {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
};
const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(required(name), 'utf8')) as T;

const railway = readJson<{ deploymentId: string; status: string }>('railway');
const cloudflare = readJson<{ versionId: string }>('cloudflare');
const edge = readJson<{
  ok: boolean;
  javascriptSha256: string;
  cssSha256: string;
}>('edge');
const customMenu = readJson<{
  customMenuId: string;
  readBackVerified: boolean;
}>('custom-menu');
const smoke = readJson<{
  ok: boolean;
  checks: Array<{
    name: string;
    method: 'GET' | 'POST';
    path: string;
    expectedStatus: number;
    actualStatus: number;
    ok: boolean;
  }>;
}>('smoke');
const buildMarker = readJson<{ buildMarker: string }>('build-marker');
const gitSha = process.env.GITHUB_SHA?.trim();
if (!gitSha) throw new Error('GITHUB_SHA is required');
const manifest = {
  ...buildDialerReleaseManifest({
    gitSha,
    railway,
    cloudflare: {
      versionId: cloudflare.versionId,
      buildMarker: buildMarker.buildMarker,
    },
    assets: {
      javascriptSha256: edge.javascriptSha256,
      cssSha256: edge.cssSha256,
    },
    customMenu,
    smoke,
  }),
  releasedAt: new Date().toISOString(),
};
writeFileSync(required('output'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(manifest)}\n`);
