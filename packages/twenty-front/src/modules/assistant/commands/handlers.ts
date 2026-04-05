import { captureException } from '@sentry/react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

import type {
  CommandResult,
  ContactResult,
  HealthData,
  HistoryEntry,
  MetricsData,
  ParsedCommand,
  SlashCommandName,
} from '@/assistant/commands/types';

const COMMAND_PREFIX = '/consuelo ';

export const parseSlashCommand = (input: string): ParsedCommand | null => {
  const trimmedOriginal = input.trim();
  const trimmedLower = trimmedOriginal.toLowerCase();
  if (!trimmedLower.startsWith(COMMAND_PREFIX)) return null;

  const restLower = trimmedLower.slice(COMMAND_PREFIX.length).trim();

  if (restLower === 'me') return { command: 'me', args: {} };
  if (restLower === 'status') return { command: 'status', args: {} };
  if (restLower === 'history') return { command: 'history', args: {} };

  if (restLower.startsWith('contacts search ')) {
    const restOriginal = trimmedOriginal.slice(COMMAND_PREFIX.length).trim();
    const query = restOriginal.slice('contacts search '.length).trim();
    if (query) return { command: 'contacts-search', args: { query } };
  }

  return null;
};

const apiFetch = async <TData>(path: string): Promise<TData> => {
  const res = await authenticatedFetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 401) {
    throw new Error('Session expired — please log in again');
  }

  if (!res.ok) {
    throw new Error(`Service unavailable (${res.status})`);
  }

  return (await res.json()) as TData;
};

const handlers: Record<
  SlashCommandName,
  (args: Record<string, string>) => Promise<CommandResult>
> = {
  me: async () => {
    try {
      const { metrics } = await apiFetch<{ metrics: MetricsData }>(
        '/v1/analytics/metrics',
      );
      return { command: 'me', data: metrics };
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'slash-command:me' } });
      return {
        command: 'me',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to load stats',
      };
    }
  },

  status: async () => {
    try {
      const health = await apiFetch<HealthData>('/health');
      return { command: 'status', data: health };
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'slash-command:status' } });
      return {
        command: 'status',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to check status',
      };
    }
  },

  'contacts-search': async (args) => {
    try {
      const query = encodeURIComponent(args.query ?? '');
      const { contacts } = await apiFetch<{ contacts: ContactResult[] }>(
        `/v1/contacts/search?q=${query}&limit=5`,
      );
      return { command: 'contacts-search', data: contacts };
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'slash-command:contacts-search' },
      });
      return {
        command: 'contacts-search',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to search contacts',
      };
    }
  },

  history: async () => {
    try {
      const { calls } = await apiFetch<{ calls: HistoryEntry[] }>(
        '/v1/calls/history?limit=10',
      );
      return { command: 'history', data: calls };
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'slash-command:history' } });
      return {
        command: 'history',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to load history',
      };
    }
  },
};

export const executeSlashCommand = async (
  parsed: ParsedCommand,
): Promise<CommandResult> => {
  const handler = handlers[parsed.command];
  return handler(parsed.args);
};
