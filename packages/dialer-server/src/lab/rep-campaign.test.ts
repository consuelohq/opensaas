import { assertDisposableInboundDatabase } from './historical-inbound-fixture';
import { it, expect } from 'bun:test';
import {
  createRepCampaignPlan,
  inspectCapacityInvariants,
} from './rep-campaign-plan';
import {
  qaPostgresEnvironment,
  parseDatabaseSuiteResult,
} from './qa-postgres-suites';
it('seed drives real actor/arrival schedule and bounds actor count', () => {
  const plan = createRepCampaignPlan(42, 20);
  expect(plan.actors).toHaveLength(20);
  expect(new Set(plan.actors).size).toBe(20);
  expect(plan.arrivals).toHaveLength(21);
  expect(createRepCampaignPlan(42, 20)).toEqual(plan);
  expect(createRepCampaignPlan(43, 20).arrivals).not.toEqual(plan.arrivals);
  expect(() => createRepCampaignPlan(42, 21)).toThrow();
});
it('independent oracle detects planted capacity and endpoint violations', () => {
  const owner = {
    assignmentId: 'a',
    requestId: 'r',
    endpoints: [{ status: 'accepted' }],
  };
  expect(inspectCapacityInvariants([{ repId: 'one', owner }]).valid).toBe(true);
  const bad = inspectCapacityInvariants([
    {
      repId: 'one',
      owner: {
        ...owner,
        endpoints: [{ status: 'accepted' }, { status: 'accepted' }],
      },
    },
    { repId: 'one', owner },
  ]);
  expect(bad.violations).toEqual([
    'duplicate-endpoint-winner',
    'duplicate-rep-capacity',
    'duplicate-request-owner',
    'duplicate-assignment-owner',
  ]);
});
it('database execution cannot inherit live keys/URLs or hide skipped tests', () => {
  const env = qaPostgresEnvironment(15432, {
    PATH: '/bin',
    DATABASE_URL: 'production',
    TWILIO_AUTH_TOKEN: 'private',
    STRIPE_SECRET_KEY: 'private',
    CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION: '1',
  });
  expect(env.DATABASE_URL).toBeUndefined();
  expect(env.TWILIO_AUTH_TOKEN).toBeUndefined();
  expect(env.STRIPE_SECRET_KEY).toBeUndefined();
  expect(env.CONSUELO_RD5_PG_PORT).toBe('15432');
  expect(env.CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION).toBe('0');
  expect(() => parseDatabaseSuiteResult(0, '93 skip\n0 fail')).toThrow();
  expect(() =>
    parseDatabaseSuiteResult(0, '10 pass\n1 skip\n0 fail'),
  ).toThrow();
  expect(parseDatabaseSuiteResult(0, '93 pass\n0 fail').skipped).toBe(0);
});

it('historical fixture refuses production or arbitrary database names', () => {
  expect(() => assertDisposableInboundDatabase('postgres')).toThrow();
  expect(() => assertDisposableInboundDatabase('production')).toThrow();
  expect(() =>
    assertDisposableInboundDatabase('rd5_' + 'a'.repeat(32)),
  ).not.toThrow();
});

it('bounds a 40-caller burst for 20 distinct reps without pretending 40 capacity units exist', () => {
  const p = createRepCampaignPlan(42, 20, 40);
  expect(p.arrivals).toHaveLength(40);
  expect(p.actors).toHaveLength(20);
  expect(createRepCampaignPlan(42, 20, 40)).toEqual(p);
  expect(() => createRepCampaignPlan(42, 20, 41)).toThrow();
});
