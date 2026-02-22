import type { CrmClient } from './client.js';
import type { AgentToolDefinition } from '../tools/types.js';

// creates all CRM tool definitions bound to a client instance
export const createCrmTools = async (client: CrmClient): Promise<AgentToolDefinition[]> => {
  try {
    const { z } = await import('zod');

    return [
    // read tools
    {
      name: 'search_contacts',
      description: 'search CRM contacts by name, email, phone, or company',
      parameters: z.object({
        query: z.string().describe('search query'),
        limit: z.number().optional().describe('max results (default 50)'),
      }),
      execute: async (args: { query: string; limit?: number }) =>
        client.searchContacts(args.query, undefined, { limit: args.limit }),
    },
    {
      name: 'get_contact',
      description: 'get full contact profile and history by ID',
      parameters: z.object({
        id: z.string().describe('contact ID'),
      }),
      execute: async (args: { id: string }) => client.getContact(args.id),
    },
    {
      name: 'list_deals',
      description: 'list deals with optional filters',
      parameters: z.object({
        stage: z.string().optional().describe('filter by pipeline stage'),
        limit: z.number().optional().describe('max results'),
      }),
      execute: async (args: { stage?: string; limit?: number }) =>
        client.listDeals(
          args.stage ? { stage: args.stage } : undefined,
          { limit: args.limit },
        ),
    },
    {
      name: 'get_call_history',
      description: 'get call history, optionally filtered by contact',
      parameters: z.object({
        contactId: z.string().optional().describe('filter by contact ID'),
        since: z.string().optional().describe('ISO date to filter from'),
        limit: z.number().optional(),
      }),
      execute: async (args: {
        contactId?: string;
        since?: string;
        limit?: number;
      }) => client.getCallHistory(args.contactId, args.since, { limit: args.limit }),
    },
    {
      name: 'get_analytics',
      description: 'get analytics data (call volume, answer rates, etc.)',
      parameters: z.object({
        type: z.string().describe('metric type: calls, answer_rate, duration'),
        period: z.string().describe('time period: today, week, month'),
        groupBy: z.string().optional().describe('group by: day, hour, agent'),
      }),
      execute: async (args: { type: string; period: string; groupBy?: string }) =>
        client.getAnalytics(args.type, args.period, args.groupBy),
    },
    {
      name: 'search_kb',
      description: 'search the knowledge base for relevant documents',
      parameters: z.object({
        query: z.string().describe('search query'),
        collection: z.string().optional().describe('limit to specific collection'),
      }),
      execute: async (args: { query: string; collection?: string }) =>
        client.searchKnowledgeBase(args.query, args.collection),
    },
    {
      name: 'list_integrations',
      description: 'list connected integrations and their capabilities',
      parameters: z.object({}),
      execute: async () => client.listIntegrations(),
    },
    // write tools
    {
      name: 'log_call',
      description: 'log a call outcome for a contact',
      parameters: z.object({
        contactId: z.string(),
        outcome: z.string().describe('call outcome: answered, voicemail, no_answer, busy'),
        notes: z.string().describe('call notes'),
        nextStep: z.string().optional().describe('next action to take'),
      }),
      execute: async (args: {
        contactId: string;
        outcome: string;
        notes: string;
        nextStep?: string;
      }) => client.logCall(args.contactId, args.outcome, args.notes, args.nextStep),
    },
    {
      name: 'update_deal',
      description: 'update a deal stage, amount, or notes',
      parameters: z.object({
        id: z.string().describe('deal ID'),
        stage: z.string().optional(),
        amount: z.number().optional(),
        notes: z.string().optional(),
      }),
      execute: async (args: {
        id: string;
        stage?: string;
        amount?: number;
        notes?: string;
      }) => {
        const { id, ...updates } = args;
        return client.updateDeal(id, updates);
      },
    },
    {
      name: 'create_note',
      description: 'create a note on a contact record',
      parameters: z.object({
        contactId: z.string(),
        content: z.string().describe('note content'),
      }),
      execute: async (args: { contactId: string; content: string }) =>
        client.createNote(args.contactId, args.content),
    },
    {
      name: 'add_to_queue',
      description: 'add contacts to the dialing queue',
      parameters: z.object({
        contactIds: z.array(z.string()).describe('contact IDs to queue'),
        priority: z.number().optional().describe('queue priority (1=highest)'),
      }),
      execute: async (args: { contactIds: string[]; priority?: number }) =>
        client.addToQueue(args.contactIds, args.priority),
    },
    {
      name: 'create_task',
      description: 'create a follow-up task',
      parameters: z.object({
        title: z.string(),
        dueDate: z.string().describe('ISO date string'),
        contactId: z.string().optional(),
      }),
      execute: async (args: {
        title: string;
        dueDate: string;
        contactId?: string;
      }) => client.createTask(args.title, args.dueDate, args.contactId),
    },
    ];
  } catch (err: unknown) {
    // Sentry.captureException — handled by consuming app
    const message = err instanceof Error ? err.message : 'failed to create CRM tools';
    throw new Error(`CRM tools init failed: ${message}`, { cause: err });
  }
};


