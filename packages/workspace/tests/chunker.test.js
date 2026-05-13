import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { chunkFile } = require('../scripts/lib/index/chunker.js');

function pick(chunks, symbolPath) {
  return chunks.find((chunk) => chunk.symbolPath === symbolPath);
}

describe('tree-sitter chunker metadata', () => {
  test('names arrow functions, object handlers, class members, and tests as targets', () => {
    const source = [
      'const buildTarget = (result) => { return result; };',
      'const handlers = {',
      '  read: async () => {},',
      '  patch(input) {},',
      '  nested: {',
      '    run: () => {},',
      '  },',
      '};',
      'class Store {',
      '  searchChunks() {}',
      '  client = () => {};',
      '}',
      "test('preserves short tokens', () => {});",
      '',
    ].join('\n');

    const chunks = chunkFile('sample.ts', source);

    expect(pick(chunks, 'buildTarget')).toMatchObject({
      name: 'buildTarget',
      nodeType: 'arrow_function',
      parentName: null,
      type: 'function',
    });
    expect(pick(chunks, 'handlers.read')).toMatchObject({
      name: 'read',
      nodeType: 'arrow_function',
      parentName: 'handlers',
      type: 'method',
    });
    expect(pick(chunks, 'handlers.patch')).toMatchObject({
      name: 'patch',
      nodeType: 'method_definition',
      parentName: 'handlers',
      type: 'method',
    });
    expect(pick(chunks, 'handlers.nested.run')).toMatchObject({
      name: 'run',
      nodeType: 'arrow_function',
      parentName: 'handlers.nested',
      type: 'method',
    });
    expect(pick(chunks, 'Store.searchChunks')).toMatchObject({
      name: 'searchChunks',
      nodeType: 'method_definition',
      parentName: 'Store',
      type: 'method',
    });
    expect(pick(chunks, 'Store.client')).toMatchObject({
      name: 'client',
      nodeType: 'public_field_definition',
      parentName: 'Store',
      type: 'method',
    });
    expect(pick(chunks, 'test: preserves short tokens')).toMatchObject({
      name: 'test: preserves short tokens',
      nodeType: 'call_expression',
      parentName: null,
      type: 'test',
    });
  });
});
