import type { ToolSchemaContribution } from '../package';

const order = ['name', 'methodPath', 'description', 'category', 'underlying', 'capabilities',
  'defaultTimeout', 'inputSchema', 'outputSchema', 'search', 'command', 'exampleInput', 'sessionRequired'] as const;

const base = {
  category: 'posthog',
  underlying: 'Consuelo PostHog API client',
  defaultTimeout: 30000,
  outputSchema: 'RawOutput',
  sessionRequired: false,
  search: {
    domainAliases: ['posthog', 'product analytics', 'event analytics', 'hogql'],
    keywords: ['events', 'analytics', 'funnels', 'capture', 'telemetry', 'product analytics'],
  },
};

export const toolSchemas = [
  {
    name: 'posthog.config',
    order,
    definition: {
      ...base,
      name: 'posthog.config',
      methodPath: ['posthog', 'config'],
      description: 'check PostHog region and credential configuration (never returns keys); credentials are per-node environment variables or macOS Keychain',
      capabilities: { readOnly: true, mutating: false, deterministic: false, safeToRetry: true },
      inputSchema: 'PosthogConfigInput',
      exampleInput: {},
    },
  },
  {
    name: 'posthog.projects',
    order,
    definition: {
      ...base,
      name: 'posthog.projects',
      methodPath: ['posthog', 'projects'],
      description: 'list accessible PostHog projects using the locally configured personal API key',
      capabilities: { readOnly: true, mutating: false, deterministic: false, safeToRetry: true },
      inputSchema: 'PosthogProjectsInput',
      exampleInput: { limit: 20 },
    },
  },
  {
    name: 'posthog.query',
    order,
    definition: {
      ...base,
      name: 'posthog.query',
      methodPath: ['posthog', 'query'],
      description: 'run one bounded read-only HogQL query using a personal API key and PostHog project id',
      capabilities: { readOnly: true, mutating: false, deterministic: false, safeToRetry: true },
      inputSchema: 'PosthogQueryInput',
      exampleInput: { sql: 'SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 20', limit: 20 },
    },
  },
  {
    name: 'posthog.capture',
    order,
    definition: {
      ...base,
      name: 'posthog.capture',
      methodPath: ['posthog', 'capture'],
      description: 'explicitly capture a privacy-checked event to PostHog using the project token; does not capture events automatically',
      capabilities: { readOnly: false, mutating: true, deterministic: false, safeToRetry: false },
      inputSchema: 'PosthogCaptureInput',
      exampleInput: { event: 'website_cta_clicked', distinctId: 'anon_123', propertiesJson: '{"placement":"hero"}' },
    },
  },
] as const satisfies readonly ToolSchemaContribution[];
