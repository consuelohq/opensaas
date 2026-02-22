import type { AgentConfig, AgentContext, AgentMessage } from './types.js';
import type { ToolRegistry } from './tools/types.js';

export type AgentOptions = {
  config: AgentConfig;
  context: AgentContext;
  tools?: ToolRegistry;
};

// agent service — streamText integration added in DEV-942
export class AgentService {
  private config: AgentConfig;
  private context: AgentContext;
  private tools?: ToolRegistry;

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.context = options.context;
    this.tools = options.tools;
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  getContext(): AgentContext {
    return this.context;
  }

  getTools(): ToolRegistry | undefined {
    return this.tools;
  }
}
