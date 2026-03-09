// knowledge base tools for pi-agent-core
// uses TypeBox (pi's schema format)

import { Type, type Static } from '@sinclair/typebox';

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';

// minimal interface — consumers provide their own KB service
export type KbService = {
  search(query: string, collection?: string, limit?: number): Promise<unknown>;
  listCollections(): Promise<unknown>;
};

type KbToolResult = AgentToolResult<Record<string, unknown>>;

const textResult = (data: unknown): KbToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  details: {},
});

const safeExecute = async (fn: () => Promise<unknown>, fallbackMsg: string): Promise<KbToolResult> => {
  try {
    const result = await fn();

    return textResult(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : fallbackMsg;

    return textResult({ error: message });
  }
};

// parameter schemas

const SearchKbParams = Type.Object({
  query: Type.String({ description: 'Search query' }),
  collectionId: Type.Optional(Type.String({ description: 'Limit to a specific collection' })),
  limit: Type.Optional(Type.Number({ description: 'Max results to return' })),
});

const ListCollectionsParams = Type.Object({});

type SearchP = Static<typeof SearchKbParams>;

export const createKbTools = (
  kb: KbService,
): AgentTool[] => [
  {
    name: 'kb_search',
    label: 'Search Knowledge Base',
    description: 'Search the knowledge base for relevant documents and information',
    parameters: SearchKbParams,
    async execute(_toolCallId, params) {
      const { query, collectionId, limit } = params as SearchP;

      return safeExecute(
        () => kb.search(query, collectionId, limit),
        'kb search failed',
      );
    },
  },
  {
    name: 'list_kb_collections',
    label: 'List KB Collections',
    description: 'List available knowledge base collections the agent can search',
    parameters: ListCollectionsParams,
    async execute() {
      return safeExecute(
        () => kb.listCollections(),
        'list collections failed',
      );
    },
  },
];
