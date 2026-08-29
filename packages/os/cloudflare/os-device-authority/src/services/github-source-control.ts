import type {
  DeviceAuthorityRuntime,
  GitHubSourceControlRepository,
} from '../types';
import { b64 } from '../utils';

const GITHUB_API_ORIGIN = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const MAX_REPOSITORY_PAGES = 20;

export class GitHubSourceControlError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubSourceControlError';
  }
}

type GitHubAppConfig = {
  appId: string;
  appSlug: string;
  privateKey: string;
};

export type GitHubInstallation = {
  installationId: number;
  accountLogin: string;
  repositorySelection: 'all' | 'selected';
};

export type GitHubInstallationToken = {
  token: string;
  expiresAt: string;
};

function requiredConfig(runtime: DeviceAuthorityRuntime): GitHubAppConfig {
  const appId = runtime.githubAppId?.trim() ?? '';
  const appSlug = runtime.githubAppSlug?.trim() ?? '';
  const privateKey = runtime.githubAppPrivateKey?.trim() ?? '';
  if (!appId || !appSlug || !privateKey) {
    throw new GitHubSourceControlError(
      'GITHUB_APP_NOT_CONFIGURED',
      503,
      'GitHub source control is not configured for this Consuelo deployment.',
    );
  }
  return { appId, appSlug, privateKey };
}

function encodedJson(value: unknown): string {
  return b64(new TextEncoder().encode(JSON.stringify(value)));
}

function pemBytes(value: string): Uint8Array {
  const normalized = value.replace(/\\n/g, '\n');
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!body) {
    throw new GitHubSourceControlError(
      'GITHUB_APP_PRIVATE_KEY_INVALID',
      503,
      'GitHub source control credentials are invalid.',
    );
  }
  try {
    const raw = atob(body);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  } catch {
    throw new GitHubSourceControlError(
      'GITHUB_APP_PRIVATE_KEY_INVALID',
      503,
      'GitHub source control credentials are invalid.',
    );
  }
}

async function githubAppJwt(runtime: DeviceAuthorityRuntime): Promise<string> {
  const config = requiredConfig(runtime);
  const nowSeconds = Math.floor(runtime.now() / 1000);
  const header = encodedJson({ alg: 'RS256', typ: 'JWT' });
  const payload = encodedJson({
    iat: nowSeconds - 60,
    exp: nowSeconds + 8 * 60,
    iss: config.appId,
  });
  const unsigned = `${header}.${payload}`;
  try {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemBytes(config.privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(unsigned),
    );
    return `${unsigned}.${b64(new Uint8Array(signature))}`;
  } catch (error: unknown) {
    if (error instanceof GitHubSourceControlError) throw error;
    throw new GitHubSourceControlError(
      'GITHUB_APP_PRIVATE_KEY_INVALID',
      503,
      'GitHub source control credentials are invalid.',
    );
  }
}

async function githubRequest(
  runtime: DeviceAuthorityRuntime,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<Response> {
  const { token, ...requestInit } = init;
  const authorization = token
    ? `Bearer ${token}`
    : `Bearer ${await githubAppJwt(runtime)}`;
  let response: Response;
  try {
    response = await runtime.fetchImpl(new Request(new URL(path, GITHUB_API_ORIGIN), {
      ...requestInit,
      headers: {
        accept: 'application/vnd.github+json',
        authorization,
        'x-github-api-version': GITHUB_API_VERSION,
        ...(requestInit.headers ?? {}),
      },
    }));
  } catch {
    throw new GitHubSourceControlError(
      'GITHUB_API_UNAVAILABLE',
      502,
      'GitHub could not be reached while connecting source control.',
    );
  }
  if (!response.ok) {
    throw new GitHubSourceControlError(
      response.status === 404 ? 'GITHUB_INSTALLATION_NOT_FOUND' : 'GITHUB_API_FAILED',
      response.status === 404 ? 400 : 502,
      response.status === 404
        ? 'The GitHub App installation could not be verified.'
        : 'GitHub rejected the source-control connection request.',
    );
  }
  return response;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function githubInstallationUrl(runtime: DeviceAuthorityRuntime, state: string): string {
  const config = requiredConfig(runtime);
  const url = new URL(`/apps/${encodeURIComponent(config.appSlug)}/installations/new`, 'https://github.com');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function readGitHubInstallation(
  runtime: DeviceAuthorityRuntime,
  installationId: number,
): Promise<GitHubInstallation> {
  try {
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new GitHubSourceControlError(
        'GITHUB_INSTALLATION_INVALID',
        400,
        'GitHub returned an invalid installation.',
      );
    }
    const response = await githubRequest(runtime, `/app/installations/${installationId}`);
    const body = record(await response.json());
    const account = record(body.account);
    const accountLogin = typeof account.login === 'string' ? account.login.trim() : '';
    const repositorySelection = body.repository_selection === 'all' ? 'all' : 'selected';
    if (body.id !== installationId || !accountLogin) {
      throw new GitHubSourceControlError(
        'GITHUB_INSTALLATION_INVALID',
        400,
        'GitHub returned incomplete installation metadata.',
      );
    }
    return { installationId, accountLogin, repositorySelection };
  } catch (error: unknown) {
    if (error instanceof GitHubSourceControlError) throw error;
    throw new GitHubSourceControlError(
      'GITHUB_INSTALLATION_INVALID',
      502,
      'GitHub returned invalid installation metadata.',
    );
  }
}

export async function createGitHubInstallationToken(
  runtime: DeviceAuthorityRuntime,
  installationId: number,
): Promise<GitHubInstallationToken> {
  try {
    const response = await githubRequest(runtime, `/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
    });
    const body = record(await response.json());
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const expiresAt = typeof body.expires_at === 'string' ? body.expires_at.trim() : '';
    if (!token || !expiresAt || !Number.isFinite(Date.parse(expiresAt))) {
      throw new GitHubSourceControlError(
        'GITHUB_INSTALLATION_TOKEN_INVALID',
        502,
        'GitHub returned an invalid installation credential.',
      );
    }
    return { token, expiresAt };
  } catch (error: unknown) {
    if (error instanceof GitHubSourceControlError) throw error;
    throw new GitHubSourceControlError(
      'GITHUB_INSTALLATION_TOKEN_INVALID',
      502,
      'GitHub returned an invalid installation credential.',
    );
  }
}

export async function listGitHubInstallationRepositories(
  runtime: DeviceAuthorityRuntime,
  installationId: number,
): Promise<GitHubSourceControlRepository[]> {
  try {
    const { token } = await createGitHubInstallationToken(runtime, installationId);
    const repositories: GitHubSourceControlRepository[] = [];
    for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
      const response = await githubRequest(
        runtime,
        `/installation/repositories?per_page=100&page=${page}`,
        { token },
      );
      const body = record(await response.json());
      const pageRepositories = Array.isArray(body.repositories) ? body.repositories : [];
      for (const value of pageRepositories) {
        const repository = record(value);
        const id = typeof repository.id === 'number' ? repository.id : Number.NaN;
        const nameWithOwner = typeof repository.full_name === 'string'
          ? repository.full_name.trim()
          : '';
        const defaultBranch = typeof repository.default_branch === 'string'
          ? repository.default_branch.trim()
          : '';
        if (!Number.isInteger(id) || id <= 0 || !nameWithOwner || !defaultBranch) {
          throw new GitHubSourceControlError(
            'GITHUB_REPOSITORY_METADATA_INVALID',
            502,
            'GitHub returned invalid repository metadata.',
          );
        }
        repositories.push({ id, nameWithOwner, defaultBranch });
      }
      if (pageRepositories.length < 100) break;
      if (page === MAX_REPOSITORY_PAGES) {
        throw new GitHubSourceControlError(
          'GITHUB_REPOSITORY_LIMIT_EXCEEDED',
          409,
          'The GitHub installation contains too many repositories to import safely.',
        );
      }
    }
    return repositories;
  } catch (error: unknown) {
    if (error instanceof GitHubSourceControlError) throw error;
    throw new GitHubSourceControlError(
      'GITHUB_REPOSITORY_METADATA_INVALID',
      502,
      'GitHub returned invalid repository metadata.',
    );
  }
}
