import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const packageRoot = resolve(import.meta.dir, '..');
const srcRoot = resolve(packageRoot, 'src');
const read = (path: string) => readFileSync(resolve(packageRoot, path), 'utf8');
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith('.ts') && !path.endsWith('.test.ts')
        ? [path]
        : [];
  });

describe('dialer-server architecture', () => {
  it('is a private Hono package with a Bun-only process boundary', () => {
    const manifest = JSON.parse(read('package.json'));
    expect(manifest.private).toBe(true);
    expect(manifest.dependencies.hono).toBeDefined();
    expect(manifest.dependencies['@consuelo/dialer']).toBeDefined();
    expect(existsSync(resolve(srcRoot, 'app.ts'))).toBe(true);
    expect(existsSync(resolve(srcRoot, 'main.ts'))).toBe(true);
    expect(read('src/main.ts')).toContain('Bun.serve({');
    expect(read('src/app.ts')).not.toContain('Bun.serve');
  });

  it('has zero Twenty, NestJS, GraphQL, or LeadConnector branding leakage', () => {
    for (const file of sourceFiles(srcRoot)) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(
        /from ['"][^'"]*(twenty|@nestjs|graphql)/i,
      );
      expect(source, file).not.toMatch(/GoHighLevel|HighLevel|\bGHL\b/i);
    }
  });

  it('keeps dialer decisions out of route and middleware source', () => {
    for (const area of ['routes', 'middleware']) {
      const directory = resolve(srcRoot, area);
      for (const file of sourceFiles(directory)) {
        const source = readFileSync(file, 'utf8');
        expect(source, file).not.toMatch(
          /claimWinner|winner-take-all|terminateLoser|telemetryEmitted|selectCallerId|amdPolicy/i,
        );
      }
    }
  });
});
