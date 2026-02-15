// eslint-disable-next-line @nx/enforce-module-boundaries
import * as Sentry from '@sentry/node';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import type { ApiRequest, ApiResponse } from '../types.js';
import type OpenAI from 'openai';

// -- types --

interface AssistantRequest {
  message: string;
  conversationId?: string;
}

interface ExecutedCommand {
  command: string;
  result: unknown;
  success: boolean;
}

interface AssistantResponse {
  reply: string;
  commandsExecuted: ExecutedCommand[];
  conversationId: string;
}

interface CommandDefinition {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    enum?: string[];
  }>;
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  commandsExecuted?: ExecutedCommand[];
}

// -- constants --

const MAX_TOOL_CALLS = 5;
const LLM_TIMEOUT_MS = 30_000;
const MAX_CONVERSATION_TURNS = 20;

// -- command catalog (static until 11.2 auto-generates) --

// DEV-809: replace with auto-generated catalog from commander.js tree
const COMMAND_CATALOG: CommandDefinition[] = [
  {
    name: 'contacts_list',
    description: 'List contacts with optional filters',
    parameters: {
      tag: { type: 'string', description: 'Filter by tag' },
      limit: { type: 'number', description: 'Max results to return' },
      search: { type: 'string', description: 'Search by name or phone' },
    },
  },
  {
    name: 'contacts_search',
    description: 'Search contacts by name, phone, email, or tag',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
    },
  },
  {
    name: 'history_list',
    description: 'List call history with optional filters',
    parameters: {
      outcome: { type: 'string', description: 'Filter by outcome', enum: ['answered', 'no-answer', 'busy', 'voicemail', 'failed'] },
      from: { type: 'string', description: 'Start date (ISO format)' },
      to: { type: 'string', description: 'End date (ISO format)' },
      limit: { type: 'number', description: 'Max results' },
    },
  },
  {
    name: 'history_stats',
    description: 'Get call statistics for a time period',
    parameters: {
      period: { type: 'string', description: 'Time period', enum: ['day', 'week', 'month'] },
      from: { type: 'string', description: 'Start date (ISO format)' },
    },
  },
  {
    name: 'kb_search',
    description: 'Search the knowledge base for relevant content',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
      collection: { type: 'string', description: 'Collection name to search in' },
    },
  },
  {
    name: 'queue_list',
    description: 'List call queues',
    parameters: {
      status: { type: 'string', description: 'Filter by status', enum: ['active', 'paused', 'completed'] },
    },
  },
  {
    name: 'queue_create',
    description: 'Create a new call queue with contacts',
    parameters: {
      name: { type: 'string', description: 'Queue name', required: true },
      contactIds: { type: 'string', description: 'Comma-separated contact IDs' },
    },
  },
  {
    name: 'files_list',
    description: 'List uploaded files',
    parameters: {
      type: { type: 'string', description: 'Filter by file type' },
    },
  },
];

// -- helpers --

const buildToolDefinitions = (catalog: CommandDefinition[]) =>
  catalog.map((cmd) => ({
    type: 'function' as const,
    function: {
      name: cmd.name,
      description: cmd.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(cmd.parameters).map(([key, param]) => [
            key,
            { type: param.type, description: param.description, ...(param.enum ? { enum: param.enum } : {}) },
          ]),
        ),
        required: Object.entries(cmd.parameters)
          .filter(([, p]) => p.required)
          .map(([k]) => k),
      },
    },
  }));

const buildSystemPrompt = (workspaceId: string): string => {
  const commandList = COMMAND_CATALOG.map((c) => `- ${c.name}: ${c.description}`).join('\n');
  return [
    "you are consuelo's assistant. you help users interact with their sales data through natural language.",
    'you have access to these commands:',
    commandList,
    `the current date is ${new Date().toISOString().split('T')[0]}.`,
    `the user's workspace is ${workspaceId}.`,
    'respond conversationally. when you need data, call the appropriate tool.',
    "summarize results in a helpful way — don't dump raw JSON at the user.",
    'if a multi-step task is needed, execute commands sequentially.',
  ].join('\n');
};

// TODO: DEV-811 — replace with persistent storage
const conversations = new Map<string, ConversationTurn[]>();

const getConversation = (id: string): ConversationTurn[] =>
  conversations.get(id) ?? [];

const addTurn = (id: string, turn: ConversationTurn): void => {
  const turns = getConversation(id);
  turns.push(turn);
  if (turns.length > MAX_CONVERSATION_TURNS) {
    turns.splice(0, turns.length - MAX_CONVERSATION_TURNS);
  }
  conversations.set(id, turns);
};

const withTimeout = <TResult>(promise: Promise<TResult>, ms: number): Promise<TResult> =>
  Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms),
    ),
  ]);

// route-internal API executor — calls the same routes the CLI hits
const executeCommand = async (
  name: string,
  args: Record<string, unknown>,
  authHeader: string,
  baseUrl: string,
): Promise<{ result: unknown; success: boolean }> => {
  try {
    const routeMap: Record<string, { method: string; path: string; queryParams?: string[] }> = {
      contacts_list: { method: 'GET', path: '/v1/contacts', queryParams: ['tag', 'limit', 'search'] },
      contacts_search: { method: 'GET', path: '/v1/contacts/search', queryParams: ['query'] },
      history_list: { method: 'GET', path: '/v1/calls', queryParams: ['outcome', 'from', 'to', 'limit'] },
      history_stats: { method: 'GET', path: '/v1/analytics/stats', queryParams: ['period', 'from'] },
      kb_search: { method: 'GET', path: '/v1/knowledge/search', queryParams: ['query', 'collection'] },
      queue_list: { method: 'GET', path: '/v1/queues', queryParams: ['status'] },
      queue_create: { method: 'POST', path: '/v1/queues' },
      files_list: { method: 'GET', path: '/v1/files', queryParams: ['type'] },
    };

    const route = routeMap[name];
    if (!route) {
      return { result: { error: `unknown command: ${name}` }, success: false };
    }

    let url = `${baseUrl}${route.path}`;
    const fetchOptions: RequestInit = {
      method: route.method,
      headers: { 'authorization': authHeader, 'content-type': 'application/json' },
    };

    if (route.method === 'GET' && route.queryParams) {
      const params = new URLSearchParams();
      for (const key of route.queryParams) {
        if (args[key] !== undefined && args[key] !== null) {
          params.set(key, String(args[key]));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    } else if (route.method === 'POST') {
      fetchOptions.body = JSON.stringify(args);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json() as unknown;
    return { result: data, success: response.ok };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'command execution failed';
    return { result: { error: message }, success: false };
  }
};

// -- route --

/** /v1/assistant routes — natural language assistant with LLM tool calling */
export const assistantRoutes = (): RouteDefinition[] => {
  // LLM client — lazy init, cached (peer dep: openai)
  let llmClient: OpenAI | null = null;

  const getClient = async () => {
    try {
      if (!llmClient) {
        const { default: OpenAIClient } = await import('openai');
        const apiKey = process.env.OPENAI_API_KEY ?? process.env.GROQ_API_KEY;
        const baseURL = process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY
          ? 'https://api.groq.com/openai/v1'
          : undefined;
        llmClient = new OpenAIClient({ apiKey, baseURL });
      }
      return llmClient;
    } catch (err: unknown) {
      llmClient = null;
      throw err;
    }
  };

  const model = process.env.ASSISTANT_MODEL ?? (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

  return [
    {
      method: 'POST',
      path: '/v1/assistant',
      handler: errorHandler(async (req: ApiRequest, res: ApiResponse) => {
        if (!req.auth) {
          res.status(401).json({ error: { code: 'unauthorized', message: 'Authentication required' } });
          return;
        }

        const body = req.body as AssistantRequest | undefined;
        if (!body?.message || typeof body.message !== 'string') {
          res.status(400).json({ error: { code: 'bad_request', message: 'message is required' } });
          return;
        }

        const { randomUUID } = await import('node:crypto');
        const conversationId = body.conversationId ?? randomUUID();
        const authHeader = req.headers['authorization'] ?? '';

        try {
          const client = await getClient();
          const tools = buildToolDefinitions(COMMAND_CATALOG);
          const history = getConversation(conversationId);

          // build messages array
          const messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [
            { role: 'system', content: buildSystemPrompt(req.auth.workspaceId) },
            ...history.map((t) => ({ role: t.role, content: t.content })),
            { role: 'user', content: body.message },
          ];

          const commandsExecuted: ExecutedCommand[] = [];
          let iterations = 0;

          // tool calling loop
          while (iterations < MAX_TOOL_CALLS) {
            const completion = await withTimeout(
              client.chat.completions.create({
                model,
                messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
                tools: tools.length > 0 ? tools as Parameters<typeof client.chat.completions.create>[0]['tools'] : undefined,
              }),
              LLM_TIMEOUT_MS,
            );

            const choice = completion.choices[0];
            if (!choice) break;

            // no tool calls — we have the final response
            if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
              const reply = choice.message.content ?? "i couldn't generate a response. try rephrasing your request.";

              addTurn(conversationId, { role: 'user', content: body.message });
              addTurn(conversationId, { role: 'assistant', content: reply, commandsExecuted });

              const response: AssistantResponse = { reply, commandsExecuted, conversationId };
              res.status(200).json(response);
              return;
            }

            // execute tool calls
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: choice.message.tool_calls,
            });

            for (const toolCall of choice.message.tool_calls) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
              } catch {
                // malformed args — skip
              }

              const cmdString = `consuelo ${toolCall.function.name.replace(/_/g, ' ')} ${Object.entries(args).map(([k, v]) => `--${k} ${String(v)}`).join(' ')}`.trim();
              const { result, success } = await executeCommand(toolCall.function.name, args, authHeader, baseUrl);

              commandsExecuted.push({ command: cmdString, result, success });
              messages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              });
            }

            iterations++;
          }

          // hit max iterations — return what we have
          const reply = "i ran the maximum number of commands for this request. here's what i found so far.";
          addTurn(conversationId, { role: 'user', content: body.message });
          addTurn(conversationId, { role: 'assistant', content: reply, commandsExecuted });

          const response: AssistantResponse = { reply, commandsExecuted, conversationId };
          res.status(200).json(response);
        } catch (err: unknown) {
          Sentry.captureException(err instanceof Error ? err : new Error('assistant error'));
          const message = err instanceof Error && err.message.includes('timed out')
            ? "i'm taking too long to think. try a simpler request."
            : 'something went wrong processing your request. please try again.';
          res.status(500).json({ error: { code: 'assistant_error', message } });
        }
      }),
    },
  ];
};
