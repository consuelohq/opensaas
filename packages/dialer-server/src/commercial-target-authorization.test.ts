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
              phone: '+15555550100',
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
        targetPhones: ['+19999999999'],
      },
      identity,
      leadConnector,
    );

    expect(result).toEqual(
      expect.objectContaining({
        queueId: 'pipeline-1:stage-1',
        contactIds: ['contact-1'],
        targetPhones: ['+15555550100'],
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
    expect(JSON.stringify(result.targetContexts)).not.toContain('Ada Lovelace');
    expect(JSON.stringify(result.targetContexts)).not.toContain('+15555550100');
  });
});
