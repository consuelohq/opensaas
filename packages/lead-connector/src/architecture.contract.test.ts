import { describe, expect, it } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const sourceRoot = new URL('.', import.meta.url).pathname;
const packageRoot = resolve(sourceRoot, '..');
const repositoryRoot = resolve(packageRoot, '../..');

const collectSourceFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      if (!entry.isFile() || extname(entry.name) !== '.ts') return [];
      if (entry.name.endsWith('.test.ts')) return [];
      return [path];
    }),
  );
  return nested.flat();
};

const readPublicSource = async () => {
  const files = await collectSourceFiles(sourceRoot);
  return Promise.all(
    files.map(async (path) => ({
      path,
      content: await readFile(path, 'utf8'),
    })),
  );
};

const allowedProviderWireOrigins = [
  'https://*.twilio.com',
  'wss://*.twilio.com',
];

const stripAllowedProviderWireOrigins = (text: string): string => {
  let scanned = text;
  for (const origin of allowedProviderWireOrigins) {
    scanned = scanned.replaceAll(origin, 'https://voice-provider.example');
  }
  return scanned;
};

const publicSurfaceFiles = [
  resolve(packageRoot, 'package.json'),
  resolve(repositoryRoot, 'packages/dialer-server/package.json'),
  resolve(repositoryRoot, 'packages/dialer-server/src/app.ts'),
  resolve(repositoryRoot, 'packages/dialer-server/src/contracts.ts'),
  resolve(repositoryRoot, 'packages/dialer-server/src/errors.ts'),
  resolve(
    repositoryRoot,
    'packages/dialer-server/src/lead-connector-application.ts',
  ),
  resolve(
    repositoryRoot,
    'packages/dialer-server/src/routes/lead-connector.ts',
  ),
];

describe('LeadConnector public architecture and branding contracts', () => {
  it('keeps server telephony and dialer lifecycle dependencies out of the LeadConnector package', async () => {
    const files = await readPublicSource();
    const forbiddenDependencies = [
      '@consuelo/dialer',
      'twenty-server',
      'twenty-front',
      '@nestjs/',
      'graphql',
    ];

    for (const { path, content } of files) {
      const normalized = stripAllowedProviderWireOrigins(content).toLowerCase();
      for (const dependency of forbiddenDependencies) {
        expect(
          normalized,
          `${path} imported forbidden server/runtime dependency ${dependency}`,
        ).not.toContain(dependency.toLowerCase());
      }
      if (!path.endsWith('/embed/agent-voice.ts')) {
        expect(
          normalized,
          `${path} leaked telephony SDK usage outside the isolated browser adapter`,
        ).not.toContain('twilio');
      }
    }

    const browserVoice = files.find(({ path }) =>
      path.endsWith('/embed/agent-voice.ts'),
    );
    expect(browserVoice?.content).toContain(
      "from '@twilio/voice-sdk'",
    );
    expect(browserVoice?.content).not.toContain("from 'twilio'");

    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    expect(packageJson.dependencies?.['@twilio/voice-sdk']).toBe('^2.12.1');
    expect(packageJson.dependencies?.twilio).toBeUndefined();
  });

  it('uses LeadConnector naming on every customer-visible and public package surface', async () => {
    const files = [
      ...(await readPublicSource()),
      ...(await Promise.all(
        publicSurfaceFiles.map(async (path) => ({
          path,
          content: await readFile(path, 'utf8'),
        })),
      )),
    ];
    const allowedProviderWireNames = [
      'x-ghl-signature',
      'https://app.gohighlevel.com',
    ];
    const forbiddenFragments = [
      ['g', 'h', 'l'].join(''),
      ['go', 'high', 'level'].join(''),
      ['high', 'level'].join(''),
    ];

    for (const { path, content } of files) {
      let scanned = content.toLowerCase();
      for (const allowed of allowedProviderWireNames) {
        scanned = scanned.replaceAll(allowed, 'provider-signature-header');
      }
      for (const forbidden of forbiddenFragments) {
        expect(
          scanned,
          `${path} leaked forbidden provider branding`,
        ).not.toContain(forbidden);
      }
    }
  });
});
