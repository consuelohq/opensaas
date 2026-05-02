#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

type AuthMode = 'auto' | 'user' | 'apiKey';
type ScenarioStep = { name: string; run: () => Promise<unknown> };

type JsonObject = Record<string, unknown>;

type HttpResult<TResponse> = {
  status: number;
  data: TResponse | null;
  text: string;
  url: string;
  method: string;
};

type QueueItem = JsonObject & {
  id?: string;
  contact_id?: string;
  contactId?: string;
  status?: string;
  position?: number;
  attempts?: number;
  call_outcome?: string | null;
  callOutcome?: string | null;
  skip_reason?: string | null;
  skipReason?: string | null;
};

type QueueState = JsonObject & {
  id?: string;
  status?: string;
  items?: QueueItem[];
};

type AdvanceResult = JsonObject & {
  current?: QueueItem | null;
  currentItem?: QueueItem | null;
  nextItem?: QueueItem | null;
  suppression?: { contactId?: string; reason?: string } | null;
  queueCompleted?: boolean;
  retryScheduled?: boolean;
  retryStrategy?: string;
};

type ScenarioLog = {
  startedAt: string;
  baseUrl: string;
  metadataUrl: string;
  graphqlUrl: string;
  workspaceId: string;
  auth: { mode: AuthMode; hasApiKey: boolean; userTokenLength: number };
  contactIds: string[];
  queueId: string | null;
  steps: Array<{
    name: string;
    attempt: number;
    ok: boolean;
    detail: unknown;
    at: string;
  }>;
};

const apiBaseUrl = trimTrailingSlash(
  process.env.CONSUELO_API_BASE_URL ?? 'https://consuelo.consuelohq.com',
);
const metadataUrl =
  process.env.CONSUELO_METADATA_URL ?? `${apiBaseUrl}/metadata`;
const graphqlUrl = process.env.CONSUELO_GRAPHQL_URL ?? `${apiBaseUrl}/graphql`;
const email = process.env.CONSUELO_EMAIL ?? '';
const password = process.env.CONSUELO_PASSWORD ?? '';
const workspaceId = process.env.CONSUELO_WORKSPACE_ID ?? '7d0894c1-bdb1-4dd6-9a00-78681b52d5f6';
const scenarioListId = process.env.CONSUELO_SCENARIO_LIST_ID;
const explicitContactIds = parseContactIds(process.env.CONSUELO_SCENARIO_CONTACT_IDS);
const apiKey = process.env.CONSUELO_API_KEY ?? '';
const providedUserToken = process.env.CONSUELO_USER_TOKEN ?? '';
const authMode = parseAuthMode(process.env.CONSUELO_AUTH_MODE ?? 'auto');
const now = new Date().toISOString().replace(/[:.]/g, '-');
const transcriptPath = process.env.CONSUELO_SCENARIO_TRANSCRIPT ?? `/tmp/dialer-scenario-${now}.json`;
const maxAttempts = Number(process.env.CONSUELO_SCENARIO_STEP_ATTEMPTS ?? 3);
const retryDelayMilliseconds = Number(process.env.CONSUELO_SCENARIO_RETRY_DELAY_MS ?? 2_000);
const localTimezone = process.env.CONSUELO_SCENARIO_TIMEZONE ?? 'America/New_York';

let userToken = providedUserToken;
let contactIds: string[] = [];
let queueId: string | null = null;

const scenarioLog: ScenarioLog = {
  startedAt: new Date().toISOString(),
  baseUrl: apiBaseUrl,
  metadataUrl,
  graphqlUrl,
  workspaceId,
  auth: { mode: authMode, hasApiKey: apiKey.length > 0, userTokenLength: userToken.length },
  contactIds: [],
  queueId: null,
  steps: [],
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseAuthMode(value: string): AuthMode {
  if (value === 'user' || value === 'apiKey' || value === 'auto') {
    return value;
  }

  throw new Error(`Unsupported CONSUELO_AUTH_MODE: ${value}`);
}

function parseContactIds(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((contactId) => contactId.trim())
    .filter((contactId) => contactId.length > 0);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function appendStep(name: string, attempt: number, ok: boolean, detail: unknown): void {
  scenarioLog.steps.push({ name, attempt, ok, detail, at: new Date().toISOString() });
  persistTranscript();
}

function persistTranscript(): void {
  mkdirSync(dirname(transcriptPath), { recursive: true });
  writeFileSync(transcriptPath, `${JSON.stringify(scenarioLog, null, 2)}\n`, 'utf8');
}

function requireUserToken(): string {
  if (userToken.length === 0) {
    throw new Error('User token missing. Set CONSUELO_USER_TOKEN or CONSUELO_EMAIL/CONSUELO_PASSWORD.');
  }

  return userToken;
}

function buildAuthHeader(mode: 'user' | 'apiKey'): string {
  if (mode === 'apiKey') {
    if (apiKey.length === 0) {
      throw new Error('CONSUELO_API_KEY is required for apiKey auth.');
    }

    return `Bearer ${apiKey}`;
  }

  return `Bearer ${requireUserToken()}`;
}

async function requestJson<TResponse>(url: string, init: RequestInit): Promise<HttpResult<TResponse>> {
  const method = String(init.method ?? 'GET').toUpperCase();
  const response = await fetch(url, init);
  const text = await response.text();

  try {
    return { status: response.status, data: JSON.parse(text) as TResponse, text, url, method };
  } catch {
    return { status: response.status, data: null, text, url, method };
  }
}

async function apiJson<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const response = await requestJson<TResponse>(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: buildAuthHeader('user'),
      ...(init.headers ?? {}),
    },
  });

  if (response.status >= 400) {
    throw new Error(`${response.method} ${response.url} failed (${response.status}): ${response.text}`);
  }

  if (response.data === null) {
    throw new Error(`${response.method} ${response.url} returned non-JSON response: ${response.text}`);
  }

  return response.data;
}

async function apiText(path: string): Promise<{ text: string; contentType: string | null }> {
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    headers: { authorization: buildAuthHeader('user') },
  });
  const text = await response.text();

  if (response.status >= 400) {
    throw new Error(`GET ${url} failed (${response.status}): ${text}`);
  }

  return { text, contentType: response.headers.get('content-type') };
}

async function runWithRetry(step: ScenarioStep): Promise<unknown> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const detail = await step.run();
      appendStep(step.name, attempt, true, detail);
      return detail;
    } catch (error: unknown) {
      appendStep(step.name, attempt, false, {
        message: error instanceof Error ? error.message : String(error),
      });

      if (attempt >= maxAttempts) {
        throw error;
      }

      await sleep(retryDelayMilliseconds);
    }
  }

  throw new Error(`Step failed after retries: ${step.name}`);
}

async function authenticateUser(): Promise<string> {
  if (authMode === 'apiKey') {
    return '';
  }

  if (userToken.length > 0) {
    return userToken;
  }

  if (email.length === 0 || password.length === 0) {
    throw new Error('Set CONSUELO_EMAIL and CONSUELO_PASSWORD, or set CONSUELO_USER_TOKEN.');
  }

  const query = `mutation SignIn($email: String!, $password: String!) { signIn(email: $email, password: $password) { tokens { accessOrWorkspaceAgnosticToken { token } } } }`;
  const response = await requestJson<{
    data?: { signIn?: { tokens?: { accessOrWorkspaceAgnosticToken?: { token?: string } } } };
    errors?: Array<{ message?: string }>;
  }>(metadataUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { email, password } }),
  });

  const token = response.data?.data?.signIn?.tokens?.accessOrWorkspaceAgnosticToken?.token;

  if (!token) {
    throw new Error(`Auth failed (${response.status}): ${response.text}`);
  }

  return token;
}

async function getVoiceStatus(auth: 'user' | 'apiKey'): Promise<unknown> {
  const response = await requestJson<unknown>(`${apiBaseUrl}/v1/voice/status`, {
    headers: { authorization: buildAuthHeader(auth) },
  });

  if (response.status >= 400) {
    throw new Error(`Voice status failed (${auth}, ${response.status}): ${response.text}`);
  }

  return response.data ?? response.text;
}

async function fetchListMembers(): Promise<Array<{ id: string }>> {
  if (!scenarioListId) {
    throw new Error('Set CONSUELO_SCENARIO_LIST_ID or CONSUELO_SCENARIO_CONTACT_IDS.');
  }

  const query = `query ListMembers($filter: ListMemberFilterInput) { listMembers(filter: $filter, first: 100) { edges { node { id } } } }`;
  const response = await requestJson<{
    data?: { listMembers?: { edges?: Array<{ node?: { id?: string } }> } };
    errors?: Array<{ message?: string }>;
  }>(graphqlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: buildAuthHeader('user') },
    body: JSON.stringify({ query, variables: { filter: { listId: { eq: scenarioListId } } } }),
  });

  if (response.status >= 400 || (response.data?.errors?.length ?? 0) > 0) {
    throw new Error(`List members query failed (${response.status}): ${response.text}`);
  }

  return (response.data?.data?.listMembers?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is { id: string } => typeof node?.id === 'string');
}

async function resolveScenarioContactIds(): Promise<string[]> {
  if (explicitContactIds.length > 0) {
    return explicitContactIds;
  }

  const members = await fetchListMembers();

  return members.map((member) => member.id);
}

function assertExactlyFiveContacts(ids: string[]): void {
  const uniqueIds = new Set(ids);

  if (ids.length !== 5) {
    throw new Error(`Expected exactly 5 contacts, got ${ids.length}: ${ids.join(', ')}`);
  }

  if (uniqueIds.size !== ids.length) {
    throw new Error(`Expected 5 unique contacts, got duplicates: ${ids.join(', ')}`);
  }
}

function getContactId(item: QueueItem | null | undefined): string | null {
  if (!item) {
    return null;
  }

  return typeof item.contact_id === 'string'
    ? item.contact_id
    : typeof item.contactId === 'string'
      ? item.contactId
      : null;
}

function getCurrentOrNextItem(result: AdvanceResult): QueueItem | null {
  return result.nextItem ?? result.currentItem ?? result.current ?? null;
}

function assertContact(label: string, item: QueueItem | null | undefined, expectedContactId: string): void {
  const actualContactId = getContactId(item);

  if (actualContactId !== expectedContactId) {
    throw new Error(`${label}: expected contact ${expectedContactId}, got ${actualContactId ?? 'none'}`);
  }
}

async function getQueueState(): Promise<QueueState> {
  if (!queueId) {
    throw new Error('Queue id missing. Create queue before reading queue state.');
  }

  return apiJson<QueueState>(`/api/v1/queues/${queueId}`);
}

function getQueueItems(queue: QueueState): QueueItem[] {
  if (!Array.isArray(queue.items)) {
    throw new Error(`Queue response missing items array: ${JSON.stringify(queue)}`);
  }

  return queue.items;
}

function findItemByContactId(queue: QueueState, contactId: string): QueueItem {
  const item = getQueueItems(queue).find((candidate) => getContactId(candidate) === contactId);

  if (!item) {
    throw new Error(`Queue item missing for contact ${contactId}`);
  }

  return item;
}

function assertItemStatus(queue: QueueState, contactId: string, expectedStatus: string): QueueItem {
  const item = findItemByContactId(queue, contactId);

  if (item.status !== expectedStatus) {
    throw new Error(`Expected contact ${contactId} status ${expectedStatus}, got ${String(item.status)}`);
  }

  return item;
}

async function createQueue(): Promise<QueueState> {
  const queue = await apiJson<QueueState>('/api/v1/queues', {
    method: 'POST',
    body: JSON.stringify({
      name: `Dialer scenario ${new Date().toISOString()}`,
      sourceType: scenarioListId ? 'list' : 'manual',
      sourceId: scenarioListId,
      category: 'scenario',
      contactIds,
      settings: {
        maxAttempts: 1,
        retryAttemptCap: 1,
        minRetrySpacingMinutes: 60,
        maxAttemptsPerDay: 1,
        maxAttemptsPerWeek: 5,
      },
    }),
  });

  if (typeof queue.id !== 'string' || queue.id.length === 0) {
    throw new Error(`Create queue response missing id: ${JSON.stringify(queue)}`);
  }

  queueId = queue.id;
  scenarioLog.queueId = queueId;

  return queue;
}

async function startQueueExpectingContact(expectedContactId: string): Promise<AdvanceResult> {
  if (!queueId) {
    throw new Error('Queue id missing.');
  }

  const result = await apiJson<AdvanceResult>(`/api/v1/queues/${queueId}/start`, { method: 'POST' });
  assertContact('startQueue current item', getCurrentOrNextItem(result), expectedContactId);

  return result;
}

async function advanceWithOutcome(outcome: string): Promise<AdvanceResult> {
  if (!queueId) {
    throw new Error('Queue id missing.');
  }

  return apiJson<AdvanceResult>(`/api/v1/queues/${queueId}/next`, {
    method: 'POST',
    body: JSON.stringify({ outcome, localTimezone }),
  });
}

async function skipCurrentItem(): Promise<AdvanceResult> {
  if (!queueId) {
    throw new Error('Queue id missing.');
  }

  return apiJson<AdvanceResult>(`/api/v1/queues/${queueId}/skip`, { method: 'POST' });
}

async function restartQueue(): Promise<unknown> {
  if (!queueId) {
    throw new Error('Queue id missing.');
  }

  return apiJson(`/api/v1/queues/${queueId}/restart`, { method: 'POST' });
}

async function preflightUserContext(): Promise<unknown> {
  const sourceQuery = scenarioListId
    ? `?sourceType=list&sourceId=${encodeURIComponent(scenarioListId)}`
    : '';

  const response = await requestJson<unknown>(`${apiBaseUrl}/api/v1/queues${sourceQuery}`, {
    headers: { authorization: buildAuthHeader('user') },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`User context missing for dialer endpoints (${response.status}). Use sign-in token, not API key-only.`);
  }

  if (response.status >= 400) {
    throw new Error(`Queue preflight failed (${response.status}): ${response.text}`);
  }

  return response.data ?? response.text;
}

function assertCsvExport(csv: string): { rows: number; bytes: number; preview: string } {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0] ?? '';

  if (!header.includes('id,position,contact_id,status,outcome')) {
    throw new Error(`CSV missing expected queue header: ${header}`);
  }

  if (lines.length < 6) {
    throw new Error(`CSV expected at least 5 data rows, got ${Math.max(lines.length - 1, 0)}`);
  }

  for (const contactId of contactIds) {
    if (!csv.includes(contactId)) {
      throw new Error(`CSV missing contact id ${contactId}`);
    }
  }

  return { rows: lines.length - 1, bytes: csv.length, preview: csv.slice(0, 300) };
}

function buildSteps(): ScenarioStep[] {
  return [
    {
      name: 'authenticate',
      run: async () => {
        userToken = await authenticateUser();
        scenarioLog.auth.userTokenLength = userToken.length;
        return { mode: authMode, apiKeyPresent: apiKey.length > 0, userTokenLength: userToken.length };
      },
    },
    {
      name: 'voice-status-user-token',
      run: async () => getVoiceStatus('user'),
    },
    {
      name: 'voice-status-api-key-optional',
      run: async () => {
        if (apiKey.length === 0) {
          return { skipped: true, reason: 'CONSUELO_API_KEY not set' };
        }

        return getVoiceStatus('apiKey');
      },
    },
    {
      name: 'dialer-user-context-preflight',
      run: preflightUserContext,
    },
    {
      name: 'resolve-five-contacts',
      run: async () => {
        contactIds = await resolveScenarioContactIds();
        assertExactlyFiveContacts(contactIds);
        scenarioLog.contactIds = contactIds;
        return { contactIds };
      },
    },
    {
      name: 'create-queue-with-five-contacts',
      run: createQueue,
    },
    {
      name: 'get-first-item',
      run: async () => startQueueExpectingContact(contactIds[0]),
    },
    {
      name: 'contact-1-no-answer-advances-to-contact-2',
      run: async () => {
        const result = await advanceWithOutcome('no-answer');
        assertContact('contact 1 no-answer next item', result.nextItem, contactIds[1]);
        const queue = await getQueueState();
        assertItemStatus(queue, contactIds[0], 'completed');
        assertItemStatus(queue, contactIds[1], 'calling');
        return { result, queue };
      },
    },
    {
      name: 'contact-2-answered-suppresses-contact-3-and-advances-to-contact-4',
      run: async () => {
        const result = await advanceWithOutcome('answered');
        assertContact('contact 2 answered next item', result.nextItem, contactIds[3]);

        if (!result.suppression) {
          throw new Error(`Expected cadence suppression for contact 3, got ${JSON.stringify(result)}`);
        }

        if (result.suppression.contactId !== contactIds[2]) {
          throw new Error(`Expected contact 3 suppression for ${contactIds[2]}, got ${String(result.suppression.contactId)}`);
        }

        const queue = await getQueueState();
        assertItemStatus(queue, contactIds[1], 'completed');
        assertItemStatus(queue, contactIds[2], 'pending');
        assertItemStatus(queue, contactIds[3], 'calling');
        return { result, queue };
      },
    },
    {
      name: 'user-skip-contact-4-advances-to-contact-5',
      run: async () => {
        const result = await skipCurrentItem();
        assertContact('contact 4 skip next item', result.nextItem, contactIds[4]);
        const queue = await getQueueState();
        assertItemStatus(queue, contactIds[3], 'skipped');
        assertItemStatus(queue, contactIds[4], 'calling');
        return { result, queue };
      },
    },
    {
      name: 'contact-5-answered-exhausts-queue',
      run: async () => {
        const result = await advanceWithOutcome('answered');

        if (result.nextItem !== null && result.nextItem !== undefined) {
          throw new Error(`Expected exhausted queue, got next item ${JSON.stringify(result.nextItem)}`);
        }

        if (result.queueCompleted !== true) {
          throw new Error(`Expected queueCompleted true, got ${String(result.queueCompleted)}`);
        }

        return result;
      },
    },
    {
      name: 'verify-queue-completed',
      run: async () => {
        const queue = await getQueueState();

        if (queue.status !== 'completed') {
          throw new Error(`Expected queue status completed, got ${String(queue.status)}`);
        }

        for (const id of [contactIds[0], contactIds[1], contactIds[4]]) {
          assertItemStatus(queue, id, 'completed');
        }

        assertItemStatus(queue, contactIds[2], 'pending');
        assertItemStatus(queue, contactIds[3], 'skipped');

        return queue;
      },
    },
    {
      name: 'restart-queue',
      run: restartQueue,
    },
    {
      name: 'verify-restart-resets-items-to-pending',
      run: async () => {
        const queue = await getQueueState();

        if (queue.status !== 'idle') {
          throw new Error(`Expected restarted queue status idle, got ${String(queue.status)}`);
        }

        for (const id of contactIds) {
          const item = assertItemStatus(queue, id, 'pending');

          if (Number(item.attempts ?? 0) !== 0) {
            throw new Error(`Expected contact ${id} attempts reset to 0, got ${String(item.attempts)}`);
          }
        }

        return queue;
      },
    },
    {
      name: 'verify-csv-export',
      run: async () => {
        if (!queueId) {
          throw new Error('Queue id missing.');
        }

        const { text, contentType } = await apiText(`/api/v1/queues/${queueId}/export`);
        return { contentType, ...assertCsvExport(text) };
      },
    },
  ];
}

async function main(): Promise<void> {
  persistTranscript();

  for (const step of buildSteps()) {
    await runWithRetry(step);
  }

  persistTranscript();
  process.stdout.write(`Scenario transcript written to ${transcriptPath}\n`);
}

main().catch((error: unknown) => {
  appendStep('fatal', 1, false, { message: error instanceof Error ? error.message : String(error) });
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stderr.write(`Scenario transcript written to ${transcriptPath}\n`);
  process.exit(1);
});
