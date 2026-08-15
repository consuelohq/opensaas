import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readRepoFile = (path: string): string =>
  readFileSync(resolve(repoRoot, path), 'utf8');

const forbiddenRuntimeTokens = [
  'twenty-server',
  'twenty-front',
  'twenty-docker',
  'consuelo-twenty',
  'twentyEnabled',
  'worker:prod',
  'twenty-server:database:migrate:prod',
];

const expectNoLegacyRuntime = (source: string): void => {
  for (const token of forbiddenRuntimeTokens) {
    expect(
      source,
      `unexpected executable Twenty reference: ${token}`,
    ).not.toContain(token);
  }
};

describe('M3 Twenty executable boundary', () => {
  it('makes root development target the standalone dialer runtime', () => {
    const rootPackage = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const start = rootPackage.scripts?.start ?? '';

    expect(start).toContain('packages/dialer-server');
    expectNoLegacyRuntime(start);

    const compose = readRepoFile('docker-compose.yml');
    expect(compose).toContain('postgres:16');
    expect(compose).toContain('redis:7');
    expectNoLegacyRuntime(compose);
    expect(compose).not.toMatch(/^\s{2}(server|worker|api):/m);
  });

  it('does not advertise retired Twenty dev or deploy commands through the Consuelo CLI', () => {
    const cliIndex = readRepoFile('packages/cli/src/index.ts');
    expect(cliIndex).not.toContain('registerDev');
    expect(cliIndex).not.toContain('registerDeploy');
    expect(
      existsSync(resolve(repoRoot, 'packages/cli/src/commands/dev.ts')),
    ).toBe(false);
    expect(
      existsSync(resolve(repoRoot, 'packages/cli/src/commands/deploy.ts')),
    ).toBe(false);
    expect(
      existsSync(resolve(repoRoot, 'packages/cli/src/templates/deploy')),
    ).toBe(false);
  });

  it('generates only standalone Postgres and Redis infrastructure for self-hosted setup', () => {
    const generator = readRepoFile('packages/cli/src/generators/docker.ts');
    expect(generator).toContain('postgres:16');
    expect(generator).toContain('redis:7');
    expectNoLegacyRuntime(generator);
    expect(generator).not.toMatch(/^\s{2}(server|worker|api):/m);
  });

  it('keeps automated development bootstrap off the legacy Twenty stack', () => {
    const cursorEnvironment = readRepoFile('.cursor/environment.json');
    expect(cursorEnvironment).toContain('docker compose up -d db redis');
    expectNoLegacyRuntime(cursorEnvironment);
    expect(
      existsSync(resolve(repoRoot, '.cursor/environment.docker-compose.json')),
    ).toBe(false);
    expect(existsSync(resolve(repoRoot, '.vscode/tasks.json'))).toBe(false);
    expect(existsSync(resolve(repoRoot, '.vscode/launch.json'))).toBe(false);
    expect(existsSync(resolve(repoRoot, '.vscode/twenty.code-workspace'))).toBe(
      false,
    );
  });

  it('never automatically publishes a legacy Twenty image from main', () => {
    const imageWorkflow = readRepoFile(
      '.github/workflows/ci-docker-build.yaml',
    );
    expect(imageWorkflow).toContain('workflow_dispatch:');
    expect(imageWorkflow).not.toMatch(/^\s*push:\s*$/m);
    expect(imageWorkflow).toContain('consuelohq/opensaas-legacy-twenty');

    const composeWorkflow = readRepoFile(
      '.github/workflows/ci-test-docker-compose.yaml',
    );
    expect(composeWorkflow).not.toContain("- 'docker-compose.yml'");
    expect(composeWorkflow).not.toMatch(/^\s{8}docker-compose\.yml\s*$/m);
  });
});
