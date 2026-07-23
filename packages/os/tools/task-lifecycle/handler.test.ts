import { describe, expect, it } from 'vitest';

import { toolPackage } from './manifest';

describe("task-lifecycle tool package", () => {
  it('keeps schemas, handlers, and definitions in one-to-one parity', () => {
    const definitions = toolPackage.definitions.map((definition) => definition.name).sort();
    expect(toolPackage.handlers.map((handler) => handler.name).sort()).toEqual(definitions);
    expect(toolPackage.schemas.map((schema) => schema.name).sort()).toEqual(definitions);
  });
});
