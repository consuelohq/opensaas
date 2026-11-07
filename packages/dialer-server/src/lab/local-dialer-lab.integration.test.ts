import { runBoundedQaProcess } from './bounded-qa-process';
import { CALLBACK_BOOKING_ATTEMPTS_MIGRATION_ID } from '../inbound/callback-booking-attempt-migration';
import { CALLBACK_MIGRATION_ID } from '../inbound/callback-migration';
import { CALLBACK_BOOKING_EVENTS_MIGRATION_ID } from '../inbound/callback-booking-event-migration';
import { CUSTOMER_ENTRY_MIGRATION_ID } from '../inbound/customer-entry-migration';
import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';

const integrationEnabled =
  process.env.CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('local dialer lab service integration', () => {
  it('migrates an empty isolated Postgres, exercises Redis, and tears both down', async () => {
    expect(Bun.which('pg_config')).not.toBeNull();
    expect(Bun.which('redis-server')).not.toBeNull();

    const scriptPath = fileURLToPath(
      new URL('../../scripts/local-dialer-lab.ts', import.meta.url),
    );
    const processHandle = Bun.spawn(
      ['bun', scriptPath, '--scale', 'smoke', '--seed', '4242', '--qa'],
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
      qa?: {
        level: string;
        stages: {
          reps: number;
          connected: number;
          duplicateAcceptsRejected: number;
          authenticatedActors: number;
          clean: boolean;
        }[];
        databaseSuites: { exitCode: number; skipped: number };
      };
      simulation?: {
        scenarioCount: number;
        allWorkersExited: boolean;
        replayWithoutEffects: boolean;
        postgresReplayVerified: boolean;
        deterministicReplay: boolean;
      };
      inbound: {
        assertions: number;
        concurrentWinners: number;
        replayWithoutEffects: boolean;
      };
      isolation: {
        postgresPort: number;
        redisPort: number;
        productionCredentialsUsed: boolean;
        externalProvidersUsed: boolean;
      };
      migration: {
        applied: string[];
        rollbackVerified: boolean;
        learningRollbackChainVerified: boolean;
      };
      persistedFixture: {
        candidateLedgerRows: number;
        trainingOutcomeRows: number;
        canonicalObservationRows: number;
      };
      benchmarks: {
        dataset: { seed: number };
        ranking: Record<string, unknown>;
        aggregation: { groups: number };
        ingestion: { operations: number };
        scientificValidation: {
          observedAttemptNumbers: number[];
          observedProbabilities: number[];
          censoredAttemptExcludedFromDenominator: boolean;
          idempotency: {
            canonicalRows: number;
            ledgerAttempts: number;
            compatibilityOutcomeRows: number;
          };
        };
        runtimeCutover: {
          canonicalTopContactId: string | null;
          canonicalPreferredAttempt: number;
          compatibilityPreferredAttempt: number;
          compatibilityConflictIgnored: boolean;
          legacyBaselineAttemptNumbers: number[];
        };
        redisCoordination: { samples: number };
      };
      cleanup: {
        postgresClosed: boolean;
        redisClosed: boolean;
        tempDirectoryRemoved: boolean;
      };
    };

    expect(result.ok).toBe(true);
    expect(result.qa?.level).toBe('local-http-postgres');
    expect(result.qa?.stages.map((stage) => stage.reps)).toEqual([1, 2, 5, 20]);
    expect(
      result.qa?.stages.every(
        (stage) =>
          stage.connected === stage.reps &&
          stage.duplicateAcceptsRejected === stage.reps &&
          stage.authenticatedActors === stage.reps &&
          stage.clean,
      ),
    ).toBe(true);
    expect(result.qa?.databaseSuites).toMatchObject({
      exitCode: 0,
      skipped: 0,
    });
    expect(result.simulation?.scenarioCount).toBeGreaterThanOrEqual(14);
    expect(result.simulation?.allWorkersExited).toBe(true);
    expect(result.simulation?.replayWithoutEffects).toBe(true);
    expect(result.simulation?.postgresReplayVerified).toBe(true);
    expect(result.simulation?.deterministicReplay).toBe(true);
    expect(result.inbound.concurrentWinners).toBe(1);
    expect(result.inbound.replayWithoutEffects).toBe(true);
    expect(result.inbound.assertions).toBeGreaterThanOrEqual(20);
    expect(result.migration.rollbackVerified).toBe(true);
    expect(result.migration.applied).toContain(CALLBACK_MIGRATION_ID);
    expect(result.migration.applied).toContain(CUSTOMER_ENTRY_MIGRATION_ID);
    expect(result.migration.applied).toContain(
      CALLBACK_BOOKING_EVENTS_MIGRATION_ID,
    );
    expect(result.migration.applied).toContain(
      CALLBACK_BOOKING_ATTEMPTS_MIGRATION_ID,
    );
    expect(result.migration.learningRollbackChainVerified).toBe(true);
    expect(result.migration.applied).toContain('20260910_006_inbound_journal');
    expect(result.isolation.postgresPort).not.toBe(result.isolation.redisPort);
    expect(result.isolation.productionCredentialsUsed).toBe(false);
    expect(result.isolation.externalProvidersUsed).toBe(false);
    expect(result.migration.applied).toContain(
      '20260810_001_standalone_dialer_baseline',
    );
    expect(result.migration.applied).toContain(
      '20260815_002_predictive_learning_observations',
    );
    expect(result.migration.applied).toContain(
      '20260815_003_contextual_predictive_science',
    );
    expect(result.migration.applied).toContain(
      '20260815_004_contextual_predictive_science_hardening',
    );
    expect(result.migration.applied).toContain(
      '20260815_005_learning_observation_integrity',
    );
    expect(result.persistedFixture).toEqual({
      candidateLedgerRows: 250,
      trainingOutcomeRows: 1_000,
      canonicalObservationRows: 1_000,
    });
    expect(result.benchmarks.dataset.seed).toBe(4242);
    expect(Object.keys(result.benchmarks.ranking)).toEqual([
      '25',
      '100',
      '250',
    ]);
    expect(result.benchmarks.aggregation.groups).toBeGreaterThan(0);
    expect(result.benchmarks.ingestion.operations).toBe(50);
    expect(
      result.benchmarks.scientificValidation.observedAttemptNumbers,
    ).toEqual([1, 3]);
    expect(
      result.benchmarks.scientificValidation.observedProbabilities,
    ).toEqual([1, 0]);
    expect(
      result.benchmarks.scientificValidation
        .censoredAttemptExcludedFromDenominator,
    ).toBe(true);
    expect(result.benchmarks.scientificValidation.idempotency).toEqual({
      canonicalRows: 1,
      ledgerAttempts: 1,
      compatibilityOutcomeRows: 1,
    });
    expect(result.benchmarks.runtimeCutover).toEqual({
      canonicalTopContactId: 'cutover-canonical-winner',
      canonicalPreferredAttempt: 2,
      compatibilityPreferredAttempt: 1,
      compatibilityConflictIgnored: true,
      legacyBaselineAttemptNumbers: [3, 4],
    });
    expect(result.benchmarks.redisCoordination.samples).toBe(50);
    expect(result.cleanup).toEqual({
      postgresClosed: true,
      redisClosed: true,
      tempDirectoryRemoved: true,
    });
  }, 120_000);
  it('terminates a blocked suite and cleans a daemonized child-owned PostgreSQL cluster', async () => {
    const script = `
      import {mkdtemp} from 'node:fs/promises';
      import {join} from 'node:path';
      import {tmpdir} from 'node:os';
      const root=await mkdtemp(join(tmpdir(),'deadline-proof-'));
      const bindir=Bun.spawnSync(['pg_config','--bindir']).stdout.toString().trim();
      const data=join(root,'postgres');
      const init=Bun.spawnSync([join(bindir,'initdb'),'-D',data,'--auth=trust','--username=postgres','--no-locale']);
      if(init.exitCode!==0) throw new Error('Fixture initdb failed');
      const listener=Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response('fixture')});
      const port=listener.port;listener.stop(true);
      const started=Bun.spawnSync([join(bindir,'pg_ctl'),'-D',data,'-l',join(root,'pg.log'),'-o',"-h 127.0.0.1 -p "+port+" -F -c unix_socket_directories=''",'-w','start']);
      if(started.exitCode!==0) throw new Error('Fixture PostgreSQL start failed');
      process.stdout.write(JSON.stringify({port,data}));
      setInterval(()=>{},1000);
    `;
    const result = await runBoundedQaProcess(
      [process.execPath, '--no-env-file', '-e', script],
      { PATH: process.env.PATH! },
      5000,
    );
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
    expect(result.recoveredPostgres).toBe(1);
    const proof = JSON.parse(result.stdout);
    expect(await Bun.file(proof.data + '/postmaster.pid').exists()).toBe(false);
    const { createConnection } = await import('node:net');
    const open = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host: '127.0.0.1', port: proof.port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    expect(open).toBe(false);
  }, 20000);
});
