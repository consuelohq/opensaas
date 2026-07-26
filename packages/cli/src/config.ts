import {
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type DialerConfigPathOptions = {
  home?: string;
  cwd?: string;
};

export type DialerConfigPaths = {
  global: string;
  project: string;
  legacyGlobal: string;
  legacyProject: string;
};

export const resolveDialerConfigPaths = (
  options: DialerConfigPathOptions = {},
): DialerConfigPaths => {
  const home = options.home ?? homedir();
  const cwd = options.cwd ?? process.cwd();
  const configRoot = join(home, '.consuelo');
  return {
    global: join(configRoot, 'dialer', 'config.json'),
    project: join(cwd, 'consuelo-dialer.config.json'),
    legacyGlobal: join(configRoot, 'config.json'),
    legacyProject: join(cwd, 'consuelo.config.json'),
  };
};

// backward-compat — existing commands use this
export interface CliConfig {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  llmProvider?: 'groq' | 'openai';
  llmApiKey?: string;
  managed?: boolean;
  apiUrl?: string;
  apiKey?: string;
  workspaceId?: string;
  apiKeyScope?: 'read-only' | 'full';
  apiKeyRoleId?: string;
}

export interface ConsuloConfig {
  version: string;
  database: { type: 'postgres' | 'sqlite'; url?: string };
  server: { port: number; host: string };
  twilio: {
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
    localPresence: boolean;
  };
  ai: {
    provider: 'groq' | 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
  };
  twenty: { enabled: boolean; serverUrl?: string };
  features: {
    dialer: boolean;
    coaching: boolean;
    analytics: boolean;
    files: boolean;
  };
}

export type ConfigScope = 'global' | 'project';

const SENSITIVE_KEYS = new Set([
  'twilio.authToken',
  'ai.apiKey',
  'database.url',
]);

const DEFAULT_CONFIG: ConsuloConfig = {
  version: '1',
  database: { type: 'postgres' },
  server: { port: 3000, host: 'localhost' },
  twilio: { localPresence: false },
  ai: { provider: 'groq' },
  twenty: { enabled: true },
  features: { dialer: true, coaching: true, analytics: true, files: true },
};

// backward-compat — other commands depend on these
export function migrateLegacyConfig(
  destination: string,
  legacySource: string,
  copyFile: typeof copyFileSync = copyFileSync,
): void {
  if (existsSync(destination) || !existsSync(legacySource)) return;
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  try {
    copyFile(legacySource, destination, constants.COPYFILE_EXCL);
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code !== 'EEXIST') throw error;
  }
  chmodSync(destination, 0o600);
}

export const loadConfig = (options: DialerConfigPathOptions = {}): CliConfig => {
  const paths = resolveDialerConfigPaths(options);
  migrateLegacyConfig(paths.global, paths.legacyGlobal);
  try {
    return JSON.parse(readFileSync(paths.global, 'utf-8'));
  } catch (_err: unknown) {
    return {};
  }
};

export const saveConfig = (
  config: CliConfig,
  options: DialerConfigPathOptions = {},
): void => {
  const filePath = resolveDialerConfigPaths(options).global;
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  writeFileSync(filePath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
};

// new config system
const configPath = (
  scope: ConfigScope,
  options: DialerConfigPathOptions = {},
): string => {
  const paths = resolveDialerConfigPaths(options);
  const destination = scope === 'global' ? paths.global : paths.project;
  const legacySource = scope === 'global' ? paths.legacyGlobal : paths.legacyProject;
  migrateLegacyConfig(destination, legacySource);
  return destination;
};

export const loadFullConfig = (
  scope: ConfigScope,
  options: DialerConfigPathOptions = {},
): Partial<ConsuloConfig> => {
  try {
    return JSON.parse(readFileSync(configPath(scope, options), 'utf-8'));
  } catch (_err: unknown) {
    return {};
  }
};

export const saveFullConfig = (
  scope: ConfigScope,
  config: Partial<ConsuloConfig>,
  options: DialerConfigPathOptions = {},
): void => {
  const filePath = configPath(scope, options);
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  writeFileSync(filePath, JSON.stringify(config, null, 2), { mode: 0o600 });
};

export const getDefaultConfig = (): ConsuloConfig =>
  structuredClone(DEFAULT_CONFIG);

// dot-notation helpers
export const getByPath = (
  obj: Record<string, unknown>,
  dotPath: string,
): unknown => {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    )
      return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

export const setByPath = (
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void => {
  const parts = dotPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
};

export const unsetByPath = (
  obj: Record<string, unknown>,
  dotPath: string,
): boolean => {
  const parts = dotPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null)
      return false;
    current = current[part] as Record<string, unknown>;
  }
  const key = parts[parts.length - 1];
  if (!(key in current)) return false;
  delete current[key];
  return true;
};

export const isSensitive = (key: string): boolean => SENSITIVE_KEYS.has(key);

export const flattenConfig = (
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: unknown }> => {
  const entries: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...flattenConfig(v as Record<string, unknown>, fullKey));
    } else {
      entries.push({ key: fullKey, value: v });
    }
  }
  return entries;
};

export const REQUIRED_KEYS = ['database.type', 'server.port', 'server.host'];

export const validateConfig = (
  config: Partial<ConsuloConfig>,
): Array<{ key: string; level: 'error' | 'warning'; message: string }> => {
  const issues: Array<{
    key: string;
    level: 'error' | 'warning';
    message: string;
  }> = [];
  const flat = flattenConfig(config as Record<string, unknown>);
  const keys = new Set(flat.map((e) => e.key));

  for (const req of REQUIRED_KEYS) {
    if (!keys.has(req)) {
      issues.push({
        key: req,
        level: 'error',
        message: `missing required key: ${req}`,
      });
    }
  }

  const port = getByPath(config as Record<string, unknown>, 'server.port');
  if (
    port !== undefined &&
    (typeof port !== 'number' || port < 1 || port > 65535)
  ) {
    issues.push({
      key: 'server.port',
      level: 'error',
      message: 'port must be 1-65535',
    });
  }

  const dbType = getByPath(config as Record<string, unknown>, 'database.type');
  if (dbType !== undefined && dbType !== 'postgres' && dbType !== 'sqlite') {
    issues.push({
      key: 'database.type',
      level: 'error',
      message: 'must be postgres or sqlite',
    });
  }

  // warnings for recommended keys
  if (!keys.has('twilio.accountSid')) {
    issues.push({
      key: 'twilio.accountSid',
      level: 'warning',
      message: 'dialer requires twilio credentials',
    });
  }
  if (!keys.has('ai.apiKey')) {
    issues.push({
      key: 'ai.apiKey',
      level: 'warning',
      message: 'coaching requires an AI provider API key',
    });
  }

  return issues;
};
