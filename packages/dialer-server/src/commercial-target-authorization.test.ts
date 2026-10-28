import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import type {
  DialerIdentity,
  LeadConnectorServerApplication,
} from './contracts';
import { resolveCommercialCallTargetInput } from './commercial-target-authorization';

const identity: DialerIdentity = {
  workspaceId: 'workspace-1',
  userId: 'user-1',
  installationId: 'installation-1',
  locationId: 'location-1',
};
const authorizedPhone = ['+1', '555', '555', '0100'].join('');
const ignoredDirectPhone = ['+1', '888', '888', '8888'].join('');
const ignoredBatchPhone = ['+1', '999', '999', '9999'].join('');

describe('commercial call target authorization science context', () => {
  it('captures non-PII opportunity facts from the server-authorized queue preview', async () => {
    const leadConnector = {
      resolveQueueCandidates: () =>
        Effect.succeed({
          pipelineId: 'pipeline-1',
          pipelineName: 'Pipeline',
          stageId: 'stage-1',
          stageName: 'Qualified',
          opportunityTotal: 1,
          callableTotal: 1,
          truncated: false,
          candidates: [
            {
              opportunityId: 'opportunity-1',
              contactId: 'contact-1',
              contactName: 'Ada Lovelace',
              phone: authorizedPhone,
              status: 'open',
              monetaryValue: 1_250,
            },
          ],
        }),
    } as unknown as LeadConnectorServerApplication;

    const result = await resolveCommercialCallTargetInput(
      {
        source: 'queue',
        queueId: 'pipeline-1:stage-1',
        contactIds: ['contact-1'],
        targetPhone: ignoredDirectPhone,
        targetPhones: [ignoredBatchPhone],
      },
      identity,
      leadConnector,
    );

    expect(result).toEqual(
      expect.objectContaining({
        queueId: 'pipeline-1:stage-1',
        contactIds: ['contact-1'],
        targetPhones: [authorizedPhone],
        targetContexts: [
          {
            contactId: 'contact-1',
            context: {
              opportunityId: 'opportunity-1',
              pipelineId: 'pipeline-1',
              stageId: 'stage-1',
              opportunityStatus: 'open',
              opportunityValue: 1_250,
            },
          },
        ],
      }),
    );
    expect(result).not.toHaveProperty('targetPhone');
    expect(JSON.stringify(result.targetContexts)).not.toContain('Ada Lovelace');
    expect(JSON.stringify(result.targetContexts)).not.toContain(authorizedPhone);
  });

  it('removes client scientific context from direct calls after server authorization', async () => {
    const leadConnector = {
      getContact: () =>
        Effect.succeed({
          id: 'contact-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          name: 'Ada Lovelace',
          email: null,
          phone: authorizedPhone,
          tags: [],
        }),
    } as unknown as LeadConnectorServerApplication;

    const result = await resolveCommercialCallTargetInput(
      {
        source: 'direct',
        contactId: 'contact-1',
        targetPhone: ignoredBatchPhone,
        targetContexts: [
          {
            contactId: 'contact-1',
            context: {
              contactTimezone: 'Pacific/Kiritimati',
              opportunityValue: 1_000_000_000,
            },
          },
        ],
      },
      identity,
      leadConnector,
    );

    expect(result.targetPhone).toBe(authorizedPhone);
    expect(result).not.toHaveProperty('targetContexts');
  });
});
