import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export type DiagnosticEnv = Record<string, string | undefined>;
export type InstallDiagnosticStatus = 'start' | 'complete' | 'failed' | 'skipped' | string;

type InstallDiagnosticEvent = {
  at: string;
  type: string;
  name?: string;
  step?: string;
  status?: InstallDiagnosticStatus;
  data?: unknown;
};

export type InstallDiagnostics = {
  enabled: boolean;
  reportDir: string;
  recordStep: (step: string, status: InstallDiagnosticStatus, data?: unknown) => void;
  recordPromptDecision: (name: string, value: unknown) => void;
  recordHttp: (name: string, statusCode: number, state?: string) => void;
  finish: (summary: Record<string, unknown>) => void;
};

const SECRET_KEY_PARTS = [
  'access_token',
  'authorization',
  'bootstrap_token',
  'client_secret',
  'cloudflare_tunnel_token',
  'cloudflared_tunnel_token',
  'code',
  'device_code',
  'refresh_token',
  'secret',
  'state',
  'token',
  'user_code',
] as const;

const SECRET_QUERY_PARAM_PATTERN = /([?&](?:access_token|client_secret|cloudflared?_tunnel_token|code|device_code|refresh_token|state|token|user_code)=)[^&#\s]*/gi;
const USER_PATH_PATTERN = /\/(?:Users|home)\/[^/\s]+(?=\/|$)/g;
const TOKEN_REPLACEMENTS = [
  { pattern: /\b(cloudflared?[_-]tunnel[_-]token\s*=\s*)[^&#\s]+/gi, replacement: '$1[redacted]' },
  { pattern: /cloudflared?[_-]tunnel[_-]token(?!\s*=)[_-]?[A-Za-z0-9._-]*/gi, replacement: '[redacted]' },
  { pattern: /\b(?:Bearer\s+)?(?:cbt|dev|mcp|osat|pat)_[A-Za-z0-9._-]+\b/gi, replacement: '[redacted]' },
  { pattern: /Bearer\s+[A-Za-z0-9._-]+/gi, replacement: '[redacted]' },
] as const;

export function isDevDiagnosticsEnabled(env: DiagnosticEnv = process.env): boolean {
  return env.CONSUELO_OS_DEV_DIAGNOSTICS === '1';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/-/g, '_');
  return SECRET_KEY_PARTS.some((part) => normalizedKey.includes(part));
}

function redactUserPath(value: string): string {
  return value.startsWith('/home/') ? '/home/[user]' : '/Users/[user]';
}

function redactString(value: string): string {
  let redacted = value.replace(USER_PATH_PATTERN, redactUserPath);
  redacted = redacted.replace(SECRET_QUERY_PARAM_PATTERN, '$1[redacted]');
  for (const { pattern, replacement } of TOKEN_REPLACEMENTS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function redactDiagnosticValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactDiagnosticValue(item));
  if (!isRecord(value)) return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    redacted[key] = shouldRedactKey(key) ? '[redacted]' : redactDiagnosticValue(entryValue);
  }
  return redacted;
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = randomBytes(4).toString('hex');
  return `install-${timestamp}-${suffix}`;
}

function createNoopDiagnostics(): InstallDiagnostics {
  return {
    enabled: false,
    reportDir: '',
    recordStep: () => undefined,
    recordPromptDecision: () => undefined,
    recordHttp: () => undefined,
    finish: () => undefined,
  };
}

function appendJsonLine(filePath: string, event: InstallDiagnosticEvent): void {
  try {
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  } catch {
    // Dev diagnostics should never be the reason installation fails.
  }
}

export function createInstallDiagnostics(input: {
  env?: DiagnosticEnv;
  home: string;
  argv?: string[];
}): InstallDiagnostics {
  const env = input.env ?? process.env;
  if (!isDevDiagnosticsEnabled(env)) return createNoopDiagnostics();

  const runId = createRunId();
  const reportDir = env.CONSUELO_OS_DEV_REPORT_DIR
    ?? path.join(env.CONSUELO_OS_DEV_REPORTS_DIR ?? path.join(os.homedir(), '.consuelo-dev-reports'), runId);
  const eventFile = path.join(reportDir, 'installer-events.jsonl');
  const events: InstallDiagnosticEvent[] = [];

  fs.mkdirSync(reportDir, { recursive: true, mode: 0o700 });

  const recordEvent = (event: Omit<InstallDiagnosticEvent, 'at'>): void => {
    const redactedEvent = redactDiagnosticValue({
      at: new Date().toISOString(),
      ...event,
    }) as InstallDiagnosticEvent;
    events.push(redactedEvent);
    appendJsonLine(eventFile, redactedEvent);
  };

  recordEvent({
    type: 'install.start',
    data: {
      argv: input.argv ?? [],
      home: input.home,
      pid: process.pid,
      platform: process.platform,
    },
  });

  return {
    enabled: true,
    reportDir,
    recordStep: (step, status, data) => {
      recordEvent({ type: 'step', step, status, data });
    },
    recordPromptDecision: (name, value) => {
      recordEvent({
        type: 'prompt',
        name,
        data: {
          value: '[redacted]',
          valueKind: Array.isArray(value) ? 'array' : typeof value,
          valueLength: typeof value === 'string' ? value.length : undefined,
          selectedCount: Array.isArray(value) ? value.length : undefined,
        },
      });
    },
    recordHttp: (name, statusCode, state) => {
      recordEvent({ type: 'http', name, status: String(statusCode), data: { state } });
    },
    finish: (summary) => {
      const redactedSummary = redactDiagnosticValue(summary) as Record<string, unknown>;
      const report = {
        ...redactedSummary,
        runId,
        reportDir: redactDiagnosticValue(reportDir),
        home: redactDiagnosticValue(input.home),
        events,
      };
      try {
        fs.writeFileSync(path.join(reportDir, 'install-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
          mode: 0o600,
        });
      } catch {
        // Dev diagnostics should never be the reason installation fails.
      }
    },
  };
}
