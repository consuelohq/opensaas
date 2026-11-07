// Explicit database lane: every selected suite must execute on disposable resources.
export const qaPostgresSuites = [
  'inbound/rep-capacity.integration.test.ts',
  'inbound/routing.integration.test.ts',
  'inbound/telephony.integration.test.ts',
  'inbound/callbacks.integration.test.ts',
  'inbound/callback-telephony.integration.test.ts',
  'inbound/customer-entry.integration.test.ts',
  'runtime/inbound-registration.integration.test.ts',
  'coaching/scripts.postgres.integration.test.ts',
  'database/migrations.postgres.integration.test.ts',
  'public-checkout.postgres.integration.test.ts',
  'native-billing.postgres.integration.test.ts',
  'commercial/team.postgres.integration.test.ts',
] as const;
export const qaPostgresEnvironment = (
  port: number,
  parent: Record<string, string | undefined>,
) => {
  if (!Number.isInteger(port) || port <= 1024 || port >= 65536)
    throw new Error('Disposable PostgreSQL port required');
  const env: Record<string, string> = { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' };
  for (const key of [
    'PATH',
    'HOME',
    'TMPDIR',
    'TEMP',
    'TMP',
    'USER',
    'BUN_INSTALL',
  ])
    if (parent[key]) env[key] = parent[key]!;
  for (const flag of [
    'CONSUELO_RD3_PG_PORT',
    'CONSUELO_RD4_PG_PORT',
    'CONSUELO_RD5_PG_PORT',
    'CONSUELO_RD6_PG_PORT',
    'CONSUELO_RD7B_PG_PORT',
  ])
    env[flag] = String(port);
  for (const flag of [
    'CONSUELO_RUN_COACHING_POSTGRES',
    'CONSUELO_RUN_LEAD_CONNECTOR_UPGRADE_POSTGRES',
    'CONSUELO_RUN_PUBLIC_CHECKOUT_POSTGRES',
    'CONSUELO_RUN_NATIVE_BILLING_POSTGRES',
  ])
    env[flag] = '1';
  env.CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION = '0';
  return env;
};
export const parseDatabaseSuiteResult = (exitCode: number, output: string) => {
  const passed = Number(output.match(/(?:^|\n)\s*(\d+) pass\b/)?.[1] ?? 0);
  const failed = Number(output.match(/(?:^|\n)\s*(\d+) fail\b/)?.[1] ?? 0);
  const skipped = Number(output.match(/(?:^|\n)\s*(\d+) skip\b/)?.[1] ?? 0);
  if (exitCode !== 0 || !passed || failed || skipped)
    throw new Error(
      `Database lane incomplete: exit=${exitCode}, pass=${passed}, fail=${failed}, skip=${skipped}\n${output.slice(-2500)}`,
    );
  return { exitCode, passed, failed, skipped, suites: qaPostgresSuites.length };
};
