// Isolated local databases only; these tests never read DATABASE_URL.
const result = Bun.spawnSync(['bun','test',
  'packages/dialer-server/src/native-billing.acceptance.test.ts',
  'packages/dialer-server/src/native-billing.postgres.integration.test.ts',
  'packages/dialer-server/src/public-checkout.postgres.integration.test.ts',
  'packages/dialer-server/src/database/migrations.postgres.integration.test.ts'], {
  env:{...Bun.env,CONSUELO_RUN_NATIVE_BILLING_POSTGRES:'1',CONSUELO_RUN_PUBLIC_CHECKOUT_POSTGRES:'1',CONSUELO_RUN_LEAD_CONNECTOR_UPGRADE_POSTGRES:'1'},
  stdout:'inherit',stderr:'inherit',
});
process.exit(result.exitCode);
