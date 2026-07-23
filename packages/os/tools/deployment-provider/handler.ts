import type { ToolHandlerContribution } from '../package';

// Worker 12 owns public facade registration after all provider adapters land.
export const toolHandlers = [] as const satisfies readonly ToolHandlerContribution[];
