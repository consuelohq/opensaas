import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import open from 'open';
import { createLogger } from '@consuelo/logger';
import { loadConfig } from './config.js';

const logger = createLogger('CLI:Auth');

// CLI browser auth endpoint on app.consuelohq.com
// This endpoint shows a login page and redirects back with an API key token
const AUTH_URL = 'https://app.consuelohq.com/cli/auth';
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface AuthResult {
  apiKey: string;
  email: string;
  workspaceId?: string;
}

export interface AuthOptions {
  scope?: 'read-only' | 'full';
}

/** Start local server, open browser to auth, wait for callback */
export const authenticateHosted = (
  opts: AuthOptions = {},
): Promise<AuthResult> => {
  const config = loadConfig();
  const scope = opts.scope ?? config.apiKeyScope ?? 'read-only';

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost`);
      const apiKey = url.searchParams.get('token');
      const email = url.searchParams.get('email') ?? 'user';
      const workspaceId = url.searchParams.get('workspaceId') ?? undefined;

      const ok = Boolean(apiKey);
      const title = ok
        ? '✓ Authentication successful!'
        : '✗ Authentication failed';
      const body = ok
        ? 'You can close this window and return to the terminal.'
        : 'No API key was received. Please try again.';

      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:50px">
        <h1>${title}</h1>
        <p>${body}</p>
      </body></html>`);

      server.close();
      clearTimeout(timeout);
      if (apiKey) {
        resolve({ apiKey, email, workspaceId });
      } else {
        reject(new Error('No API key received from authentication server'));
      }
    });

    server.on('error', (err) => {
      if (!err.message.includes('Server is not running')) {
        reject(new Error(`Failed to start auth server: ${err.message}`));
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const callbackUrl = `http://localhost:${port}/callback`;
      const authUrl = `${AUTH_URL}?redirect=${encodeURIComponent(callbackUrl)}&scope=${scope}`;

      logger.info(`Opening browser for authentication...`);
      logger.info(`If browser doesn't open, visit: ${authUrl}`);

      open(authUrl).catch(() => {
        logger.warn(
          'Could not open browser automatically. Please visit the URL above.',
        );
      });
    });

    timeout = setTimeout(() => {
      server.close();
      reject(
        new Error(
          'Authentication timed out after 5 minutes. Please try again.',
        ),
      );
    }, TIMEOUT_MS);
  });
};
