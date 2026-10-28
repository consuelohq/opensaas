import { describe, expect, it } from 'vitest';

import { toolPackage } from './manifest';

describe('PostHog tool package', () => {
  it('offers read-only config/projects/query and explicit mutating capture with one-to-one schema/handler parity', () => {
    const expected = ['posthog.capture', 'posthog.config', 'posthog.projects', 'posthog.query'];
    expect(toolPackage.definitions.map((tool) => tool.name).sort()).toEqual(expected);
    expect(toolPackage.schemas.map((tool) => tool.name).sort()).toEqual(expected);
    expect(toolPackage.handlers.map((tool) => tool.name).sort()).toEqual(expected);
    const capture = toolPackage.definitions.find((tool) => tool.name === 'posthog.capture');
    const query = toolPackage.definitions.find((tool) => tool.name === 'posthog.query');
    expect(capture?.capabilities).toMatchObject({ mutating: true, readOnly: false, safeToRetry: false });
    expect(query?.capabilities).toMatchObject({ mutating: false, readOnly: true });
    expect(capture?.command).toMatchObject({ script: 'posthog', subcommand: 'capture' });
    expect(query?.command).toMatchObject({ script: 'posthog', subcommand: 'query' });
  });
});
