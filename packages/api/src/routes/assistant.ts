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

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  commandsExecuted?: ExecutedCommand[];
}

interface CatalogTool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

// -- constants --

const MAX_TOOL_CALLS = 5;
const LLM_TIMEOUT_MS = 30_000;
const MAX_CONVERSATION_TURNS = 20;

// -- dynamic catalog loading --

// fallback tools when CLI catalog is unavailable
const FALLBACK_TOOLS: CatalogTool[] = [
  { type: 'function', function: { name: 'contacts_list', description: 'List contacts with optional filters', parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max results' }, filter: { type: 'string', description: 'Filter expression' } }, required: [] } } },
  { type: 'function', function: { name: 'contacts_search', description: 'Search contacts by name, phone, email, or tag', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'history_list', description: 'List call history', parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max results' }, status: { type: 'string', description: 'Filter by status' } }, required: [] } } },
  { type: 'function', function: { name: 'history_stats', description: 'Get call statistics', parameters: { type: 'object', properties: { period: { type: 'string', description: 'Time period (day|week|month)' } }, required: [] } } },
  { type: 'function', function: { name: 'kb_search', description: 'Search the knowledge base', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, collection: { type: 'string', description: 'Collection name' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'queue_list', description: 'List call queues', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by status' } }, required: [] } } },
  { type: 'function', function: { name: 'queue_create', description: 'Create a new call queue', parameters: { type: 'object', properties: { name: { type: 'string', description: 'Queue name' }, contacts: { type: 'string', description: 'Comma-separated contact IDs' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'files_list', description: 'List uploaded files', parameters: { type: 'object', properties: { type: { type: 'string', description: 'Filter by file type' } }, required: [] } } },
];

let cachedTools: CatalogTool[] | null = null;

const loadTools = async (): Promise<CatalogTool[]> => {
  if (cachedTools) return cachedTools;
  try {
    const { execSync } = await import('node:child_process');
    const output = execSync('consuelo catalog --json', {
      timeout: 10_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(output.trim()) as { tools?: CatalogTool[] };
    if (parsed.tools?.length) {
      cachedTools = parsed.tools;
      return cachedTools;
    }
  } catch {
    // CLI not available — use fallback
  }
  cachedTools = FALLBACK_TOOLS;
  return cachedTools;
};

// -- helpers --

const buildSystemPrompt = (workspaceId: string, tools: CatalogTool[]): string => {
  const commandList = tools.map((t) => `- ${t.function.name}: ${t.function.description}`).join('\n');
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

// -- command execution --

interface RouteMapping {
  method: string;
  path: string;
  pathParam?: string;
  queryParams?: string[];
}

const ROUTE_MAP: Record<string, RouteMapping> = {
  // contacts
  contacts_list: { method: 'GET', path: '/v1/contacts', queryParams: ['limit', 'filter'] },
  contacts_get: { method: 'GET', path: '/v1/contacts', pathParam: 'id' },
  contacts_create: { method: 'POST', path: '/v1/contacts' },
  contacts_update: { method: 'PUT', path: '/v1/contacts', pathParam: 'id' },
  contacts_delete: { method: 'DELETE', path: '/v1/contacts', pathParam: 'id' },
  contacts_search: { method: 'GET', path: '/v1/contacts/search', queryParams: ['query'] },
  contacts_import: { method: 'POST', path: '/v1/contacts/import' },
  // calls
  calls_list: { method: 'GET', path: '/v1/calls', queryParams: ['limit', 'status'] },
  calls_get: { method: 'GET', path: '/v1/calls', pathParam: 'id' },
  calls_start: { method: 'POST', path: '/v1/calls' },
  calls_end: { method: 'DELETE', path: '/v1/calls', pathParam: 'id' },
  calls_transfer: { method: 'POST', path: '/v1/calls', pathParam: 'id', queryParams: [] },
  // queue
  queue_list: { method: 'GET', path: '/v1/queues', queryParams: ['status'] },
  queue_status: { method: 'GET', path: '/v1/queues', pathParam: 'id' },
  queue_create: { method: 'POST', path: '/v1/queues' },
  queue_start: { method: 'POST', path: '/v1/queues', pathParam: 'id' },
  queue_pause: { method: 'POST', path: '/v1/queues', pathParam: 'id' },
  queue_resume: { method: 'POST', path: '/v1/queues', pathParam: 'id' },
  queue_stop: { method: 'POST', path: '/v1/queues', pathParam: 'id' },
  queue_delete: { method: 'DELETE', path: '/v1/queues', pathParam: 'id' },
  // knowledge base
  kb_search: { method: 'POST', path: '/v1/knowledge/search' },
  kb_collections_list: { method: 'GET', path: '/v1/knowledge/collections' },
  kb_collections_create: { method: 'POST', path: '/v1/knowledge/collections' },
  kb_collections_delete: { method: 'DELETE', path: '/v1/knowledge/collections', pathParam: 'id' },
  kb_index: { method: 'POST', path: '/v1/knowledge/index' },
  kb_deindex: { method: 'DELETE', path: '/v1/knowledge/deindex', pathParam: 'fileId' },
  kb_stats: { method: 'GET', path: '/v1/knowledge/stats' },
  // files
  files_list: { method: 'GET', path: '/v1/files', queryParams: ['type'] },
  files_get: { method: 'GET', path: '/v1/files', pathParam: 'id' },
  files_delete: { method: 'DELETE', path: '/v1/files', pathParam: 'id' },
  files_search: { method: 'GET', path: '/v1/files/search', queryParams: ['query'] },
  // history
  history_list: { method: 'GET', path: '/v1/history', queryParams: ['limit', 'status', 'from', 'to'] },
  history_get: { method: 'GET', path: '/v1/history', pathParam: 'id' },
  history_stats: { method: 'GET', path: '/v1/history/stats', queryParams: ['period', 'from'] },
  history_export: { method: 'POST', path: '/v1/history/export' },
  history_delete: { method: 'DELETE', path: '/v1/history', pathParam: 'id' },
};

const executeCommand = async (
  name: string,
  args: Record<string, unknown>,
  authHeader: string,
  baseUrl: string,
): Promise<{ result: unknown; success: boolean }> => {
  try {
    const route = ROUTE_MAP[name];
    if (!route) {
      return { result: { error: `unknown command: ${name}` }, success: false };
    }

    let url = `${baseUrl}${route.path}`;

    // append path parameter (e.g. /v1/contacts/:id)
    if (route.pathParam && args[route.pathParam]) {
      url += `/${String(args[route.pathParam])}`;
      // append action suffix for commands like queue_start, calls_transfer
      const parts = name.split('_');
      const action = parts[parts.length - 1];
      if (['start', 'pause', 'resume', 'stop', 'transfer'].includes(action)) {
        url += `/${action}`;
      }
    }

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
    } else if (['POST', 'PUT'].includes(route.method)) {
      // exclude path param from body
      const body = { ...args };
      if (route.pathParam) delete body[route.pathParam];
      fetchOptions.body = JSON.stringify(body);
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
          const tools = await loadTools();
          const history = getConversation(conversationId);

          const messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [
            { role: 'system', content: buildSystemPrompt(req.auth.workspaceId, tools) },
            ...history.map((t) => ({ role: t.role, content: t.content })),
            { role: 'user', content: body.message },
          ];

          const commandsExecuted: ExecutedCommand[] = [];
          let iterations = 0;

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

            if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
              const reply = choice.message.content ?? "i couldn't generate a response. try rephrasing your request.";

              addTurn(conversationId, { role: 'user', content: body.message });
              addTurn(conversationId, { role: 'assistant', content: reply, commandsExecuted });

              const response: AssistantResponse = { reply, commandsExecuted, conversationId };
              res.status(200).json(response);
              return;
            }

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
