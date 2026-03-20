// token management — reads bot tokens from .agent/*.json, falls back to LINEAR_API_KEY for reads
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

type Identity = 'kiro' | 'opencode';

interface TokenFile {
  access_token: string;
  refresh_token: string;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(currentDir, '..', '..');
const tokenPaths: Record<Identity, string> = {
  kiro: resolve(agentDir, '.oauth-token.json'),
  opencode: resolve(agentDir, '.opencode-token.json'),
};
const refreshScript = resolve(agentDir, 'linear-refresh.sh');

function readTokenFile(identity: Identity): string | null {
  try {
    const parsed: TokenFile = JSON.parse(readFileSync(tokenPaths[identity], 'utf-8'));
    return parsed.access_token || null;
  } catch {
    return null;
  }
}

function refreshToken(identity: Identity): boolean {
  try {
    const flag = identity === 'opencode' ? ' --opencode' : '';
    execSync(`bash "${refreshScript}"${flag}`, { timeout: 15000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getWriteToken(identity: Identity): string | null {
  const token = readTokenFile(identity);
  if (token) return token;
  if (refreshToken(identity)) return readTokenFile(identity);
  return null;
}

export function getReadToken(): string {
  const apiKey = process.env.LINEAR_API_KEY;
  if (apiKey) return apiKey;
  const identity = getIdentity();
  const token = getWriteToken(identity);
  if (token) return token;
  throw new Error('no linear token available');
}

export function getIdentity(): Identity {
  return (process.env.LINEAR_IDENTITY as Identity) || 'opencode';
}
