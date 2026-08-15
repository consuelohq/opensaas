#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';

import { resolveConsueloHomeLayout } from './lib/consuelo-home';
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeAuthorizationCode,
  startLoopbackCapture,
} from './lib/operator-login';
import {
  operatorTokenPath,
  readStoredOperatorToken,
  type StoredOperatorToken,
  writeStoredOperatorToken,
} from './lib/operator-token-store';

/**
 * `consuelo login` — obtain an operator workspace token without reinstalling.
 *
 * Previously the only way to authenticate was the device flow embedded in the installer, so being
 * logged out meant reinstalling the whole runtime. This also makes `workspace:nodes` usable, which
 * documented a credential that no flow could issue.
 *
 * The token is stored under the node security directory with owner-only permissions. It is never
 * printed, and never accepted or emitted as a command-line argument.
 */

const USAGE = `usage: login [--status | --logout]

  (no flags)   sign in through the browser and store an operator token
  --status     report whether a stored token is present and unexpired
  --logout     remove the stored token

The value is never printed. Use --status to check without revealing it.
`;

const DEFAULT_AUTHORITY = 'https://os.consuelohq.com';
const SCOPES = [
  'mcp:read',
  'workspace:read',
  'workspace:nodes:manage',
  'os:tools',
] as const;

const die = (message: string, code = 1): never => {
  process.stderr.write(`${message}\n`);
  process.exit(code);
};

const readWorkspaceHost = (home: string): string => {
  const configPath = path.join(home, 'config.json');
  if (!fs.existsSync(configPath)) {
    die(`Consuelo OS config not found at ${configPath}`);
  }
  try {
    const host = JSON.parse(fs.readFileSync(configPath, 'utf8'))?.workspace?.host;
    if (typeof host !== 'string' || host === '') {
      die('Consuelo OS config does not name a workspace host');
    }
    return host;
  } catch (error: unknown) {
    return die(
      `Consuelo OS config is unreadable: ${error instanceof Error ? error.message : 'unknown error'}`,
    ) as never;
  }
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }

  const home = resolveConsueloHomeLayout().home;

  if (argv.includes('--logout')) {
    fs.rmSync(operatorTokenPath(home), { force: true });
    process.stdout.write('signed out\n');
    return;
  }

  if (argv.includes('--status')) {
    const stored = readStoredOperatorToken({ home, allowExpired: true });
    if (!stored) {
      process.stdout.write('signed out\n');
      process.exitCode = 1;
      return;
    }
    const expired =
      typeof stored.expiresAt === 'number' && stored.expiresAt <= Date.now();
    process.stdout.write(
      `${expired ? 'expired' : 'signed in'} · ${stored.workspaceHost} · scopes: ${stored.scope.join(' ') || 'none'}\n`,
    );
    if (expired) process.exitCode = 1;
    return;
  }

  const authorityOrigin =
    process.env.CONSUELO_OS_AUTHORITY_ORIGIN?.trim() || DEFAULT_AUTHORITY;
  const workspaceHost = readWorkspaceHost(home);
  // The central resource, so the authority resolves the workspace from the signed-in account
  // rather than the caller naming it.
  const resource = `${authorityOrigin}/mcp`;

  const { verifier, challenge } = createPkcePair();
  const state = createPkcePair().verifier;
  const capture = await startLoopbackCapture({ state });

  const authorizeUrl = buildAuthorizeUrl({
    authorityOrigin,
    redirectUri: capture.redirectUri,
    challenge,
    state,
    resource,
    scope: SCOPES,
  });

  process.stdout.write(
    `Open this URL to sign in:\n\n  ${authorizeUrl}\n\nWaiting for authorization...\n`,
  );

  let code: string;
  try {
    code = await capture.waitForCode();
  } catch (error: unknown) {
    return die(
      error instanceof Error ? error.message : 'authorization failed',
    );
  }

  let result: Awaited<ReturnType<typeof exchangeAuthorizationCode>>;
  try {
    result = await exchangeAuthorizationCode({
      authorityOrigin,
      code,
      verifier,
      redirectUri: capture.redirectUri,
      resource,
    });
  } catch (error: unknown) {
    return die(
      error instanceof Error ? error.message : 'token exchange failed',
    );
  }

  const stored: StoredOperatorToken = {
    version: 1,
    kind: 'consuelo-operator-token',
    authorityOrigin,
    workspaceHost,
    accessToken: result.accessToken,
    ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
    ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
    scope: result.scope,
    createdAt: new Date().toISOString(),
  };
  writeStoredOperatorToken(home, stored);

  process.stdout.write(
    `signed in · ${workspaceHost} · scopes: ${result.scope.join(' ') || 'none'}\n`,
  );
}

await main();
