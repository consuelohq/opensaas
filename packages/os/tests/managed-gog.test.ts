import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ensureManagedGogLicense,
  ensureManagedGog,
  GOG_LICENSE_NOTICE,
  GOG_VERSION,
  managedGogAsset,
  managedGogExtractionCommand,
  managedGogLicensePath,
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
    expect(managedGogAsset('win32', 'x64')).toEqual({
      version: '0.38.1',
      fileName: 'gogcli_0.38.1_windows_amd64.zip',
      sha256: '5523764e142d36a460b8c51779fe79b1e34ffcdcb960addd7901542d206e927d',
    });
    expect(managedGogPath('/tmp/consuelo-google', 'win32')).toBe('/tmp/consuelo-google/bin/gog.exe');
    expect(managedGogExtractionCommand('release.zip', '/extract')).toEqual([
      'tar', '-xf', 'release.zip', '-C', '/extract',
    ]);
    expect(managedGogExtractionCommand('release.tar.gz', '/extract')).toEqual([
      'tar', '-xzf', 'release.tar.gz', '-C', '/extract',
    ]);
  });

  it('fails closed for unsupported release targets', () => {
    expect(() => managedGogAsset('aix', 'ppc64')).toThrow(/unsupported/i);
  });

  it('reconciles the upstream MIT license notice into the managed runtime home', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-gog-license-'));
    try {
      expect(managedGogLicensePath(home)).toBe(join(home, 'licenses', 'gogcli-MIT.txt'));
      expect(ensureManagedGogLicense(home)).toEqual({ changed: true });
      expect(readFileSync(managedGogLicensePath(home), 'utf8')).toBe(GOG_LICENSE_NOTICE);
      expect(GOG_LICENSE_NOTICE).toContain('Copyright (c) 2026 Peter Steinberger');
      expect(ensureManagedGogLicense(home)).toEqual({ changed: false });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('bounds an optional runtime download with an abort signal', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-gog-timeout-'));
    let signal: AbortSignal | null | undefined;
    try {
      await expect(ensureManagedGog({
        home,
        platform: 'darwin',
        arch: 'arm64',
        downloadTimeoutMs: 25,
        fetchImpl: async (_url, init) => {
          signal = init?.signal;
          throw new DOMException('aborted', 'AbortError');
        },
      })).rejects.toThrow(/timed out/i);
      expect(signal).toBeInstanceOf(AbortSignal);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('keeps the download timeout active while consuming the response body', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-gog-body-timeout-'));
    try {
      await expect(ensureManagedGog({
        home,
        platform: 'darwin',
        arch: 'arm64',
        downloadTimeoutMs: 10,
        fetchImpl: async (_url, init) => {
          const signal = init?.signal;
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => {
              await new Promise((resolve) => setTimeout(resolve, 40));
              if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
              return new TextEncoder().encode('body-arrived-after-timeout').buffer;
            },
          } as Response;
        },
      })).rejects.toThrow(/timed out/i);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
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
