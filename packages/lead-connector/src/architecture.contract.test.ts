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
  it('has no Twenty, NestJS, GraphQL, Twilio, or dialer lifecycle dependency', async () => {
    const files = await readPublicSource();
    const source = files.map(({ content }) => content).join('\n');
    const forbiddenDependencies = [
      '@consuelo/dialer',
      'twenty-server',
      'twenty-front',
      '@nestjs/',
      'graphql',
      'twilio',
    ];

    for (const dependency of forbiddenDependencies) {
      expect(source.toLowerCase()).not.toContain(dependency.toLowerCase());
    }
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
    const allowedProviderWireNames = ['x-ghl-signature'];
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
