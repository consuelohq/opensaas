import { describe, expect, it } from 'bun:test';
import type { InboundQueuePolicy, RepCapacityState } from '@consuelo/dialer';
import {
  projectOperatorEndpoints,
  selectOperatorQueuePolicy,
} from './operator';

const policy = (queueId: string): InboundQueuePolicy => ({
  schemaVersion: 1,
  policyVersion: queueId + '-v1',
  workspaceId: 'workspace',
  queueId,
  timezone: 'America/New_York',
  weekly: [],
  closedDates: [],
  emergencyClosed: false,
  maxWaitMilliseconds: 60_000,
  maxOffers: 3,
  reofferMilliseconds: 5_000,
  profiles: [{ repId: 'rep', skills: [] }],
});
const syntheticPhone = ['+1', '828', '555', '0123'].join('');

describe('inbound operator projection helpers', () => {
  it('keeps provisioned endpoints visible when only a subset is active', () => {
    const active: RepCapacityState['endpoints'] = [
      { endpointId: 'browser', kind: 'browser', healthy: true },
    ];
    expect(
      projectOperatorEndpoints(
        [
          {
            workspaceId: 'workspace',
            repId: 'rep',
            endpointId: 'browser',
            kind: 'browser',
            address: 'rep',
          },
          {
            workspaceId: 'workspace',
            repId: 'rep',
            endpointId: 'phone',
            kind: 'phone',
            address: syntheticPhone,
          },
        ],
        'workspace',
        'rep',
        active,
      ),
    ).toEqual([
      {
        endpointId: 'browser',
        kind: 'browser',
        healthy: true,
        active: true,
        label: 'Browser',
      },
      {
        endpointId: 'phone',
        kind: 'phone',
        healthy: true,
        active: false,
        label: 'Forwarding phone',
      },
    ]);
  });

  it('projects an active assignment against the queue that owns its request', () => {
    const first = policy('first');
    const second = policy('second');
    expect(selectOperatorQueuePolicy([first, second], 'rep', 'second')).toEqual(second);
    expect(selectOperatorQueuePolicy([first, second], 'rep', null)).toEqual(first);
  });
});
