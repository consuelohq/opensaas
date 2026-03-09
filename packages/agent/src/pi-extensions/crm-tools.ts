// CRM tools for pi-agent-core — all 12 tools bound to CrmClient
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

const ListDealsParams = Type.Object({
  stage: Type.Optional(Type.String({ description: 'Filter by pipeline stage' })),
  limit: Type.Optional(Type.Number({ description: 'Max results' })),
});

const GetCallHistoryParams = Type.Object({
  contactId: Type.Optional(Type.String({ description: 'Filter by contact ID' })),
  since: Type.Optional(Type.String({ description: 'ISO date to filter from' })),
  limit: Type.Optional(Type.Number({ description: 'Max results' })),
});

const GetAnalyticsParams = Type.Object({
  type: Type.String({ description: 'Metric type: calls, answer_rate, duration' }),
  period: Type.String({ description: 'Time period: today, week, month' }),
  groupBy: Type.Optional(Type.String({ description: 'Group by: day, hour, agent' })),
});

const SearchKbParams = Type.Object({
  query: Type.String({ description: 'Search query' }),
  collection: Type.Optional(Type.String({ description: 'Limit to specific collection' })),
});

const LogCallParams = Type.Object({
  contactId: Type.String({ description: 'Contact ID' }),
  outcome: Type.String({ description: 'Call outcome: answered, voicemail, no_answer, busy' }),
  notes: Type.String({ description: 'Call notes' }),
  nextStep: Type.Optional(Type.String({ description: 'Next action to take' })),
});

const UpdateDealParams = Type.Object({
  id: Type.String({ description: 'Deal ID' }),
  stage: Type.Optional(Type.String({ description: 'Pipeline stage' })),
  amount: Type.Optional(Type.Number({ description: 'Deal amount' })),
  notes: Type.Optional(Type.String({ description: 'Deal notes' })),
});

const CreateNoteParams = Type.Object({
  contactId: Type.String({ description: 'Contact ID' }),
  content: Type.String({ description: 'Note content' }),
});

const AddToQueueParams = Type.Object({
  contactIds: Type.Array(Type.String(), { description: 'Contact IDs to queue' }),
  priority: Type.Optional(Type.Number({ description: 'Queue priority (1=highest)' })),
});

const CreateTaskParams = Type.Object({
  title: Type.String({ description: 'Task title' }),
  dueDate: Type.String({ description: 'ISO date string' }),
  contactId: Type.Optional(Type.String({ description: 'Associated contact ID' })),
});

// static types for execute params
type SearchParams = Static<typeof SearchContactsParams>;
type GetParams = Static<typeof GetContactParams>;
type ListDealsP = Static<typeof ListDealsParams>;
type CallHistoryP = Static<typeof GetCallHistoryParams>;
type AnalyticsP = Static<typeof GetAnalyticsParams>;
type SearchKbP = Static<typeof SearchKbParams>;
type LogCallP = Static<typeof LogCallParams>;
type UpdateDealP = Static<typeof UpdateDealParams>;
type CreateNoteP = Static<typeof CreateNoteParams>;
type AddToQueueP = Static<typeof AddToQueueParams>;
type CreateTaskP = Static<typeof CreateTaskParams>;

const safeExecute = async (fn: () => Promise<unknown>, fallbackMsg: string): Promise<CrmToolResult> => {
  try {
    const result = await fn();

    return textResult(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : fallbackMsg;

    return textResult({ error: message });
  }
};

export const createPiCrmTools = (
  crmClient: CrmClient,
): AgentTool[] => [
  // read tools
  {
    name: 'search_contacts',
    label: 'Search Contacts',
    description: 'Search CRM contacts by name, email, phone, or company',
    parameters: SearchContactsParams,
    async execute(_toolCallId, params) {
      const { query, limit } = params as SearchParams;

      return safeExecute(
        () => crmClient.searchContacts(query, undefined, { limit }),
        'search failed',
      );
    },
  },
  {
    name: 'get_contact',
    label: 'Get Contact',
    description: 'Get a specific contact by ID with full profile and history',
    parameters: GetContactParams,
    async execute(_toolCallId, params) {
      const { contactId } = params as GetParams;

      return safeExecute(
        () => crmClient.getContact(contactId),
        'get contact failed',
      );
    },
  },
  {
    name: 'list_deals',
    label: 'List Deals',
    description: 'List deals with optional filters',
    parameters: ListDealsParams,
    async execute(_toolCallId, params) {
      const { stage, limit } = params as ListDealsP;

      return safeExecute(
        () => crmClient.listDeals(
          stage ? { stage } : undefined,
          { limit },
        ),
        'list deals failed',
      );
    },
  },
  {
    name: 'get_call_history',
    label: 'Get Call History',
    description: 'Get call history, optionally filtered by contact',
    parameters: GetCallHistoryParams,
    async execute(_toolCallId, params) {
      const { contactId, since, limit } = params as CallHistoryP;

      return safeExecute(
        () => crmClient.getCallHistory(contactId, since, { limit }),
        'get call history failed',
      );
    },
  },
  {
    name: 'get_analytics',
    label: 'Get Analytics',
    description: 'Get analytics data (call volume, answer rates, etc.)',
    parameters: GetAnalyticsParams,
    async execute(_toolCallId, params) {
      const { type, period, groupBy } = params as AnalyticsP;

      return safeExecute(
        () => crmClient.getAnalytics(type, period, groupBy),
        'get analytics failed',
      );
    },
  },
  {
    name: 'search_kb',
    label: 'Search Knowledge Base',
    description: 'Search the knowledge base for relevant documents',
    parameters: SearchKbParams,
    async execute(_toolCallId, params) {
      const { query, collection } = params as SearchKbP;

      return safeExecute(
        () => crmClient.searchKnowledgeBase(query, collection),
        'search kb failed',
      );
    },
  },
  {
    name: 'list_integrations',
    label: 'List Integrations',
    description: 'List connected integrations and their capabilities',
    parameters: Type.Object({}),
    async execute() {
      return safeExecute(
        () => crmClient.listIntegrations(),
        'list integrations failed',
      );
    },
  },
  // write tools
  {
    name: 'log_call',
    label: 'Log Call',
    description: 'Log a call outcome for a contact',
    parameters: LogCallParams,
    async execute(_toolCallId, params) {
      const { contactId, outcome, notes, nextStep } = params as LogCallP;

      return safeExecute(
        () => crmClient.logCall(contactId, outcome, notes, nextStep),
        'log call failed',
      );
    },
  },
  {
    name: 'update_deal',
    label: 'Update Deal',
    description: 'Update a deal stage, amount, or notes',
    parameters: UpdateDealParams,
    async execute(_toolCallId, params) {
      const { id, ...updates } = params as UpdateDealP;

      return safeExecute(
        () => crmClient.updateDeal(id, updates),
        'update deal failed',
      );
    },
  },
  {
    name: 'create_note',
    label: 'Create Note',
    description: 'Create a note on a contact record',
    parameters: CreateNoteParams,
    async execute(_toolCallId, params) {
      const { contactId, content } = params as CreateNoteP;

      return safeExecute(
        () => crmClient.createNote(contactId, content),
        'create note failed',
      );
    },
  },
  {
    name: 'add_to_queue',
    label: 'Add to Queue',
    description: 'Add contacts to the dialing queue',
    parameters: AddToQueueParams,
    async execute(_toolCallId, params) {
      const { contactIds, priority } = params as AddToQueueP;

      return safeExecute(
        () => crmClient.addToQueue(contactIds, priority),
        'add to queue failed',
      );
    },
  },
  {
    name: 'create_task',
    label: 'Create Task',
    description: 'Create a follow-up task',
    parameters: CreateTaskParams,
    async execute(_toolCallId, params) {
      const { title, dueDate, contactId } = params as CreateTaskP;

      return safeExecute(
        () => crmClient.createTask(title, dueDate, contactId),
        'create task failed',
      );
    },
  },
];
