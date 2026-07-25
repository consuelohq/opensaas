import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readRepoFile = (path: string) =>
  readFileSync(resolve(repoRoot, path), 'utf8');

describe('Docker Compose database extensions', () => {
  it('uses the pgvector-capable database image in the CI-owned compose file', () => {
    const workflow = readRepoFile('.github/workflows/ci-test-docker-compose.yaml');
    const compose = readRepoFile('packages/twenty-docker/docker-compose.yml');

    expect(workflow).toContain('working-directory: ./packages/twenty-docker/');
    expect(compose).toContain('image: pgvector/pgvector:0.8.5-pg16');
    expect(compose).not.toContain('image: postgres:16');
    expect(compose).not.toContain('twenty-postgres-spilo');
  });
});
