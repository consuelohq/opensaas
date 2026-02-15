import type { Command } from 'commander';
import {
  loadFullConfig,
  saveFullConfig,
  getByPath,
  setByPath,
  unsetByPath,
  flattenConfig,
  isSensitive,
  validateConfig,
  type ConfigScope,
} from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

const MASK = '••••••••';

const resolveScope = (opts: { scope?: string }): ConfigScope =>
  opts.scope === 'project' ? 'project' : 'global';

const parseValue = (raw: string): unknown => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!Number.isNaN(num) && raw.trim() !== '') return num;
  return raw;
};

const configList = async (opts: { scope?: string; showSensitive?: boolean }): Promise<void> => {
  try {
    const scope = resolveScope(opts);
    const config = loadFullConfig(scope);
    const entries = flattenConfig(config as Record<string, unknown>);

    if (isJson()) {
      const obj: Record<string, unknown> = {};
      for (const { key, value } of entries) {
        obj[key] = isSensitive(key) && !opts.showSensitive ? MASK : value;
      }
      json(obj);
      return;
    }

    if (entries.length === 0) {
      log(`no config found (${scope})`);
      return;
    }

    log(`config (${scope}):\n`);
    for (const { key, value } of entries) {
      const display = isSensitive(key) && !opts.showSensitive ? MASK : String(value);
      log(`  ${key} = ${display}`);
    }
  } catch (err: unknown) {
    captureError(err, { command: 'config list' });
    error(err instanceof Error ? err.message : 'failed to list config');
    process.exit(1);
  }
};

const configGet = async (key: string, opts: { scope?: string; showSensitive?: boolean }): Promise<void> => {
  try {
    const scope = resolveScope(opts);
    const config = loadFullConfig(scope);
    const value = getByPath(config as Record<string, unknown>, key);

    if (value === undefined) {
      if (isJson()) { json({ key, value: null }); return; }
      error(`key not found: ${key}`);
      process.exit(1);
    }

    if (isJson()) {
      json({ key, value: isSensitive(key) && !opts.showSensitive ? MASK : value });
      return;
    }

    const display = isSensitive(key) && !opts.showSensitive ? MASK : String(value);
    log(display);
  } catch (err: unknown) {
    captureError(err, { command: 'config get' });
    error(err instanceof Error ? err.message : 'failed to get config');
    process.exit(1);
  }
};

const configSet = async (key: string, rawValue: string, opts: { scope?: string }): Promise<void> => {
  try {
    const scope = resolveScope(opts);
    const config = loadFullConfig(scope) as Record<string, unknown>;
    const value = parseValue(rawValue);
    setByPath(config, key, value);
    saveFullConfig(scope, config);

    if (isJson()) { json({ key, value, scope }); return; }
    log(`set ${key} = ${String(value)} (${scope})`);
  } catch (err: unknown) {
    captureError(err, { command: 'config set' });
    error(err instanceof Error ? err.message : 'failed to set config');
    process.exit(1);
  }
};

const configUnset = async (key: string, opts: { scope?: string }): Promise<void> => {
  try {
    const scope = resolveScope(opts);
    const config = loadFullConfig(scope) as Record<string, unknown>;
    const removed = unsetByPath(config, key);

    if (!removed) {
      if (isJson()) { json({ key, removed: false }); return; }
      error(`key not found: ${key}`);
      process.exit(1);
    }

    saveFullConfig(scope, config);
    if (isJson()) { json({ key, removed: true, scope }); return; }
    log(`unset ${key} (${scope})`);
  } catch (err: unknown) {
    captureError(err, { command: 'config unset' });
    error(err instanceof Error ? err.message : 'failed to unset config');
    process.exit(1);
  }
};

const configValidate = async (opts: { scope?: string }): Promise<void> => {
  try {
    const scope = resolveScope(opts);
    const config = loadFullConfig(scope);
    const issues = validateConfig(config);

    if (isJson()) { json({ valid: issues.filter((i) => i.level === 'error').length === 0, issues }); return; }

    if (issues.length === 0) {
      log('config is valid');
      return;
    }

    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');

    if (errors.length > 0) {
      log('errors:');
      for (const e of errors) log(`  ✗ ${e.key}: ${e.message}`);
    }
    if (warnings.length > 0) {
      log('warnings:');
      for (const w of warnings) log(`  ⚠ ${w.key}: ${w.message}`);
    }

    if (errors.length > 0) process.exit(1);
  } catch (err: unknown) {
    captureError(err, { command: 'config validate' });
    error(err instanceof Error ? err.message : 'failed to validate config');
    process.exit(1);
  }
};

export const registerConfig = (program: Command): void => {
  const config = program
    .command('config')
    .description('manage consuelo configuration');

  config
    .command('list')
    .description('show all config values')
    .option('--scope <scope>', 'config scope (global or project)', 'global')
    .option('--show-sensitive', 'reveal sensitive values')
    .action(configList);

  config
    .command('get')
    .description('get a config value by key (dot notation)')
    .argument('<key>', 'config key (e.g. twilio.accountSid)')
    .option('--scope <scope>', 'config scope (global or project)', 'global')
    .option('--show-sensitive', 'reveal sensitive values')
    .action(configGet);

  config
    .command('set')
    .description('set a config value')
    .argument('<key>', 'config key (e.g. server.port)')
    .argument('<value>', 'value to set')
    .option('--scope <scope>', 'config scope (global or project)', 'global')
    .action(configSet);

  config
    .command('unset')
    .description('remove a config value')
    .argument('<key>', 'config key to remove')
    .option('--scope <scope>', 'config scope (global or project)', 'global')
    .action(configUnset);

  config
    .command('validate')
    .description('check config for required fields and errors')
    .option('--scope <scope>', 'config scope (global or project)', 'global')
    .action(configValidate);
};
