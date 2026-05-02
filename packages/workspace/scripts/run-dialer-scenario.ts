#!/usr/bin/env bun

import { writeFileSync } from 'node:fs';

type ScenarioStep = { name: string; run: () => Promise<unknown> };
type AuthMode = 'auto' | 'user' | 'apiKey';

type ScenarioLog = {
  startedAt: string;
  baseUrl: string;
  metadataUrl: string;
  workspaceId: string;
  auth: { mode: AuthMode; hasApiKey: boolean; userTokenLength: number };
  steps: Array<{ name: string; attempt: number; ok: boolean; detail: unknown; at: string }>;
};

const metadataUrl = process.env.CONSUELO_METADATA_URL ?? 'https://consuelo.consuelohq.com/metadata';
const graphqlUrl = process.env.CONSUELO_GRAPHQL_URL ?? 'https://consuelo.consuelohq.com/graphql';
const apiBaseUrl = process.env.CONSUELO_API_BASE_URL ?? 'https://app.consuelohq.com';
const email = process.env.CONSUELO_EMAIL ?? 'ryancaves22@gmail.com';
const password = process.env.CONSUELO_PASSWORD ?? 'Consuelo2026!';
const workspaceId = process.env.CONSUELO_WORKSPACE_ID ?? '7d0894c1-bdb1-4dd6-9a00-78681b52d5f6';
const scenarioListId = process.env.CONSUELO_SCENARIO_LIST_ID;
const apiKey = process.env.CONSUELO_API_KEY ?? '';
const providedUserToken = process.env.CONSUELO_USER_TOKEN ?? '';
const authMode = (process.env.CONSUELO_AUTH_MODE ?? 'auto') as AuthMode;

const now = new Date().toISOString().replace(/[:.]/g, '-');
const transcriptPath = process.env.CONSUELO_SCENARIO_TRANSCRIPT ?? `/tmp/dialer-scenario-${now}.json`;

let userToken = providedUserToken;

const scenarioLog: ScenarioLog = {
  startedAt: new Date().toISOString(),
  baseUrl: apiBaseUrl,
  metadataUrl,
  workspaceId,
  auth: { mode: authMode, hasApiKey: apiKey.length > 0, userTokenLength: userToken.length },
  steps: [],
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestJson<TResponse>(url: string, init: RequestInit): Promise<{ status: number; data: TResponse | null; text: string }> {
  const response = await fetch(url, init);
  const text = await response.text();
  try { return { status: response.status, data: JSON.parse(text) as TResponse, text }; }
  catch { return { status: response.status, data: null, text }; }
}

function appendStep(name: string, attempt: number, ok: boolean, detail: unknown): void {
  scenarioLog.steps.push({ name, attempt, ok, detail, at: new Date().toISOString() });
}

function buildAuthHeader(mode: 'user' | 'apiKey'): string {
  return mode === 'apiKey' ? `Bearer ${apiKey}` : `Bearer ${userToken}`;
}

async function runWithRetry(step: ScenarioStep): Promise<unknown> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { const detail = await step.run(); appendStep(step.name, attempt, true, detail); return detail; }
    catch (error: unknown) {
      appendStep(step.name, attempt, false, { message: error instanceof Error ? error.message : String(error) });
      if (attempt >= 3) throw error;
      await sleep(2000);
    }
  }
  throw new Error(`Step failed after retries: ${step.name}`);
}

async function authenticateUser(): Promise<string> {
  const query = `mutation SignIn($email: String!, $password: String!) { signIn(email: $email, password: $password) { tokens { accessOrWorkspaceAgnosticToken { token } } } }`;
  const response = await requestJson<{ data?: { signIn?: { tokens?: { accessOrWorkspaceAgnosticToken?: { token?: string } } } } }>(metadataUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: { email, password } }),
  });
  const token = response.data?.data?.signIn?.tokens?.accessOrWorkspaceAgnosticToken?.token;
  if (!token) throw new Error(`Auth failed (${response.status}): ${response.text}`);
  return token;
}

async function getVoiceStatus(auth: 'user' | 'apiKey'): Promise<unknown> {
  const response = await requestJson<unknown>(`${apiBaseUrl}/v1/voice/status`, { headers: { authorization: buildAuthHeader(auth) } });
  if (response.status >= 400) throw new Error(`Voice status failed (${auth}, ${response.status}): ${response.text}`);
  return response.data;
}

async function fetchListMembers(): Promise<Array<{ id: string }>> {
  const query = `query ListMembers($filter: ListMemberFilterInput) { listMembers(filter: $filter, first: 100) { edges { node { id } } } }`;
  const response = await requestJson<{ data?: { listMembers?: { edges?: Array<{ node?: { id?: string } }> } }; errors?: Array<{ message?: string }> }>(graphqlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: buildAuthHeader('user') },
    body: JSON.stringify({ query, variables: { filter: { listId: { eq: scenarioListId } } } }),
  });
  if (response.status >= 400 || (response.data?.errors?.length ?? 0) > 0) throw new Error(`List members query failed (${response.status}): ${response.text}`);
  return (response.data?.data?.listMembers?.edges ?? []).map((edge) => edge.node).filter((node): node is { id: string } => typeof node?.id === 'string');
}

async function preflightUserContext(): Promise<unknown> {
  const response = await requestJson<{ data?: Array<{ id?: string }> }>(`${apiBaseUrl}/api/v1/queues?sourceType=list&sourceId=${encodeURIComponent(scenarioListId ?? '')}`, {
    headers: { authorization: buildAuthHeader('user') },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`User context missing for dialer endpoints (${response.status}). Use sign-in token, not API key-only.`);
  }
  if (response.status >= 400) throw new Error(`Queue preflight failed (${response.status}): ${response.text}`);
  return { status: response.status, queueCount: response.data?.data?.length ?? 0 };
}

async function main(): Promise<void> {
  if (!scenarioListId) throw new Error('Set CONSUELO_SCENARIO_LIST_ID to a list/opportunity ID with exactly 5 contacts');
  if (authMode !== 'apiKey' && userToken.length === 0) {
    userToken = await authenticateUser();
    scenarioLog.auth.userTokenLength = userToken.length;
  }

  const steps: ScenarioStep[] = [
    { name: 'auth-summary', run: async () => ({ mode: authMode, apiKeyPresent: apiKey.length > 0, userTokenLength: userToken.length }) },
    { name: 'voice-status-user-token', run: async () => getVoiceStatus('user') },
    { name: 'voice-status-api-key-optional', run: async () => {
      if (apiKey.length === 0) return { skipped: true, reason: 'CONSUELO_API_KEY not set' };
      return getVoiceStatus('apiKey');
    } },
    { name: 'dialer-user-context-preflight', run: preflightUserContext },
    { name: 'validate-five-list-members', run: async () => {
      const members = await fetchListMembers();
      if (members.length !== 5) throw new Error(`Expected 5 contacts, got ${members.length}`);
      return { count: members.length, ids: members.map((member) => member.id) };
    } },
  ];

  for (const step of steps) await runWithRetry(step);

  appendStep('manual-steps-required', 1, true, {
    note: 'Proceed with start/resume, no-answer/answered, cadence suppression, queue exhaustion, restart, CSV export. Use USER token for dialer endpoints.',
    listId: scenarioListId,
  });

  writeFileSync(transcriptPath, `${JSON.stringify(scenarioLog, null, 2)}
`, 'utf8');
  process.stdout.write(`Scenario transcript written to ${transcriptPath}
`);
}

main().catch((error: unknown) => {
  appendStep('fatal', 1, false, { message: error instanceof Error ? error.message : String(error) });
  writeFileSync(transcriptPath, `${JSON.stringify(scenarioLog, null, 2)}
`, 'utf8');
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`);
  process.exit(1);
});
