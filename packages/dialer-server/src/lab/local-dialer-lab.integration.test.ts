import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';

const integrationEnabled =
  process.env.CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('local dialer lab service integration', () => {
  it(
    'migrates an empty isolated Postgres, exercises Redis, and tears both down',
    async () => {
      expect(Bun.which('pg_config')).not.toBeNull();
      expect(Bun.which('redis-server')).not.toBeNull();

      const scriptPath = fileURLToPath(
        new URL('../../scripts/local-dialer-lab.ts', import.meta.url),
      );
      const processHandle = Bun.spawn(
        ['bun', scriptPath, '--scale', 'smoke', '--seed', '4242'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        },
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(processHandle.stdout).text(),
        new Response(processHandle.stderr).text(),
        processHandle.exited,
      ]);

      expect(exitCode, stderr).toBe(0);
      const result = JSON.parse(stdout) as {
        ok: boolean;
        isolation: {
          postgresPort: number;
          redisPort: number;
          productionCredentialsUsed: boolean;
          externalProvidersUsed: boolean;
        };
        migration: { applied: string[] };
        persistedFixture: {
          candidateLedgerRows: number;
          trainingOutcomeRows: number;
        };
        benchmarks: {
          dataset: { seed: number };
          ranking: Record<string, unknown>;
          aggregation: { groups: number };
          ingestion: { operations: number };
          redisCoordination: { samples: number };
        };
        cleanup: {
          postgresClosed: boolean;
          redisClosed: boolean;
          tempDirectoryRemoved: boolean;
        };
      };

      expect(result.ok).toBe(true);
      expect(result.isolation.postgresPort).not.toBe(
        result.isolation.redisPort,
      );
      expect(result.isolation.productionCredentialsUsed).toBe(false);
      expect(result.isolation.externalProvidersUsed).toBe(false);
      expect(result.migration.applied).toContain(
        '20260810_001_standalone_dialer_baseline',
      );
      expect(result.persistedFixture).toEqual({
        candidateLedgerRows: 250,
        trainingOutcomeRows: 1_000,
      });
      expect(result.benchmarks.dataset.seed).toBe(4242);
      expect(Object.keys(result.benchmarks.ranking)).toEqual([
        '25',
        '100',
        '250',
      ]);
      expect(result.benchmarks.aggregation.groups).toBeGreaterThan(0);
      expect(result.benchmarks.ingestion.operations).toBe(50);
      expect(result.benchmarks.redisCoordination.samples).toBe(50);
      expect(result.cleanup).toEqual({
        postgresClosed: true,
        redisClosed: true,
        tempDirectoryRemoved: true,
      });
    },
    30_000,
  );
});
