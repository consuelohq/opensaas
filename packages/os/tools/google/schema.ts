import type { ToolSchemaContribution } from '../package';

const order = [
  'name',
  'methodPath',
  'description',
  'category',
  'underlying',
  'capabilities',
  'defaultTimeout',
  'inputSchema',
  'outputSchema',
  'search',
  'command',
  'exampleInput',
  'sessionRequired',
] as const;

export const toolSchemas = [
  {
    name: 'google',
    order,
    definition: {
      name: 'google',
      methodPath: ['google'],
      description: 'use Gmail, Calendar, Drive, Docs, Sheets, and Contacts through the managed Google Workspace runtime; first use can open Google OAuth and saved authorization is reused',
      category: 'google',
      underlying: 'workspace google',
      capabilities: {
        readOnly: false,
        mutating: true,
        deterministic: false,
        safeToRetry: false,
      },
      defaultTimeout: 120_000,
      inputSchema: 'GoogleInput',
      outputSchema: 'RawOutput',
      search: {
        domainAliases: ['google', 'gmail', 'calendar', 'drive', 'docs', 'sheets', 'contacts'],
        keywords: ['email', 'mail', 'event', 'document', 'spreadsheet', 'contact', 'workspace'],
      },
      exampleInput: { action: 'run', args: ['gmail', 'search', 'newer_than:7d'], mode: 'read' },
      sessionRequired: false,
    },
  },
] as const satisfies readonly ToolSchemaContribution[];
