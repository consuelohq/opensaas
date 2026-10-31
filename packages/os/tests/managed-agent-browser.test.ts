import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AGENT_BROWSER_VERSION,
  ensureManagedAgentBrowser,
  inspectManagedAgentBrowser,
  managedAgentBrowserAsset,
  managedAgentBrowserManifestPath,
  managedAgentBrowserPath,
} from '../scripts/lib/managed-agent-browser';
import { resolveAgentBrowserCommand } from '../scripts/lib/browser/managed-cli';

const homes: string[] = [];
const home = () => {
  const path = mkdtempSync(join(tmpdir(), 'consuelo-browser-managed-'));
  homes.push(path);
  return path;
};
afterEach(() => { for (const path of homes.splice(0)) rmSync(path, { recursive: true, force: true }); });

const sampleBinary = Buffer.from('#!/bin/sh\necho agent-browser 0.40.0\n');
const sampleDigest = createHash('sha256').update(sampleBinary).digest('hex');
const asset = {
  name: 'agent-browser-darwin-arm64',
  sha256: sampleDigest,
};
const fetchImpl: typeof fetch = async () => new Response(sampleBinary, { status: 200 });
const calls: string[][] = [];
const run = async (argv: readonly string[]) => {
  calls.push([...argv]);
  return { exitCode: 0, stdout: argv.includes('--version') ? 'agent-browser 0.40.0\n' : '', stderr: '' };
};

describe('managed agent-browser dependency', () => {
  afterEach(() => calls.splice(0));
  it('pins checksum-verified upstream artifacts per OS and fails closed for unsupported targets', () => {
    expect(AGENT_BROWSER_VERSION).toBe('0.40.0');
    expect(managedAgentBrowserAsset('darwin', 'arm64').sha256).toBe('b064c9107a0431c76d8916e47c2c8ac322f49c2b2720d6c9036ab538ec1ed911');
    expect(managedAgentBrowserAsset('linux', 'x64').name).toBe('agent-browser-linux-x64');
    expect(managedAgentBrowserAsset('linux', 'arm64', 'musl').name).toBe('agent-browser-linux-musl-arm64');
    expect(managedAgentBrowserAsset('win32', 'x64').name).toBe('agent-browser-win32-x64.exe');
    expect(managedAgentBrowserAsset('win32', 'arm64').name).toBe('agent-browser-win32-x64.exe');
    expect(() => managedAgentBrowserAsset('aix', 'ppc64')).toThrow(/unsupported/i);
  });

  it('installs verified binary and browser dependency into OS-owned versioned location and is idempotent', async () => {
    const dir = home();
    const args = { home: dir, platform: 'darwin', arch: 'arm64', asset, fetchImpl, run };
    expect((await inspectManagedAgentBrowser({ home: dir, asset, run })).status).toBe('missing');
    const first = await ensureManagedAgentBrowser(args);
    expect(first).toMatchObject({ version: AGENT_BROWSER_VERSION, changed: true, browserReady: true });
    expect(first.path).toBe(managedAgentBrowserPath(dir, 'darwin'));
    expect(readFileSync(first.path).equals(sampleBinary)).toBe(true);
    expect(existsSync(managedAgentBrowserManifestPath(dir))).toBe(true);
    expect(calls.some((argv) => argv[1] === 'install')).toBe(true);
    const before = calls.length;
    const second = await ensureManagedAgentBrowser(args);
    expect(second.changed).toBe(false);
    expect(calls.length).toBeGreaterThanOrEqual(before);
    expect(calls.slice(before).some((argv) => argv[1] === 'install')).toBe(false);
    expect((await inspectManagedAgentBrowser({ home: dir, asset, run })).status).toBe('ready');
    expect(resolveAgentBrowserCommand({ CONSUELO_HOME: dir, HOME: dir }, 'darwin')).toBe(first.path);
  });

  it('detects post-install tampering and repairs without trusting the spoofed version', async () => {
    const dir = home();
    await ensureManagedAgentBrowser({ home: dir, platform: 'darwin', arch: 'arm64', asset, fetchImpl, run });
    const binary = managedAgentBrowserPath(dir, 'darwin');
    writeFileSync(binary, Buffer.from('corrupt-binary'));
    expect((await inspectManagedAgentBrowser({ home: dir, asset, run })).status).toBe('unhealthy');
    const repaired = await ensureManagedAgentBrowser({
      home: dir, platform: 'darwin', arch: 'arm64', asset, fetchImpl, run,
    });
    expect(repaired.changed).toBe(true);
    expect((await inspectManagedAgentBrowser({ home: dir, asset, run })).status).toBe('ready');
  });

  it('refuses tampered downloads without activating anything or touching browser profiles', async () => {
    const dir = home();
    const profile = join(dir, 'persistent-profile', 'Cookies');
    mkdirSync(dirname(profile), { recursive: true });
    writeFileSync(profile, 'login stays');
    await expect(ensureManagedAgentBrowser({
      home: dir, platform: 'darwin', arch: 'arm64', asset: { ...asset, sha256: 'f'.repeat(64) }, fetchImpl, run,
    })).rejects.toThrow(/checksum/i);
    expect(existsSync(managedAgentBrowserManifestPath(dir))).toBe(false);
    expect(readFileSync(profile, 'utf8')).toBe('login stays');
    expect(resolveAgentBrowserCommand({ CONSUELO_HOME: dir, HOME: dir }, 'darwin')).toBe('agent-browser');
  });

  it('keeps previous versions active until the browser install completes', async () => {
    const dir = home();
    const failingRun = async (argv: readonly string[]) =>
      argv.includes('install')
        ? { exitCode: 7, stdout: '', stderr: 'download offline' }
        : { exitCode: 0, stdout: 'agent-browser 0.40.0', stderr: '' };
    await expect(ensureManagedAgentBrowser({
      home: dir, platform: 'darwin', arch: 'arm64', asset, fetchImpl, run: failingRun,
    })).rejects.toThrow(/download offline/i);
    expect(existsSync(managedAgentBrowserManifestPath(dir))).toBe(false);
    expect((await inspectManagedAgentBrowser({ home: dir, asset, run: failingRun })).status).not.toBe('ready');
  });

  it('ignores corrupted/untrusted manifest and honors explicit OS binary override without invoking Chrome', () => {
    const dir = home();
    const manifest = managedAgentBrowserManifestPath(dir);
    mkdirSync(dirname(manifest), { recursive: true });
    writeFileSync(manifest, JSON.stringify({ version: '../../evil', browserReady: true }));
    expect(resolveAgentBrowserCommand({ CONSUELO_HOME: dir, HOME: dir }, 'darwin')).toBe('agent-browser');
    expect(resolveAgentBrowserCommand({ CONSUELO_HOME: dir, CONSUELO_AGENT_BROWSER_BIN: '/custom/browser' }, 'darwin')).toBe('/custom/browser');
  });
});
