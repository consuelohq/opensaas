import { describe, expect, it } from 'vitest';

import { toolPackage } from './manifest';

describe("artifacts tool package", () => {
  it('keeps schemas, handlers, and definitions in one-to-one parity', () => {
    const definitions = toolPackage.definitions.map((definition) => definition.name).sort();
    expect(toolPackage.handlers.map((handler) => handler.name).sort()).toEqual(definitions);
    expect(toolPackage.schemas.map((schema) => schema.name).sort()).toEqual(definitions);
  });

  it('exposes one canonical operation-based artifacts tool with schedule publication', () => {
    const definition = toolPackage.definitions.find((item) => item.name === 'artifacts');
    const handler = toolPackage.handlers.find((item) => item.name === 'artifacts');
    expect(definition).toMatchObject({
      name: 'artifacts',
      inputSchema: 'ArtifactsOperationInput',
    });
    expect(handler?.command.arguments).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'operation', required: true }),
      expect.objectContaining({ source: 'schedule', flag: '--schedule' }),
      expect.objectContaining({ source: 'reportFile', flag: '--report-file' }),
      expect.objectContaining({ source: 'workpadFile', flag: '--workpad-file' }),
      expect.objectContaining({ source: 'taskSession', flag: '--task-session' }),
    ]));
  });
});
