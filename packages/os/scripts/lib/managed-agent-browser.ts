import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { resolveConsueloHome } from './consuelo-home';

export const AGENT_BROWSER_VERSION = '0.40.0';
const RELEASE_URL = `https://github.com/vercel-labs/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}`;
const DOWNLOAD_LIMIT_BYTES = 80 * 1024 * 1024;
const VERSION_TIMEOUT_MS = 5_000;
const INSTALL_TIMEOUT_MS = 180_000;

type Asset = { name: string; sha256: string };
// SHA-256 digests of the immutable v0.40.0 upstream release assets (GitHub asset digest).
const ASSETS: Record<string, Asset> = {
  'darwin:arm64': { name: 'agent-browser-darwin-arm64', sha256: 'b064c9107a0431c76d8916e47c2c8ac322f49c2b2720d6c9036ab538ec1ed911' },
  'darwin:x64': { name: 'agent-browser-darwin-x64', sha256: '478cba056938c5cde286fbeea3994a8b8144f2e18f054684b93abb80c0340d25' },
  'linux:arm64:glibc': { name: 'agent-browser-linux-arm64', sha256: 'f33b4dd9bd7707ad952125937f9de18f93548c5d51283b18092fe21ced6b9e53' },
  'linux:x64:glibc': { name: 'agent-browser-linux-x64', sha256: 'da26cc8029c004325b960fa955951063380cb61e622cc580fd5adf3aa89e4676' },
  'linux:arm64:musl': { name: 'agent-browser-linux-musl-arm64', sha256: '3d4352c0b39f173896aa12af0e63d5905ac8ce7c95575fe6f1f93ce21f9b9e26' },
  'linux:x64:musl': { name: 'agent-browser-linux-musl-x64', sha256: 'aeebf976eb429064efb10179ccdf737ec7d798c019bae7067ce2751c9c6e176a' },
  'win32:x64': { name: 'agent-browser-win32-x64.exe', sha256: 'b142ca8946efda2d506e0947b232596e7949f08296e6b953b57f63eb50fee751' },
  // Windows ARM64 runs the upstream x64 build under Windows x64 emulation.
  'win32:arm64': { name: 'agent-browser-win32-x64.exe', sha256: 'b142ca8946efda2d506e0947b232596e7949f08296e6b953b57f63eb50fee751' },
};

export type ManagedBrowserRunnerResult = { exitCode: number; stdout: string; stderr: string };
export type ManagedBrowserRunner = (argv: readonly string[]) => Promise<ManagedBrowserRunnerResult>;
export type ManagedBrowserStatus = {
  path: string;
  version?: string;
  status: 'ready' | 'missing' | 'outdated' | 'incomplete' | 'unhealthy';
  message: string;
};

function linuxLibc(): 'musl' | 'glibc' {
  return existsSync('/etc/alpine-release') ||
    existsSync('/lib/ld-musl-x86_64.so.1') ||
    existsSync('/lib/ld-musl-aarch64.so.1') ? 'musl' : 'glibc';
}

export function managedAgentBrowserAsset(
  platform: NodeJS.Platform | string = process.platform,
  arch: NodeJS.Architecture | string = process.arch,
  libc: 'musl' | 'glibc' = linuxLibc(),
): Asset {
  const key = platform === 'linux' ? `${platform}:${arch}:${libc}` : `${platform}:${arch}`;
  const asset = ASSETS[key];
  if (!asset) throw new Error(`unsupported agent-browser release target: ${platform}/${arch}`);
  return { ...asset };
}

export function managedAgentBrowserRoot(home: string): string {
  return join(resolveConsueloHome(home), 'managed', 'agent-browser');
}

export function managedAgentBrowserPath(
  home: string,
  platform: NodeJS.Platform | string = process.platform,
): string {
  return join(managedAgentBrowserRoot(home), AGENT_BROWSER_VERSION, platform === 'win32' ? 'agent-browser.exe' : 'agent-browser');
}

export function managedAgentBrowserManifestPath(home: string): string {
  return join(managedAgentBrowserRoot(home), 'active.json');
}

function readActiveVersion(home: string): string | undefined {
  try {
    const json: unknown = JSON.parse(readFileSync(managedAgentBrowserManifestPath(home), 'utf8'));
    if (!json || typeof json !== 'object') return undefined;
    const record = json as { schemaVersion?: unknown; version?: unknown; browserReady?: unknown };
    if (record.schemaVersion !== 1 || record.browserReady !== true || typeof record.version !== 'string') return undefined;
    return /^\d+\.\d+\.\d+$/.test(record.version) ? record.version : undefined;
  } catch {
    return undefined;
  }
}

export async function runManagedBrowserCommand(argv: readonly string[], timeoutMs = INSTALL_TIMEOUT_MS): Promise<ManagedBrowserRunnerResult> {
  return await new Promise((resolvePromise) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timer: NodeJS.Timeout | undefined;
    const finish = (result: ManagedBrowserRunnerResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
    };
    try {
      const child = spawn(argv[0]!, argv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk.toString('utf8')).slice(-16_384); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-16_384); });
      child.on('error', (error) => finish({ exitCode: 1, stdout, stderr: error.message }));
      child.on('exit', (code) => finish({ exitCode: code ?? 1, stdout, stderr }));
      timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 300).unref();
        finish({ exitCode: 124, stdout, stderr: `agent-browser command timed out after ${timeoutMs}ms` });
      }, timeoutMs);
    } catch (error: unknown) {
      finish({ exitCode: 1, stdout, stderr: error instanceof Error ? error.message : String(error) });
    }
  });
}

async function commandVersion(path: string, run: ManagedBrowserRunner): Promise<string | undefined> {
  if (!existsSync(path)) return undefined;
  try {
    const result = await run([path, '--version']);
    if (result.exitCode !== 0) return undefined;
    return /agent-browser\s+(\d+\.\d+\.\d+)/.exec(`${result.stdout}\n${result.stderr}`)?.[1];
  } catch {
    return undefined;
  }
}

export async function inspectManagedAgentBrowser(input: {
  home: string;
  platform?: NodeJS.Platform | string;
  arch?: NodeJS.Architecture | string;
  libc?: 'musl' | 'glibc';
  asset?: Asset;
  run?: ManagedBrowserRunner;
}): Promise<ManagedBrowserStatus> {
  const path = managedAgentBrowserPath(input.home, input.platform);
  const active = readActiveVersion(input.home);
  const version = await commandVersion(path, input.run ?? ((argv) => runManagedBrowserCommand(argv, VERSION_TIMEOUT_MS)));
  if (!active) {
    return { path, version, status: version ? 'incomplete' : 'missing', message: 'Managed agent-browser is not provisioned; run Consuelo OS install/update to install it.' };
  }
  if (active !== AGENT_BROWSER_VERSION) {
    return { path, version: active, status: 'outdated', message: `Managed agent-browser v${active} is behind required v${AGENT_BROWSER_VERSION}; run Consuelo OS update.` };
  }
  if (!version) {
    return { path, status: 'unhealthy', message: 'Managed agent-browser is missing or cannot execute; run Consuelo OS update to repair it.' };
  }
  if (version !== AGENT_BROWSER_VERSION) {
    return { path, version, status: 'unhealthy', message: `Managed agent-browser reports v${version} but v${AGENT_BROWSER_VERSION} is required; run Consuelo OS update.` };
  }
  try {
    const asset = input.asset ?? managedAgentBrowserAsset(input.platform, input.arch, input.libc);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (digest !== asset.sha256) {
      return { path, version, status: 'unhealthy', message: 'Managed agent-browser binary checksum mismatch; run Consuelo OS update.' };
    }
  } catch (error: unknown) {
    return { path, version, status: 'unhealthy', message: 'Managed agent-browser verification failed: ' + (error instanceof Error ? error.message : String(error)) };
  }
  return { path, version, status: 'ready', message: `Managed agent-browser v${version} and browser binaries are provisioned (launch health not tested).` };
}

export async function ensureManagedAgentBrowser(input: {
  home: string;
  platform?: NodeJS.Platform | string;
  arch?: NodeJS.Architecture | string;
  libc?: 'musl' | 'glibc';
  fetchImpl?: typeof fetch;
  run?: ManagedBrowserRunner;
  downloadTimeoutMs?: number;
  /** Injectable pinned-release fixture used in focused, offline tests. */
  asset?: Asset;
}): Promise<{ path: string; version: string; changed: boolean; browserReady: true }> {
  const platform = input.platform ?? process.platform;
  const path = managedAgentBrowserPath(input.home, platform);
  const run = input.run ?? ((argv: readonly string[]) =>
    runManagedBrowserCommand(argv, argv.includes('--version') ? VERSION_TIMEOUT_MS : INSTALL_TIMEOUT_MS));
  const asset = input.asset ?? managedAgentBrowserAsset(platform, input.arch ?? process.arch, input.libc);
  const state = await inspectManagedAgentBrowser({ home: input.home, platform, arch: input.arch, libc: input.libc, asset, run });
  if (state.status === 'ready') return { path, version: AGENT_BROWSER_VERSION, changed: false, browserReady: true };
  if (!/^[0-9a-f]{64}$/.test(asset.sha256)) throw new Error('invalid agent-browser asset checksum');
  if (!existsSync(path) || (await commandVersion(path, run)) !== AGENT_BROWSER_VERSION ||
      createHash('sha256').update(readFileSync(path)).digest('hex') !== asset.sha256) {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch;
    const downloadTimeoutMs = Math.max(1, input.downloadTimeoutMs ?? 60_000);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), downloadTimeoutMs);
    let bytes: Buffer;
    try {
      const response = await fetchImpl(`${RELEASE_URL}/${asset.name}`, {
        signal: abort.signal,
        headers: { accept: 'application/octet-stream', 'user-agent': 'consuelo-os' },
      });
      if (!response.ok) throw new Error(`agent-browser download failed: HTTP ${response.status}`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > DOWNLOAD_LIMIT_BYTES) throw new Error('agent-browser download exceeds size limit');
      bytes = Buffer.from(await response.arrayBuffer());
      if (abort.signal.aborted) throw new Error('agent-browser download timed out while reading');
      if (bytes.byteLength > DOWNLOAD_LIMIT_BYTES) throw new Error('agent-browser download exceeds size limit');
    } catch (error: unknown) {
      if (abort.signal.aborted) throw new Error(`agent-browser download timed out after ${downloadTimeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== asset.sha256) throw new Error('agent-browser download checksum mismatch; refusing to install');
    mkdirSync(resolve(path, '..'), { recursive: true, mode: 0o700 });
    const temporaryPath = `${path}.tmp-${randomUUID()}`;
    try {
      writeFileSync(temporaryPath, bytes, { mode: 0o700, flag: 'wx' });
      if (platform !== 'win32') chmodSync(temporaryPath, 0o700);
      const detectedVersion = await commandVersion(temporaryPath, run);
      if (detectedVersion !== AGENT_BROWSER_VERSION) throw new Error(`agent-browser binary failed version validation (got ${detectedVersion ?? 'unknown'})`);
      renameSync(temporaryPath, path);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }

  // Never attach to, restart, or close the user's existing browser; 'install' only
  // provisions browser binaries. Leave the active manifest untouched if it fails.
  const installed = await run([path, 'install']);
  if (installed.exitCode !== 0) {
    throw new Error(`agent-browser browser installation failed: ${installed.stderr.trim() || installed.stdout.trim() || `exit ${installed.exitCode}`}`);
  }
  const manifestPath = managedAgentBrowserManifestPath(input.home);
  mkdirSync(resolve(manifestPath, '..'), { recursive: true, mode: 0o700 });
  const tempManifest = `${manifestPath}.tmp-${randomUUID()}`;
  try {
    writeFileSync(tempManifest, JSON.stringify({ schemaVersion: 1, version: AGENT_BROWSER_VERSION, browserReady: true }) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(tempManifest, manifestPath);
  } finally {
    rmSync(tempManifest, { force: true });
  }
  return { path, version: AGENT_BROWSER_VERSION, changed: true, browserReady: true };
}
