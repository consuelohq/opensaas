import type { ToolSchemaContribution } from '../package';

// Worker 12 owns public tool publication. This package contributes no central schemas yet.
export const toolSchemas = [] as const satisfies readonly ToolSchemaContribution[];
