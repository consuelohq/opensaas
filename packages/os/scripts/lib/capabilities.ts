import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  getLocalGuardrailHealth,
  validateManifestGuardrails,
} from './local-guardrails';
import { validateBundledSkills } from './skills';

export type CapabilityHealthStatus =
  | 'connected'
  | 'not_configured'
  | 'missing_capability'
  | 'unhealthy'
  | 'local_only'
  | 'cloud_only'
  | 'permission_denied'
  | 'approval_required'
  | 'validation_failed'
  | 'execution_failed';

export type CapabilityId =
  | 'local-os-home'
  | 'sqlite'
  | 'artifact-storage'
  | 'skills'
  | 'workspace-graphql'
  | 'consuelo-app-graphql'
  | 'consuelo-app-files-api'
  | 'consuelo-os-api'
  | 'agent-connections'
  | 'local-guardrails';

export type CapabilityHealth = {
  id: CapabilityId;
  title: string;
  status: CapabilityHealthStatus;
  message: string;
  details?: unknown;
};

type OsConfig = {
  agents?: Array<{ name: string; connected?: boolean }>;
};

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function resolveCapabilityHome(home?: string): string {
  return path.resolve(
    expandHome(home ?? process.env.CONSUELO_HOME ?? '~/.consuelo/os'),
  );
}

function readConnectedAgentNames(osHome: string): string[] {
  const configPath = path.join(osHome, 'config.json');
  if (!fs.existsSync(configPath)) return [];
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as OsConfig;
    return [
      ...new Set(
        (config.agents ?? [])
          .filter((agent) => agent.connected)
          .map((agent) => agent.name),
      ),
    ].sort();
  } catch {
    return [];
  }
}

function connected(
  id: CapabilityId,
  title: string,
  message: string,
  details?: unknown,
): CapabilityHealth {
  return { id, title, status: 'connected', message, details };
}

function notConfigured(
  id: CapabilityId,
  title: string,
  message: string,
  details?: unknown,
): CapabilityHealth {
  return { id, title, status: 'not_configured', message, details };
}

function unhealthy(
  id: CapabilityId,
  title: string,
  message: string,
  details?: unknown,
): CapabilityHealth {
  return { id, title, status: 'unhealthy', message, details };
}

function permissionDenied(
  id: CapabilityId,
  title: string,
  message: string,
  details?: unknown,
): CapabilityHealth {
  return { id, title, status: 'permission_denied', message, details };
}

export function getCapabilityHealth(home?: string): CapabilityHealth[] {
  const osHome = resolveCapabilityHome(home);
  const checks: CapabilityHealth[] = [];
  const configPath = path.join(osHome, 'config.json');
  const dbPath = path.join(osHome, 'consuelo.db');
  const artifactPath = path.join(osHome, 'artifacts');

  checks.push(
    fs.existsSync(configPath)
      ? connected('local-os-home', 'Local OS home', `${osHome} is configured`)
      : notConfigured(
          'local-os-home',
          'Local OS home',
          `${configPath} is missing`,
        ),
  );

  try {
    const db = new Database(dbPath);
    db.close();
    checks.push(connected('sqlite', 'SQLite', 'SQLite database opens'));
  } catch (error: unknown) {
    checks.push(
      unhealthy(
        'sqlite',
        'SQLite',
        error instanceof Error ? error.message : 'SQLite database failed',
      ),
    );
  }

  checks.push(
    fs.existsSync(artifactPath)
      ? connected(
          'artifact-storage',
          'Artifact storage',
          'Local artifact storage exists',
        )
      : notConfigured(
          'artifact-storage',
          'Artifact storage',
          `${artifactPath} is missing`,
        ),
  );

  const skillIssues = validateBundledSkills();
  const manifestIssues = validateManifestGuardrails();
  const skillDetails = [...skillIssues, ...manifestIssues];
  checks.push(
    skillDetails.length === 0
      ? connected(
          'skills',
          'Skills',
          'Bundled skill metadata and manifest guardrails are valid',
        )
      : unhealthy(
          'skills',
          'Skills',
          `${skillDetails.length} skill metadata issue(s)`,
          skillDetails,
        ),
  );

  const graphqlUrl = process.env.CONSUELO_APP_GRAPHQL_URL ?? process.env.CONSUELO_GRAPHQL_URL;
  const graphqlKey = process.env.CONSUELO_APP_GRAPHQL_API_KEY ?? process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY;
  const appFilesUrl = process.env.CONSUELO_APP_API_URL;
  const appFilesKey = process.env.CONSUELO_APP_API_KEY;
  const osApiUrl = process.env.CONSUELO_OS_API_URL;
  const osApiKey = process.env.CONSUELO_OS_API_KEY;
  checks.push(
    graphqlUrl && graphqlKey
      ? connected(
          'workspace-graphql',
          'Workspace GraphQL',
          new URL(graphqlUrl).host,
        )
      : notConfigured(
          'workspace-graphql',
          'Workspace GraphQL',
          'Workspace GraphQL capability is not configured',
        ),
  );
  checks.push(
    graphqlUrl && graphqlKey
      ? connected(
          'consuelo-app-graphql',
          'Consuelo app GraphQL',
          new URL(graphqlUrl).host,
        )
      : notConfigured(
          'consuelo-app-graphql',
          'Consuelo app GraphQL',
          'Consuelo app GraphQL capability is not configured',
        ),
  );
  checks.push(
    appFilesUrl && appFilesKey
      ? connected(
          'consuelo-app-files-api',
          'Consuelo app Files API',
          new URL(appFilesUrl).host,
        )
      : notConfigured(
          'consuelo-app-files-api',
          'Consuelo app Files API',
          'Consuelo app Files API capability is not configured',
        ),
  );
  checks.push(
    osApiUrl && osApiKey
      ? connected(
          'consuelo-os-api',
          'Consuelo OS API',
          new URL(osApiUrl).host,
        )
      : notConfigured(
          'consuelo-os-api',
          'Consuelo OS API',
          'Future hosted OS control plane is not configured',
        ),
  );

  const connectedAgents = readConnectedAgentNames(osHome);
  checks.push(
    connectedAgents.length > 0
      ? connected(
          'agent-connections',
          'Agent connections',
          `${connectedAgents.length} agent connection(s) recorded`,
          connectedAgents,
        )
      : notConfigured(
          'agent-connections',
          'Agent connections',
          'No local agents are connected yet',
        ),
  );

  const guardrail = getLocalGuardrailHealth(osHome);
  checks.push(
    guardrail.allowed
      ? connected(
          'local-guardrails',
          'Local guardrails',
          guardrail.message,
          guardrail,
        )
      : permissionDenied(
          'local-guardrails',
          'Local guardrails',
          guardrail.message,
          guardrail,
        ),
  );

  return checks;
}

export function isCapabilitySetHealthy(checks: CapabilityHealth[]): boolean {
  return checks.every(
    (check) =>
      check.status === 'connected' ||
      check.status === 'not_configured' ||
      check.status === 'missing_capability' ||
      check.status === 'local_only' ||
      check.status === 'cloud_only',
  );
}
