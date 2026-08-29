import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const exploreScript = fileURLToPath(new URL('../scripts/explore.js', import.meta.url));

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: 'ignore' });
}

function runExplore(input: { repo: string; home: string; gatewayUrl: string }): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [
      exploreScript,
      'target service bootstrap routing',
      '--budget',
      '5',
      '--json',
    ], {
      cwd: input.repo,
      env: {
        ...process.env,
        CONSUELO_HOME: input.home,
        CONSUELO_EMBEDDING_GATEWAY_URL: input.gatewayUrl,
        CONSUELO_TOOL_CALLER_CWD: input.repo,
        DYLD_LIBRARY_PATH: '/opt/homebrew/opt/sqlite/lib' + (process.env.DYLD_LIBRARY_PATH ? ':' + process.env.DYLD_LIBRARY_PATH : ''),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Explore did not fail over from semantic hydration within 15 seconds'));
    }, 15_000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

describe('Explore semantic index hydration availability', () => {
  it('should stop after the first failed hydration batch and continue with lexical retrieval', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'consuelo-explore-hydration-'));
    const repo = path.join(root, 'repo');
    const home = path.join(root, 'home');
    mkdirSync(repo, { recursive: true });
    mkdirSync(home, { recursive: true });

    run('git', ['init', '-q'], repo);
    run('git', ['config', 'user.email', 'explore-test@consuelohq.com'], repo);
    run('git', ['config', 'user.name', 'Explore Test'], repo);
    for (let index = 0; index < 16; index += 1) {
      writeFileSync(
        path.join(repo, 'service-' + index + '.ts'),
        index === 7
          ? 'export function targetServiceBootstrapRouting() { return "target service bootstrap routing"; }\n'
          : 'export function helper' + index + '() { return "unrelated helper ' + index + '"; }\n',
      );
    }
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-qm', 'fixture'], repo);

    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'embedding_provider_unavailable' } }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('gateway fixture did not bind');

    try {
      const result = await runExplore({
        repo,
        home,
        gatewayUrl: 'http://127.0.0.1:' + address.port + '/v1/os/semantic-embeddings',
      });
      expect(result.code, 'requests=' + requests + '\n' + (result.stderr || result.stdout)).toBe(0);
      const payload = JSON.parse(result.stdout) as { results?: Array<{ path?: string }> };
      expect(payload.results?.some((item) => item.path === 'service-7.ts')).toBe(true);
      expect(requests).toBeLessThanOrEqual(3);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 20_000);

  it('should bound successful semantic hydration instead of rebuilding the whole index synchronously', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'consuelo-explore-hydration-success-'));
    const repo = path.join(root, 'repo');
    const home = path.join(root, 'home');
    mkdirSync(repo, { recursive: true });
    mkdirSync(home, { recursive: true });

    run('git', ['init', '-q'], repo);
    run('git', ['config', 'user.email', 'explore-test@consuelohq.com'], repo);
    run('git', ['config', 'user.name', 'Explore Test'], repo);
    for (let index = 0; index < 96; index += 1) {
      writeFileSync(
        path.join(repo, 'service-' + index + '.ts'),
        index === 47
          ? 'export function targetServiceBootstrapRouting() { return "target service bootstrap routing"; }\n'
          : 'export function helper' + index + '() { return "unrelated helper ' + index + '"; }\n',
      );
    }
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-qm', 'fixture'], repo);

    let requests = 0;
    const server = createServer(async (request, response) => {
      requests += 1;
      let body = '';
      for await (const chunk of request) body += String(chunk);
      const parsed = JSON.parse(body) as { items?: unknown[] };
      const vector = new Array(2560).fill(0);
      vector[0] = 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        data: (parsed.items || []).map(() => ({ embedding: vector })),
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('gateway fixture did not bind');

    try {
      const result = await runExplore({
        repo,
        home,
        gatewayUrl: 'http://127.0.0.1:' + address.port + '/v1/os/semantic-embeddings',
      });
      expect(result.code, 'requests=' + requests + '\n' + (result.stderr || result.stdout)).toBe(0);
      const payload = JSON.parse(result.stdout) as { results?: Array<{ path?: string }> };
      expect(payload.results?.some((item) => item.path === 'service-47.ts')).toBe(true);
      expect(requests).toBeLessThanOrEqual(3);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 20_000);
});
