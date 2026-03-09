/**
 * Pi Agent Runtime Types
 *
 * TODO: Replace placeholder types with actual Pi SDK types when published.
 * The Pi SDK will provide the runtime for agentic code execution with
 * sandbox isolation, streaming, and tool integration.
 */

export type PiAgentConfig = {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  sandboxTimeout?: number;
};

export type PiAgentOptions = {
  prompt: string;
  context?: PiExecutionContext;
  tools?: PiToolDefinition[];
  maxSteps?: number;
};

export type PiExecutionContext = {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  callSid?: string;
};

export type PiToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (...args: unknown[]) => Promise<unknown>;
};

export type PiStreamEvent = 
  | { type: 'text'; content: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; output: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type PiExecutionResult = {
  success: boolean;
  output?: string;
  error?: string;
  toolCalls?: Array<{
    name: string;
    input: unknown;
    output: unknown;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type PiModuleOptions = {
  isGlobal?: boolean;
};
