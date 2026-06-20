import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assessDangerousMaterial,
  type DangerousMaterialDecision,
} from '../scripts/lib/dangerous-material-policy';
import { removeSafeTempDir } from './safe-temp-cleanup';

type SubprocessHttpResult = {
  status: number;
  text: string;
  json: Record<string, unknown> | null;
};

let tempHome: string;
let tempUserHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-dangerous-material-'));
  tempUserHome = mkdtempSync(join(tmpdir(), 'consuelo-user-dangerous-material-'));
  process.env.CONSUELO_HOME = tempHome;
  process.env.CONSUELO_OS_HOME = tempHome;
  process.env.CONSUELO_OS_AUTH_CONFIG = join(tempHome, 'security', 'generated', 'auth.json');
  process.env.HOME = tempUserHome;
});

afterEach(() => {
  removeSafeTempDir(tempHome, 'consuelo-os-dangerous-material-');
  removeSafeTempDir(tempUserHome, 'consuelo-user-dangerous-material-');
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
});

function joinWords(...parts: string[]): string {
  return parts.join('');
}

function rootDeleteCommand(): string {
  return [joinWords('r', 'm'), `-${joinWords('r', 'f')}`, String.fromCharCode(47)].join(' ');
}

function diskEraseCommand(): string {
  return [
    joinWords('disk', 'util'),
    joinWords('erase', 'Disk'),
    'APFS',
    'name',
    `${String.fromCharCode(47)}dev${String.fromCharCode(47)}disk0`,
  ].join(' ');
}

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      CONSUELO_OS_HOME: tempHome,
      CONSUELO_OS_AUTH_CONFIG: join(tempHome, 'security', 'generated', 'auth.json'),
      HOME: tempUserHome,
    },
    encoding: 'utf8',
  });
}

function readJsonFromBun<T>(code: string): T {
  return JSON.parse(runBunEval(code)) as T;
}

describe('dangerous material policy', () => {
  it('blocks catastrophic command material without echoing raw payloads into the event', () => {
    const body = JSON.stringify({
      name: 'status',
      input: { note: rootDeleteCommand() },
    });

    const decision = assessDangerousMaterial({
      source: 'server:/call raw-body',
      rawBody: body,
    });

    expect(decision).toMatchObject<DangerousMaterialDecision>({
      allowed: false,
      code: 'DANGEROUS_MATERIAL_BLOCKED',
      source: 'server:/call raw-body',
      severity: 'critical',
    });
    expect(JSON.stringify(decision.securityEvent)).not.toContain(rootDeleteCommand());
    expect(decision.securityEvent).toMatchObject({
      event: 'security.dangerous_material.denied',
      rawPayloadCaptured: false,
    });
  });

  it('blocks decoded array-shaped commands before dispatch', () => {
    const decision = assessDangerousMaterial({
      source: 'server:/call decoded-json',
      value: {
        name: 'code.call',
        input: {
          command: [joinWords('r', 'm'), `-${joinWords('r', 'f')}`, String.fromCharCode(47)],
        },
      },
    });

    expect(decision).toMatchObject({
      allowed: false,
      code: 'DANGEROUS_MATERIAL_BLOCKED',
      location: '$.input.command[]',
    });
  });

  it('allows ordinary tool calls and non-command prose', () => {
    expect(assessDangerousMaterial({
      source: 'server:/call decoded-json',
      value: {
        name: 'status',
        input: { note: 'please summarize the current task state' },
      },
    })).toEqual({ allowed: true });
  });

  it('rejects destructive material at server ingress before normal tool execution', () => {
    const response = readJsonFromBun<SubprocessHttpResult>(`
      const { createGatewaySecurityConfig, issueAgentAppToken, signMachineRequest } = await import('./scripts/lib/security-gateway.ts');
      const config = await createGatewaySecurityConfig({
        home: ${JSON.stringify(tempHome)},
        workspaceId: 'workspace-acme',
        workspaceSlug: 'acme',
        workspaceHost: 'acme.consuelohq.com',
      });
      const token = await issueAgentAppToken({
        config,
        callerId: 'chatgpt-app-1',
        appId: 'chatgpt',
        scopes: ['tool:status:read'],
        expiresInSeconds: 300,
      });
      const body = JSON.stringify({
        name: 'status',
        input: {
          note: [
            ['disk', 'util'].join(''),
            ['erase', 'Disk'].join(''),
            'APFS',
            'name',
            String.fromCharCode(47) + 'dev' + String.fromCharCode(47) + 'disk0',
          ].join(' '),
        },
      });
      const signed = await signMachineRequest({
        config,
        token,
        method: 'POST',
        path: '/call',
        body,
        timestamp: '2026-06-16T20:00:00.000Z',
        nonce: 'dangerous-material-ingress-1',
      });
      const { handleRequest } = await import('./scripts/server.ts?dangerous-material-ingress');
      const httpResponse = await handleRequest(new Request('http://127.0.0.1:8960/call', {
        method: 'POST',
        headers: signed.headers,
        body,
      }));
      const text = await httpResponse.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      process.stdout.write(JSON.stringify({ status: httpResponse.status, text, json }));
    `);

    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({
      ok: false,
      error: { code: 'DANGEROUS_MATERIAL_BLOCKED' },
    });
    expect(JSON.stringify(response.json)).not.toContain(diskEraseCommand());
  });
});
