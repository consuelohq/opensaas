import type { ToolHandlerContribution, ToolSchemaContribution } from '../package';

export const computerUseSchema: ToolSchemaContribution = {
  name: 'computer.use',
  order: ['name', 'methodPath', 'description', 'category', 'underlying', 'capabilities', 'defaultTimeout',
    'inputSchema', 'outputSchema', 'search', 'command', 'exampleInput', 'sessionRequired'],
  definition: {
    name: 'computer.use',
    methodPath: ['computer', 'use'],
    description: 'Operate apps by accessibility ref or browse with target:"browser". Start with status or snapshot. Browser open defaults to headless Dia when installed. Use headed:true for human interaction. Close before changing modes. Use chromium for sign-in across restarts.',
    category: 'computer',
    underlying: 'agent-desktop / agent-browser',
    capabilities: { readOnly: false, mutating: true, deterministic: false, safeToRetry: false },
    defaultTimeout: 45_000,
    inputSchema: 'ComputerUseInput',
    outputSchema: 'RawOutput',
    search: { domainAliases: ['computer use', 'desktop', 'browser', 'Dia'], keywords: ['window', 'snapshot', 'click', 'headless', 'accessibility'] },
    exampleInput: { action: 'status' },
    sessionRequired: false,
  },
};

export const computerUseHandler: ToolHandlerContribution = {
  name: 'computer.use',
  command: { script: 'computer-use', internal: 'computer.use', branchMode: 'none', executionScope: 'runtime', arguments: [] },
};
