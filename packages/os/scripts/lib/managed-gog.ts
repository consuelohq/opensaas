import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GOG_VERSION = '0.38.1';
const RELEASE_BASE = `https://github.com/openclaw/gogcli/releases/download/v${GOG_VERSION}`;

export const GOG_LICENSE_NOTICE = `MIT License

Copyright (c) 2026 Peter Steinberger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

type ManagedGogAsset = {
  version: string;
  fileName: string;
  sha256: string;
};

const ASSETS: Record<string, ManagedGogAsset> = {
  'darwin:arm64': {
    version: GOG_VERSION,
    fileName: `gogcli_${GOG_VERSION}_darwin_arm64.tar.gz`,
    sha256: 'bad68687094d2ba034d3b2c369ef2e608ce233f5b6d3752cb05508b0c49bd502',
  },
  'darwin:x64': {
    version: GOG_VERSION,
    fileName: `gogcli_${GOG_VERSION}_darwin_amd64.tar.gz`,
    sha256: '43b98b982c4573f2db17f7dd901f12596a2a8bc50727cad1014d1f3c791ed0f6',
  },
  'linux:arm64': {
    version: GOG_VERSION,
    fileName: `gogcli_${GOG_VERSION}_linux_arm64.tar.gz`,
    sha256: '462342542472dcf361744cfe5e15a3540364b4c5120577e4519fffbd1afc6596',
  },
  'linux:x64': {
    version: GOG_VERSION,
    fileName: `gogcli_${GOG_VERSION}_linux_amd64.tar.gz`,
    sha256: '6576828ed6852949ba424b967c3ff4268b3d9c90e201f90fe3d539fe3a151ebb',
  },
  'win32:arm64': {
    version: GOG_VERSION,
    fileName: `gogcli_${GOG_VERSION}_windows_arm64.zip`,
    sha256: 'ed28faa690ed036001e3969855010bcb9fdc2256695791836bfbc63c10ae50ef',
  },
  'win32:x64': {
    version: GOG_VERSION,
    fileName: `gogcli_${GOG_VERSION}_windows_amd64.zip`,
    sha256: '5523764e142d36a460b8c51779fe79b1e34ffcdcb960addd7901542d206e927d',
  },
};

export type ManagedGogRunResult = { exitCode: number; stdout: string; stderr: string };
export type ManagedGogRunner = (command: readonly string[]) => Promise<ManagedGogRunResult>;

const defaultRunner: ManagedGogRunner = async (command) => {
  const child = Bun.spawn([...command], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
};

export function managedGogAsset(
  platform: NodeJS.Platform | string = process.platform,
  arch: NodeJS.Architecture | string = process.arch,
): ManagedGogAsset {
  const asset = ASSETS[`${platform}:${arch}`];
  if (!asset) throw new Error(`unsupported gog release target: ${platform}/${arch}`);
  return { ...asset };
}

export function managedGogPath(
  home: string,
  platform: NodeJS.Platform | string = process.platform,
): string {
  return path.join(path.resolve(home), 'bin', platform === 'win32' ? 'gog.exe' : 'gog');
}

export function managedGogLicensePath(home: string): string {
  return path.join(path.resolve(home), 'licenses', 'gogcli-MIT.txt');
}

export function ensureManagedGogLicense(home: string): { changed: boolean } {
  const noticePath = managedGogLicensePath(home);
  try {
    if (fs.readFileSync(noticePath, 'utf8') === GOG_LICENSE_NOTICE) return { changed: false };
  } catch {
    // Missing or unreadable notices are reconciled below.
  }
  fs.mkdirSync(path.dirname(noticePath), { recursive: true, mode: 0o755 });
  fs.writeFileSync(noticePath, GOG_LICENSE_NOTICE, { encoding: 'utf8', mode: 0o644 });
  return { changed: true };
}

function parsedVersion(output: string): string | undefined {
  return output.match(/\bv(\d+\.\d+\.\d+)\b/)?.[1];
}

async function currentVersion(executable: string, run: ManagedGogRunner): Promise<string | undefined> {
  if (!fs.existsSync(executable)) return undefined;
  try {
    const result = await run([executable, '--version']);
    if (result.exitCode !== 0) return undefined;
    return parsedVersion(`${result.stdout}\n${result.stderr}`);
  } catch {
    return undefined;
  }
}

export function managedGogExtractionCommand(archivePath: string, extractPath: string): string[] {
  return archivePath.endsWith('.zip')
    ? ['tar', '-xf', archivePath, '-C', extractPath]
    : ['tar', '-xzf', archivePath, '-C', extractPath];
}

function findExtractedBinary(
  root: string,
  platform: NodeJS.Platform | string,
): string | undefined {
  const expectedName = platform === 'win32' ? 'gog.exe' : 'gog';
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findExtractedBinary(candidate, platform);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === expectedName) {
      return candidate;
    }
  }
  return undefined;
}

export async function ensureManagedGog(input: {
  home: string;
  platform?: NodeJS.Platform | string;
  arch?: NodeJS.Architecture | string;
  fetchImpl?: typeof fetch;
  run?: ManagedGogRunner;
  downloadTimeoutMs?: number;
}): Promise<{ path: string; version: string; changed: boolean }> {
  const platform = input.platform ?? process.platform;
  const executable = managedGogPath(input.home, platform);
  const run = input.run ?? defaultRunner;
  const existing = await currentVersion(executable, run);
  if (existing === GOG_VERSION) {
    ensureManagedGogLicense(input.home);
    return { path: executable, version: GOG_VERSION, changed: false };
  }

  const asset = managedGogAsset(platform, input.arch ?? process.arch);
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const downloadTimeoutMs = Math.max(1, input.downloadTimeoutMs ?? 60_000);
  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), downloadTimeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${RELEASE_BASE}/${asset.fileName}`, {
      headers: { accept: 'application/octet-stream', 'user-agent': 'consuelo-os' },
      signal: abortController.signal,
    });
  } catch (error: unknown) {
    if (abortController.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new Error(`gog download timed out after ${downloadTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(abortTimer);
  }
  if (!response.ok) throw new Error(`gog download failed with HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== asset.sha256) throw new Error('gog download checksum did not match the pinned release');

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-gog-'));
  try {
    const archivePath = path.join(temporaryRoot, asset.fileName);
    const extractPath = path.join(temporaryRoot, 'extract');
    fs.mkdirSync(extractPath, { recursive: true, mode: 0o700 });
    fs.writeFileSync(archivePath, bytes, { mode: 0o600 });
    const extracted = await run(managedGogExtractionCommand(archivePath, extractPath));
    if (extracted.exitCode !== 0) throw new Error('gog release archive could not be extracted');
    const source = findExtractedBinary(extractPath, platform);
    if (!source) throw new Error('gog release archive did not contain the gog executable');

    fs.mkdirSync(path.dirname(executable), { recursive: true, mode: 0o700 });
    const temporaryExecutable = `${executable}.tmp-${process.pid}`;
    fs.copyFileSync(source, temporaryExecutable);
    fs.chmodSync(temporaryExecutable, 0o755);
    fs.renameSync(temporaryExecutable, executable);
    fs.chmodSync(executable, 0o755);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const installed = await currentVersion(executable, run);
  if (installed !== GOG_VERSION) throw new Error(`managed gog verification failed after install (expected ${GOG_VERSION})`);
  ensureManagedGogLicense(input.home);
  return { path: executable, version: GOG_VERSION, changed: true };
}
