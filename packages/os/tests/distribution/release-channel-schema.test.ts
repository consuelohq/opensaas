import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CHANNEL_MANIFEST_SCHEMA_VERSION,
  RELEASE_CHANNELS,
} from '../../scripts/lib/distribution/release-channels';

type JsonSchema = {
  $defs: {
    payload: {
      additionalProperties: boolean;
      properties: {
        channel: { enum: string[] };
        schemaVersion: { const: number };
      };
      required: string[];
    };
    signature: {
      additionalProperties: boolean;
      properties: {
        algorithm: { const: string };
      };
      required: string[];
    };
  };
  $id: string;
  additionalProperties: boolean;
  required: string[];
};

describe('release channel manifest schema', () => {
  it('publishes the signed pointer format as a strict versioned JSON schema', () => {
    const schemaPath = resolve(
      import.meta.dirname,
      '../../scripts/lib/distribution/release-channel.schema.json',
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as JsonSchema;

    expect(schema.$id).toBe(
      'https://consuelohq.com/schemas/consuelo-os-release-channel-v1.json',
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['payload', 'signature']);
    expect(schema.$defs.payload.additionalProperties).toBe(false);
    expect(schema.$defs.payload.properties.channel.enum).toEqual([...RELEASE_CHANNELS]);
    expect(schema.$defs.payload.properties.schemaVersion.const).toBe(
      CHANNEL_MANIFEST_SCHEMA_VERSION,
    );
    expect(schema.$defs.payload.required).toEqual(expect.arrayContaining([
      'bundleId',
      'channel',
      'evidence',
      'platforms',
      'releaseFingerprint',
      'revision',
      'schemaVersion',
      'sourceCommit',
      'version',
    ]));
    expect(schema.$defs.signature.additionalProperties).toBe(false);
    expect(schema.$defs.signature.properties.algorithm.const).toBe('ed25519');
    expect(schema.$defs.signature.required).toEqual([
      'algorithm',
      'keyId',
      'signature',
      'signedAt',
    ]);
  });
});
