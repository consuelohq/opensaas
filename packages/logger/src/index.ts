export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

declare global {
  // eslint-disable-next-line no-var
  var __consuelo_cli_mode: boolean | undefined;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  component: string;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

export interface Transport {
  send(entry: LogEntry): void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = /key|secret|token|password|authorization|cookie|ssn|credit.?card/i;

function redact(attrs: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    clean[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : v;
  }
  return clean;
}

const isProd = () => process.env.NODE_ENV === 'production';

function formatPretty(entry: LogEntry): string {
  const tag = entry.component ? `[${entry.component}]` : '';
  const attrs = entry.attributes && Object.keys(entry.attributes).length
    ? ` ${JSON.stringify(entry.attributes)}`
    : '';
  return `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} ${tag} ${entry.message}${attrs}`;
}

export class Logger {
  private component: string;
  private minLevel: LogLevel;
  private transports: Transport[] = [];

  constructor(component: string, minLevel?: LogLevel) {
    this.component = component;
    this.minLevel = minLevel ?? (isProd() ? 'info' : 'debug');
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  private log(level: LogLevel, message: string, attributes?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      component: this.component,
      timestamp: new Date().toISOString(),
      attributes: attributes ? redact(attributes) : undefined,
    };

    // CLI mode: plain message only, no structured format
    if (globalThis.__consuelo_cli_mode) {
      if (level === 'error') {
        process.stderr.write(`${message}\n`);
      } else {
        process.stdout.write(`${message}\n`);
      }
    } else if (isProd()) {
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      // eslint-disable-next-line no-console
      console.log(formatPretty(entry));
    }

    for (const t of this.transports) {
      try { t.send(entry); } catch { /* transport errors should not crash the app */ }
    }
  }

  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log('debug', message, attributes);
  }

  info(message: string, attributes?: Record<string, unknown>): void {
    this.log('info', message, attributes);
  }

  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log('warn', message, attributes);
  }

  error(message: string, attributes?: Record<string, unknown>): void {
    this.log('error', message, attributes);
  }

  child(component: string): Logger {
    const child = new Logger(`${this.component}:${component}`, this.minLevel);
    child.transports = [...this.transports];
    return child;
  }
}

export function createLogger(component: string, minLevel?: LogLevel): Logger {
  return new Logger(component, minLevel);
}

export { PostHogTransport } from './posthog.js';
export type { PostHogTransportConfig } from './posthog.js';
