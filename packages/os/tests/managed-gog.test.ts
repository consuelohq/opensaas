import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ensureManagedGog,
  GOG_VERSION,
  managedGogAsset,
  managedGogPath,
} from '../scripts/lib/managed-gog';

describe('managed gog runtime', () => {
  it('pins the verified current release and resolves the Consuelo-owned binary path', () => {
    expect(GOG_VERSION).toBe('0.38.1');
    expect(managedGogPath('/tmp/consuelo-google')).toBe('/tmp/consuelo-google/bin/gog');
  });

  it('selects checksum-pinned release artifacts by platform and architecture', () => {
    expect(managedGogAsset('darwin', 'arm64')).toEqual({
      version: '0.38.1',
      fileName: 'gogcli_0.38.1_darwin_arm64.tar.gz',
      sha256: 'bad68687094d2ba034d3b2c369ef2e608ce233f5b6d3752cb05508b0c49bd502',
    });
    expect(managedGogAsset('linux', 'x64')).toEqual({
      version: '0.38.1',
      fileName: 'gogcli_0.38.1_linux_amd64.tar.gz',
      sha256: '6576828ed6852949ba424b967c3ff4268b3d9c90e201f90fe3d539fe3a151ebb',
    });
  });

  it('fails closed for unsupported release targets', () => {
    expect(() => managedGogAsset('aix', 'ppc64')).toThrow(/unsupported/i);
  });

  it('rejects a tampered release before extraction or install', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-gog-checksum-'));
    try {
      await expect(ensureManagedGog({
        home,
        platform: 'darwin',
        arch: 'arm64',
        fetchImpl: async () => new Response('tampered-archive', { status: 200 }),
      })).rejects.toThrow(/checksum/i);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
