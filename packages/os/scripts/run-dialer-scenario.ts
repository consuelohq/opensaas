#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

type ScenarioMode = 'single' | 'predictive' | 'both';
type ScenarioCallMode = 'mock' | 'twilio-test' | 'live';
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

type StartDialerCallResult = {
  sessionId: string;
  twilioGroupId: string | null;
  queueId: string;
  selectionStrategy: string;
  requestedFanout: number;
  actualFanout: number;
  status: string;
  capacity: {
    requestedFanout: number;
    callableTargetCount: number;
    availableCallerIdCount: number;
    reducedCapacityReasons: string[];
    blockedReasons: string[];
    actualFanout: number;
  };
  calls: Array<{
    callSid: string;
    contactId: string;
    customerNumber: string;
    callerId: string;
    status: string;
    position: number;
  }>;
};

type ScenarioStep = {
  name: string;
  run: () => Promise<unknown>;
};

type ScenarioLog = {
  startedAt: string;
  baseUrl: string;
  metadataUrl: string;
  graphqlUrl: string;
  scenarioMode: ScenarioMode;
  callMode: ScenarioCallMode;
  liveCallsEnabled: boolean;
  safeToNumberCount: number;
  safeFromNumberCount: number;
  twilioTestCredentialPresence: {
    accountSid: boolean;
    authToken: boolean;
  };
  steps: Array<{
    name: string;
    ok: boolean;
    detail: JsonValue;
    at: string;
  }>;
};

const apiBaseUrl = trimTrailingSlash(
  process.env.CONSUELO_API_BASE_URL ?? 'https://consuelo.consuelohq.com',
);
const metadataUrl =
  process.env.CONSUELO_METADATA_URL ?? `${apiBaseUrl}/metadata`;
const graphqlUrl = process.env.CONSUELO_GRAPHQL_URL ?? metadataUrl;
const email = process.env.CONSUELO_EMAIL ?? '';
const password = process.env.CONSUELO_PASSWORD ?? '';
const providedUserToken = process.env.CONSUELO_USER_TOKEN ?? '';
const scenarioMode = parseScenarioMode(
  process.env.CONSUELO_SCENARIO_MODE ?? 'both',
);
const callMode = parseScenarioCallMode(
  process.env.CONSUELO_SCENARIO_CALL_MODE ?? 'mock',
);
const liveCallsEnabled =
  process.env.CONSUELO_SCENARIO_LIVE_CALLS_ENABLED === 'true';
const safeToNumbers = parsePhoneList(
  process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS,
);
const safeFromNumbers = parsePhoneList(
  process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS,
);
const explicitTargetPhones = parsePhoneList(
  process.env.CONSUELO_SCENARIO_TARGET_PHONES,
);
const explicitContactIds = parseCsv(process.env.CONSUELO_SCENARIO_CONTACT_IDS);
const scenarioWorkspaceId = process.env.CONSUELO_SCENARIO_WORKSPACE_ID ?? '';
const requestedFanout = parseIntegerEnvironmentValue(
  process.env.CONSUELO_SCENARIO_REQUESTED_FANOUT,
  2,
);
const now = new Date().toISOString().replace(/[:.]/g, '-');
const transcriptPath =
  process.env.CONSUELO_SCENARIO_TRANSCRIPT ??
  `/tmp/dialer-scenario-${now}.json`;

let userToken = providedUserToken;

const scenarioLog: ScenarioLog = {
  startedAt: new Date().toISOString(),
  baseUrl: apiBaseUrl,
  metadataUrl,
  graphqlUrl,
  scenarioMode,
  callMode,
  liveCallsEnabled,
  safeToNumberCount: safeToNumbers.length,
  safeFromNumberCount: safeFromNumbers.length,
  twilioTestCredentialPresence: {
    accountSid: Boolean(process.env.TWILIO_TEST_ACCOUNT_SID),
    authToken: Boolean(process.env.TWILIO_TEST_AUTH_TOKEN),
  },
  steps: [],
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseScenarioMode(value: string): ScenarioMode {
  if (value === 'single' || value === 'predictive' || value === 'both') {
    return value;
  }

  throw new Error(`Unsupported CONSUELO_SCENARIO_MODE: ${value}`);
}

function parseScenarioCallMode(value: string): ScenarioCallMode {
  if (value === 'mock' || value === 'twilio-test' || value === 'live') {
    return value;
  }

  throw new Error(`Unsupported CONSUELO_SCENARIO_CALL_MODE: ${value}`);
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parsePhoneList(value: string | undefined): string[] {
  return parseCsv(value);
}

function parseIntegerEnvironmentValue(
  value: string | undefined,
  fallback: number,
): number {
  const parsedValue = Number(value ?? fallback);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

function persistTranscript(): void {
  mkdirSync(dirname(transcriptPath), { recursive: true });
  writeFileSync(
    transcriptPath,
    `${JSON.stringify(scenarioLog, null, 2)}\n`,
    'utf8',
  );
}

function appendStep(name: string, ok: boolean, detail: unknown): void {
  scenarioLog.steps.push({
    name,
    ok,
    detail: redactJsonValue(toJsonValue(detail)),
    at: new Date().toISOString(),
  });
  persistTranscript();
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === 'object') {
    const output: { [key: string]: JsonValue } = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = toJsonValue(nestedValue);
    }

    return output;
  }

  return String(value);
}

function redactJsonValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const output: { [key: string]: JsonValue } = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = redactJsonValue(nestedValue);
    }

    return output;
  }

  return value;
}

function redactSensitiveString(value: string): string {
  return value
    .replace(/\+\d{7,15}/g, (match) => `***${match.slice(-4)}`)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
}

function requireUserToken(): string {
  if (userToken.length === 0) {
    throw new Error(
      'User token missing. Set CONSUELO_USER_TOKEN or CONSUELO_EMAIL/CONSUELO_PASSWORD.',
    );
  }

  return userToken;
}

async function runStep(step: ScenarioStep): Promise<unknown> {
  try {
    const detail = await step.run();
    appendStep(step.name, true, detail);
    return detail;
  } catch (err: unknown) {
    appendStep(step.name, false, {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function authenticateUser(): Promise<string> {
  if (userToken.length > 0) {
    return userToken;
  }

  if (email.length === 0 || password.length === 0) {
    throw new Error(
      'Set CONSUELO_EMAIL and CONSUELO_PASSWORD, or CONSUELO_USER_TOKEN.',
    );
  }

  const result = await graphqlRequest<{
    signIn: {
      availableWorkspaces: {
        availableWorkspacesForSignIn: Array<{
          id: string;
          loginToken?: string | null;
          workspaceUrls: {
            customUrl?: string | null;
            subdomainUrl: string;
          };
        }>;
      };
      tokens: { accessOrWorkspaceAgnosticToken: { token: string } };
    };
  }>({
    endpoint: metadataUrl,
    token: null,
    query: `
      mutation SignIn($email: String!, $password: String!) {
        signIn(email: $email, password: $password) {
          availableWorkspaces {
            availableWorkspacesForSignIn {
              id
              loginToken
              workspaceUrls {
                customUrl
                subdomainUrl
              }
            }
          }
          tokens {
            accessOrWorkspaceAgnosticToken {
              token
            }
          }
        }
      }
    `,
    variables: { email, password },
  });

  const availableWorkspaces =
    result.signIn.availableWorkspaces.availableWorkspacesForSignIn;
  const workspace =
    availableWorkspaces.find(
      (availableWorkspace) => availableWorkspace.id === scenarioWorkspaceId,
    ) ?? availableWorkspaces[0];

  if (workspace?.loginToken) {
    const authTokens = await graphqlRequest<{
      getAuthTokensFromLoginToken: {
        tokens: {
          accessOrWorkspaceAgnosticToken: { token: string };
        };
      };
    }>({
      endpoint: metadataUrl,
      token: null,
      query: `
        mutation GetAuthTokensFromLoginToken(
          $loginToken: String!
          $origin: String!
        ) {
          getAuthTokensFromLoginToken(
            loginToken: $loginToken
            origin: $origin
          ) {
            tokens {
              accessOrWorkspaceAgnosticToken {
                token
              }
            }
          }
        }
      `,
      variables: {
        loginToken: workspace.loginToken,
        origin: resolveWorkspaceOrigin(workspace.workspaceUrls),
      },
    });

    userToken =
      authTokens.getAuthTokensFromLoginToken.tokens
        .accessOrWorkspaceAgnosticToken.token;
    return userToken;
  }

  userToken = result.signIn.tokens.accessOrWorkspaceAgnosticToken.token;
  return userToken;
}

function resolveWorkspaceOrigin(workspaceUrls: {
  customUrl?: string | null;
  subdomainUrl: string;
}): string {
  const explicitOrigin = process.env.CONSUELO_SCENARIO_WORKSPACE_ORIGIN;

  if (explicitOrigin && explicitOrigin.length > 0) {
    return explicitOrigin;
  }

  return workspaceUrls.customUrl ?? workspaceUrls.subdomainUrl;
}

async function graphqlRequest<TData>(params: {
  endpoint: string;
  token: string | null;
  query: string;
  variables: Record<string, unknown>;
}): Promise<TData> {
  const response = await fetch(params.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(params.token ? { authorization: `Bearer ${params.token}` } : {}),
    },
    body: JSON.stringify({
      query: params.query,
      variables: params.variables,
    }),
  });
  const text = await response.text();

  if (response.status >= 400) {
    throw new Error(
      `GraphQL HTTP ${response.status}: ${redactSensitiveString(text)}`,
    );
  }

  const body = JSON.parse(text) as GraphqlResponse<TData>;

  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `GraphQL errors: ${body.errors.map((error) => error.message).join('; ')}`,
    );
  }

  if (!body.data) {
    throw new Error(`GraphQL returned no data: ${redactSensitiveString(text)}`);
  }

  return body.data;
}

function assertLiveSafety(): void {
  if (callMode === 'twilio-test') {
    assertTwilioTestSafety();
    return;
  }

  if (callMode !== 'live') {
    return;
  }

  if (!liveCallsEnabled) {
    throw new Error(
      'Live scenario mode requires CONSUELO_SCENARIO_LIVE_CALLS_ENABLED=true.',
    );
  }

  if (safeToNumbers.length === 0 || safeFromNumbers.length === 0) {
    throw new Error('Live scenario mode requires safe to/from allowlists.');
  }

  const targetPhones = resolveTargetPhones();

  for (const phone of targetPhones) {
    if (!safeToNumbers.includes(phone)) {
      throw new Error(
        `Live scenario target number is outside the safe allowlist: ${redactSensitiveString(
          phone,
        )}`,
      );
    }
  }
}

function assertTwilioTestSafety(): void {
  const testAccountSid = process.env.TWILIO_TEST_ACCOUNT_SID ?? '';
  const testAuthToken = process.env.TWILIO_TEST_AUTH_TOKEN ?? '';

  if (testAccountSid.length === 0 || testAuthToken.length === 0) {
    throw new Error(
      'twilio-test mode requires TWILIO_TEST_ACCOUNT_SID and TWILIO_TEST_AUTH_TOKEN.',
    );
  }

  if (
    testAccountSid === process.env.TWILIO_ACCOUNT_SID ||
    testAuthToken === process.env.TWILIO_AUTH_TOKEN
  ) {
    throw new Error('twilio-test mode cannot use live Twilio credentials.');
  }

  if (safeToNumbers.length === 0 || safeFromNumbers.length === 0) {
    throw new Error(
      'twilio-test mode requires explicit safe to/from scenario numbers.',
    );
  }
}

function resolveTargetPhones(): string[] {
  if (explicitTargetPhones.length > 0) {
    return explicitTargetPhones;
  }

  if (safeToNumbers.length > 0) {
    return safeToNumbers;
  }

  return ['+14155550199', '+14155550198'];
}

function resolveCallerIdNumber(): string | undefined {
  if (safeFromNumbers.length > 0) {
    return safeFromNumbers[0];
  }

  return undefined;
}

async function startDialerCall(
  input: Record<string, unknown>,
): Promise<StartDialerCallResult> {
  const result = await graphqlRequest<{
    startDialerCall: StartDialerCallResult;
  }>({
    endpoint: graphqlUrl,
    token: requireUserToken(),
    query: `
      mutation StartDialerCall($input: StartDialerCallInput!) {
        startDialerCall(input: $input) {
          sessionId
          twilioGroupId
          queueId
          selectionStrategy
          requestedFanout
          actualFanout
          status
          capacity {
            requestedFanout
            callableTargetCount
            availableCallerIdCount
            reducedCapacityReasons
            blockedReasons
            actualFanout
          }
          calls {
            callSid
            contactId
            customerNumber
            callerId
            status
            position
          }
        }
      }
    `,
    variables: { input },
  });

  return result.startDialerCall;
}

async function runSingleScenario(): Promise<StartDialerCallResult> {
  const targetPhone = resolveTargetPhones()[0];

  return startDialerCall({
    source: 'direct',
    selectionStrategy: 'single',
    requestedFanout: 1,
    targetPhone,
    callerIdNumber: resolveCallerIdNumber(),
    callMode,
  });
}

async function runPredictiveScenario(): Promise<StartDialerCallResult> {
  const targetPhones = resolveTargetPhones();
  const input: Record<string, unknown> = {
    source: 'queue',
    selectionStrategy: 'predictive',
    requestedFanout,
    callMode,
  };

  if (explicitContactIds.length > 0) {
    input.contactIds = explicitContactIds;
  } else {
    input.targetPhones = targetPhones;
  }

  return startDialerCall(input);
}

async function main(): Promise<void> {
  persistTranscript();

  await runStep({
    name: 'call-mode-safety-preflight',
    run: async () => {
      assertLiveSafety();
      return {
        callMode,
        liveCallsEnabled,
        safeToNumberCount: safeToNumbers.length,
        safeFromNumberCount: safeFromNumbers.length,
        twilioTestCredentialPresence: scenarioLog.twilioTestCredentialPresence,
      };
    },
  });

  await runStep({
    name: 'authenticate-user',
    run: async () => {
      const token = await authenticateUser();
      return { tokenLength: token.length };
    },
  });

  if (scenarioMode === 'single' || scenarioMode === 'both') {
    await runStep({
      name: 'graphql-start-dialer-call-single',
      run: runSingleScenario,
    });
  }

  if (scenarioMode === 'predictive' || scenarioMode === 'both') {
    await runStep({
      name: 'graphql-start-dialer-call-predictive',
      run: runPredictiveScenario,
    });
  }
}

main()
  .then(() => {
    persistTranscript();
    process.stdout.write(`dialer scenario complete: ${transcriptPath}\n`);
  })
  .catch((err: unknown) => {
    appendStep('scenario-failed', false, {
      message: err instanceof Error ? err.message : String(err),
    });
    process.stderr.write(
      `dialer scenario failed: ${
        err instanceof Error ? redactSensitiveString(err.message) : String(err)
      }\ntranscript: ${transcriptPath}\n`,
    );
    process.exit(1);
  });
