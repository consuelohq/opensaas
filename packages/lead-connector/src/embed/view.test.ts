import { describe, expect, it } from 'bun:test';

import {
  createInitialEmbedState,
  reduceEmbedState,
  selectEmbedTarget,
} from './state-machine';
import { renderLeadConnectorEmbed } from './view';

describe('LeadConnector embed view', () => {
  it('renders responsive controls, microphone guidance, selected context, and winner/loser presentation', () => {
    let state = selectEmbedTarget(createInitialEmbedState(), {
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
      opportunityId: 'opportunity-1',
      dedupeKey: 'contact-1:+15550100123',
    });
    state = reduceEmbedState(state, {
      type: 'SESSION_UPDATED',
      session: {
        groupId: 'group-1',
        status: 'connected',
        winnerSid: 'call-1',
        winner: null,
        calls: [
          {
            callSid: 'call-1',
            customerNumber: '+15550100123',
            position: 0,
            status: 'in-progress',
            amdResult: 'human',
            contactId: 'contact-1',
          },
          {
            callSid: 'call-2',
            customerNumber: '+15550100124',
            position: 1,
            status: 'completed',
            amdResult: 'human',
            contactId: 'contact-2',
          },
        ],
      },
    });
    const html = renderLeadConnectorEmbed(state);
    expect(html).toContain('Test Contact');
    expect(html).toContain('Start single call');
    expect(html).toContain('Start multiline call');
    expect(html).toContain('Allow microphone access');
    expect(html).toContain('Winner');
    expect(html).toContain('Losing leg');
    expect(html).toContain('data-action="submit-disposition"');
  });
});
