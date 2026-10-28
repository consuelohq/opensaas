import { existsSync } from 'node:fs';

import {
  loadGlobalYamlConfig,
  writeYamlConfig,
  type ConsueloGlobalYamlConfig,
} from '../consuelo-home';
import { lifecycleError } from './errors';
import { resolveLifecyclePaths } from './paths';
import {
  lifecycleReleaseChannels,
  type LifecycleNotificationPreference,
  type LifecyclePreferences,
  type LifecycleReleaseChannel,
} from './types';

const DEFAULT_PREFERENCES: LifecyclePreferences = {
  channel: 'stable',
  notifications: { mode: 'on' },
};

function isChannel(value: unknown): value is LifecycleReleaseChannel {
  return typeof value === 'string' && lifecycleReleaseChannels.includes(value as LifecycleReleaseChannel);
}

function normalizeNotification(
  value: LifecycleNotificationPreference | undefined,
  now: Date,
): LifecycleNotificationPreference {
  if (!value) return { mode: 'on' };
  if (value.mode !== 'snoozed') return value;
  const until = Date.parse(value.snoozedUntil);
  if (!Number.isFinite(until)) {
    throw lifecycleError('CONFIG_INVALID', 'update notification snooze must contain a valid timestamp');
  }
  return until <= now.getTime() ? { mode: 'on' } : value;
}

export function loadLifecyclePreferences(home?: string, now = new Date()): LifecyclePreferences {
  const paths = resolveLifecyclePaths(home);
  if (!existsSync(paths.configPath)) return DEFAULT_PREFERENCES;

  try {
    const config = loadGlobalYamlConfig(paths.configPath);
    const updates = config.updates;
    return {
      channel: isChannel(updates?.channel) ? updates.channel : DEFAULT_PREFERENCES.channel,
      notifications: normalizeNotification(updates?.notifications, now),
    };
  } catch (error: unknown) {
    throw lifecycleError('CONFIG_INVALID', error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
}

function loadWritableConfig(home?: string): ConsueloGlobalYamlConfig {
  const paths = resolveLifecyclePaths(home);
  if (!existsSync(paths.configPath)) {
    return {
      version: 1,
      runtime: { current: 'runtime/current' },
      updates: DEFAULT_PREFERENCES,
    };
  }
  return loadGlobalYamlConfig(paths.configPath);
}

export function writeLifecyclePreferences(
  home: string | undefined,
  preferences: LifecyclePreferences,
): LifecyclePreferences {
  const paths = resolveLifecyclePaths(home);
  try {
    const current = loadWritableConfig(home);
    const next: ConsueloGlobalYamlConfig = {
      ...current,
      updates: preferences,
    };
    writeYamlConfig(paths.configPath, next, false);
    return preferences;
  } catch (error: unknown) {
    throw lifecycleError('CONFIG_WRITE_FAILED', 'failed to persist lifecycle preferences', {
      cause: error,
    });
  }
}

export function setLifecycleChannel(
  home: string | undefined,
  channel: LifecycleReleaseChannel,
  now = new Date(),
): LifecyclePreferences {
  if (!isChannel(channel)) {
    throw lifecycleError('CONFIG_INVALID', `unsupported release channel: ${String(channel)}`);
  }
  const current = loadLifecyclePreferences(home, now);
  return writeLifecyclePreferences(home, { ...current, channel });
}

export function setLifecycleNotificationPreference(
  home: string | undefined,
  notification: LifecycleNotificationPreference,
  now = new Date(),
): LifecyclePreferences {
  const normalized = normalizeNotification(notification, now);
  const current = loadLifecyclePreferences(home, now);
  return writeLifecyclePreferences(home, { ...current, notifications: normalized });
}
