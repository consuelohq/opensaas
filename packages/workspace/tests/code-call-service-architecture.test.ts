import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const codeCallRoot = join(here, '..', 'scripts', 'lib', 'code-call');
const requiredModules = [
  'errors.ts',
  'schema.ts',
  'location.ts',
  'source.ts',
  'file-source-guard.ts',
  'policy.ts',
  'runtimes.ts',
  'process.ts',
  'snapshot.ts',
  'output.ts',
  'service.ts',
  'runtime.ts',
];
const effectBackedModules = [
  'schema.ts',
  'location.ts',
  'source.ts',
  'file-source-guard.ts',
  'policy.ts',
  'process.ts',
  'snapshot.ts',
  'output.ts',
  'service.ts',
];

function modulePath(relativePath: string): string {
  return join(codeCallRoot, relativePath);
}

function readModule(relativePath: string): string {
  return readFileSync(modulePath(relativePath), 'utf8');
}

function hasEffectImport(source: string): boolean {
  return /from ['"]effect['"]/.test(source) && /\bEffect\./.test(source);
}

function codeCallModuleFiles(): string[] {
  return readdirSync(codeCallRoot).filter((entry) => entry.endsWith('.ts'));
}

describe('code.call service architecture', () => {
  it('splits code.call into effect-backed service modules', () => {
    for (const relativePath of requiredModules) {
      expect(existsSync(modulePath(relativePath)), relativePath).toBe(true);
    }

    const runtimeSource = readModule('runtime.ts');
    const serviceSource = readModule('service.ts');

    expect(runtimeSource).toContain("from './service'");
    expect(runtimeSource).toContain('executeCodeCall');
    expect(serviceSource).toContain('Effect.gen');

    for (const relativePath of effectBackedModules) {
      expect(hasEffectImport(readModule(relativePath)), relativePath).toBe(true);
    }
  });

  it('keeps Effect.gen orchestration free of await and broad try/catch', () => {
    for (const moduleFile of codeCallModuleFiles()) {
      const moduleSource = readModule(moduleFile);
      expect(moduleSource, moduleFile).not.toMatch(/\bawait\b/);
      expect(moduleSource, moduleFile).not.toMatch(/\btry\s*\{/);
      expect(moduleSource, moduleFile).not.toMatch(/\bcatch\s*\(/);
    }
  });
});
