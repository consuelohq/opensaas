import type { CrmClient } from '../crm/client.js';
import type { DealResult } from '../crm/types.js';
import type { SkillSuggestion } from '../types.js';

import type {
  ActiveDealContext,
  CallParticipant,
  ExpandedCallContext,
} from './call-context.types.js';

// strip newlines and backtick fences from untrusted CRM fields
const sanitizeField = (value: string): string =>
  value.replace(/[\n\r]/g, ' ').replace(/```/g, '');

const toDealContext = (deal: DealResult): ActiveDealContext => ({
  dealId: deal.id,
  dealName: deal.name,
  stage: deal.stage,
  value: deal.amount ?? 0,
  lastActivityAt: new Date(),
  daysInStage: 0,
});

export const loadCallContext = async (
  callSid: string,
  contactId: string,
  crmClient: CrmClient,
): Promise<ExpandedCallContext> => {
  try {
    const [contact, deals] = await Promise.all([
      crmClient.getContact(contactId) as Promise<{ name?: string } | null>,
      crmClient.listDeals({ contactId }),
    ]);

    const contactName = (contact?.name ?? 'Unknown') as string;

    // find most recent open deal (not closed)
    const openDeals = deals.filter(
      (d) => d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST',
    );
    const dealContext = openDeals.length > 0 ? toDealContext(openDeals[0]) : undefined;

    return {
      callSid,
      contactId,
      contactName,
      direction: 'outbound',
      startedAt: new Date(),
      durationSeconds: 0,
      participants: [{ callSid, label: 'agent' }],
      dealContext,
      recentNotes: [],
    };
  } catch (err: unknown) {
    // return minimal context on failure — don't block the call
    const message = err instanceof Error ? err.message : 'unknown error';
    void message;

    return {
      callSid,
      contactId,
      contactName: 'Unknown',
      direction: 'outbound',
      startedAt: new Date(),
      durationSeconds: 0,
      participants: [{ callSid, label: 'agent' }],
      recentNotes: [],
    };
  }
};

export const buildCallContextBlock = (context: ExpandedCallContext): string => {
  const parts: string[] = [];

  const duration = context.durationSeconds > 0
    ? `${Math.floor(context.durationSeconds / 60)}m ${context.durationSeconds % 60}s`
    : 'just started';

  parts.push(
    `Active call: ${context.direction} with ${sanitizeField(context.contactName)} (ID: ${context.contactId}) — ${duration}`,
  );

  if (context.participants.length > 0) {
    const labels = context.participants.map((p: CallParticipant) => p.label).join(', ');
    parts.push(`Participants: ${labels}`);
  }

  if (context.dealContext) {
    const deal = context.dealContext;
    parts.push(
      `Deal: ${sanitizeField(deal.dealName)} — ${sanitizeField(deal.stage)}, $${deal.value.toLocaleString()}, ${deal.daysInStage}d in stage`,
    );
  }

  if (context.recentNotes.length > 0) {
    const notes = context.recentNotes
      .slice(0, 3)
      .map((n: string) => `- ${sanitizeField(n)}`)
      .join('\n');
    parts.push(`Recent notes:\n${notes}`);
  }

  return parts.join('\n');
};

export const suggestSkills = (
  event: 'call_started' | 'call_ended',
  contactName?: string,
): SkillSuggestion[] => {
  const name = contactName ?? 'contact';

  if (event === 'call_started') {
    return [{ skillId: 'pre-call-brief', reason: `Prepare for call with ${name}` }];
  }

  return [{ skillId: 'post-call-logger', reason: `Log outcomes from call with ${name}` }];
};
