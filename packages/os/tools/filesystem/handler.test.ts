import { describe, expect, it } from 'vitest';

import { toolPackage } from './manifest';

describe("filesystem tool package", () => {
  it('keeps schemas, handlers, and definitions in one-to-one parity', () => {
    const definitions = toolPackage.definitions.map((definition) => definition.name).sort();
    expect(toolPackage.handlers.map((handler) => handler.name).sort()).toEqual(definitions);
    expect(toolPackage.schemas.map((schema) => schema.name).sort()).toEqual(definitions);
  });

  it('keeps read-only filesystem tools task-session optional and mutators task-scoped', () => {
    const fsDefinitions = toolPackage.definitions.filter((definition) => definition.name.startsWith('fs.'));
    const readOnly = fsDefinitions.filter((definition) => {
      const capabilities = definition.capabilities as { readOnly?: boolean };
      return capabilities.readOnly === true;
    });
    const mutating = fsDefinitions.filter((definition) => {
      const capabilities = definition.capabilities as { mutating?: boolean };
      return capabilities.mutating === true;
    });

    expect(readOnly.map((definition) => definition.name).sort()).toEqual(['fs.list', 'fs.read', 'fs.search']);
    expect(mutating.map((definition) => definition.name).sort()).toEqual(['fs.apply_patch', 'fs.trash', 'fs.write']);

    for (const definition of readOnly) {
      expect(definition.sessionRequired).toBe(false);
      expect(definition.command.branchMode).toBe('optional');
    }

    for (const definition of mutating) {
      expect(definition.sessionRequired).toBe(true);
      expect(definition.command.branchMode).toBe('required');
    }
  });
});
