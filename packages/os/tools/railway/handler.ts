import type { ToolHandlerContribution } from '../package';

// Worker 12 owns public tool publication. This package contributes no central handlers yet.
export const toolHandlers = [] as const satisfies readonly ToolHandlerContribution[];
