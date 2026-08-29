import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    name: 'security.scan',
    order: [
      'name', 'methodPath', 'description', 'category', 'underlying', 'capabilities',
      'defaultTimeout', 'inputSchema', 'outputSchema', 'command', 'exampleInput', 'sessionRequired',
    ],
    definition: {
      name: 'security.scan',
      methodPath: ['security', 'scan'],
      description: 'run a defensive repository security scan with Bun audit, OSV-Scanner, Trivy, and Semgrep and return normalized findings plus local evidence paths',
      category: 'security',
      underlying: 'Consuelo defensive repository security scanners',
      capabilities: { readOnly: true, mutating: false, deterministic: false, safeToRetry: true },
      defaultTimeout: 900000,
      inputSchema: 'EmptyInput',
      outputSchema: 'RawOutput',
      exampleInput: {},
      sessionRequired: false,
    },
  },
] as const satisfies readonly ToolSchemaContribution[];
