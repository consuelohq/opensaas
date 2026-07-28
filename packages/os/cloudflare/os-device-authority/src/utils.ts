import {
  CHATGPT_OAUTH_CLIENT_ID,
  CHATGPT_REDIRECT_PREFIX,
  MCP_OAUTH_SCOPES,
} from './constants';
import { grantsRequiredScope } from '../../../scripts/lib/tool-scope-authorization';

export function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function b64Decode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export function rand(prefix: string, len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return `${prefix}_${b64(bytes)}`;
}
export function userCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const c = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${c.slice(0, 4).join('')}-${c.slice(4).join('')}`;
}
export async function hash(value: string): Promise<string> {
  try {
    return b64(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
      ),
    );
  } catch {
    throw new Error('hash failed');
  }
}
export async function hashHex(value: string): Promise<string> {
  try {
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    );
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new Error('hash failed');
  }
}
export async function hashChallenge(value: string): Promise<string> {
  return await hash(value);
}
export async function hmac(secret: string, value: string): Promise<string> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    return b64(
      new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)),
      ),
    );
  } catch {
    throw new Error('auth assertion signing failed');
  }
}
export async function devicePublicKeyThumbprint(
  value: string,
): Promise<string> {
  try {
    return `dpk_${(await hash(value)).slice(0, 32)}`;
  } catch {
    throw new Error('device public key thumbprint failed');
  }
}
export function slug(value: string): string {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!out) throw new Error('workspace_name is required');
  return out;
}
export function host(value: string): string {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  if (!out) throw new Error('workspace_host is required');
  return out;
}
export function optionalNodeId(value: string): string | undefined {
  const out = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '');
  return out || undefined;
}
export function connectorIdFromNodeId(value: string): string {
  const segment =
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'local';
  return `connector_${segment}`;
}
export function workspaceIdFromSlug(value: string): string {
  return `workspace_${slug(value).replace(/-/g, '_')}`;
}
export function baseDomainFromHost(value: string): string {
  const normalized = host(value);
  return normalized.endsWith('.consuelohq.com')
    ? 'consuelohq.com'
    : normalized.split('.').slice(-2).join('.');
}
export function workspaceHostFromMcpResource(resource: string): string {
  const url = new URL(resource);
  if (url.protocol !== 'https:' || url.pathname !== '/mcp')
    throw new Error('invalid_resource');
  return host(url.hostname);
}
export function normalizeScopes(value: string): string[] {
  const requested = value
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const allowed = requested.filter((scope) => MCP_OAUTH_SCOPES.includes(scope));
  const scopes =
    allowed.length > 0 ? allowed : ['mcp:read', 'mcp:call', 'os:tools'];
  if (
    (scopes.includes('mcp:read') || scopes.includes('mcp:call')) &&
    !scopes.includes('route:/mcp:read')
  ) {
    scopes.push('route:/mcp:read');
  }
  return [...new Set(scopes)];
}
export function hasGrantedScope(
  scopes: string[],
  requiredScope: string,
): boolean {
  return grantsRequiredScope(scopes, requiredScope);
}
export function validChatGptRedirectUri(value: string): boolean {
  try {
    return (
      value.startsWith(CHATGPT_REDIRECT_PREFIX) &&
      new URL(value).origin === 'https://chatgpt.com'
    );
  } catch {
    return false;
  }
}
export function validChatGptClientId(value: string): boolean {
  if (value === CHATGPT_OAUTH_CLIENT_ID) return true;
  try {
    const url = new URL(value);
    return (
      url.origin === 'https://chatgpt.com' &&
      url.username === '' &&
      url.password === '' &&
      url.hash === '' &&
      url.pathname.startsWith('/oauth/') &&
      url.pathname.endsWith('/client.json')
    );
  } catch {
    return false;
  }
}
export function cleanCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
}
export function showCode(value: string): string {
  return cleanCode(value).replace(/(.{4})(?=.)/g, '$1-');
}
export function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] ?? c,
  );
}
export async function params(request: Request): Promise<URLSearchParams> {
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await request.json()) as Record<string, string>;
      return new URLSearchParams(body);
    }
    return new URLSearchParams(await request.text());
  } catch {
    throw new Error('parse failed');
  }
}
export function verifyUrl(origin: string, code: string): string {
  const url = new URL('/login/device', origin);
  url.searchParams.set('user_code', cleanCode(code));
  return url.toString();
}
export function stringField(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}
export function expectedDeviceProofPayload(input: {
  clientId: string;
  deviceCode: string;
  devicePublicKeyThumbprint: string;
}): string {
  return `${input.clientId}.${input.deviceCode}.${input.devicePublicKeyThumbprint}`;
}
