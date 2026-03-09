// CRM tools for pi-agent-core — 3 tools bound to CrmClient
// uses TypeBox (pi's schema format) instead of Zod

import { Type, type Static } from '@sinclair/typebox';

import type { CrmClient } from '../crm/client.js';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';

type CrmToolResult = AgentToolResult<Record<string, unknown>>;

const textResult = (data: unknown): CrmToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  details: {},
});

// parameter schemas
const SearchContactsParams = Type.Object({
  query: Type.String({ description: 'Search query' }),
  limit: Type.Optional(Type.Number({ description: 'Max results (default 50)' })),
});

const GetContactParams = Type.Object({
  contactId: Type.String({ description: 'Contact ID' }),
});

const LogCallParams = Type.Object({
  contactId: Type.String({ description: 'Contact ID' }),
  outcome: Type.String({ description: 'Call outcome: answered, voicemail, no_answer' }),
  notes: Type.String({ description: 'Call notes' }),
  nextStep: Type.Optional(Type.String({ description: 'Next action' })),
});

type SearchParams = Static<typeof SearchContactsParams>;
type GetParams = Static<typeof GetContactParams>;
type LogParams = Static<typeof LogCallParams>;

export const createPiCrmTools = (
  crmClient: CrmClient,
): AgentTool[] => [
  {
    name: 'search_contacts',
    label: 'Search Contacts',
    description: 'Search CRM contacts by name, email, phone, or company',
    parameters: SearchContactsParams,
    async execute(_toolCallId, params) {
      const { query, limit } = params as SearchParams;

      try {
        const results = await crmClient.searchContacts(query, undefined, { limit });

        return textResult(results);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'search failed';

        return textResult({ error: message });
      }
    },
  },
  {
    name: 'get_contact',
    label: 'Get Contact',
    description: 'Get a specific contact by ID with full profile and history',
    parameters: GetContactParams,
    async execute(_toolCallId, params) {
      const { contactId } = params as GetParams;

      try {
        const contact = await crmClient.getContact(contactId);

        return textResult(contact);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'get contact failed';

        return textResult({ error: message });
      }
    },
  },
  {
    name: 'log_call',
    label: 'Log Call',
    description: 'Log a call outcome for a contact',
    parameters: LogCallParams,
    async execute(_toolCallId, params) {
      const { contactId, outcome, notes, nextStep } = params as LogParams;

      try {
        const result = await crmClient.logCall(contactId, outcome, notes, nextStep);

        return textResult(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'log call failed';

        return textResult({ error: message });
      }
    },
  },
];
