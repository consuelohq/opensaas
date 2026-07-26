import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESOURCE_PREFIX = 'consuelo-os-dist-test-';
const R2_OBJECT_PREFIX = 'consuelo-os-dist-test';
const MAX_TTL_MS = 6 * 60 * 60 * 1000;
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_VERIFY_ATTEMPTS = 12;
const DEFAULT_VERIFY_DELAY_MS = 5_000;
const DEFAULT_PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

function cloudflareAcceptanceError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Cloudflare acceptance ${operation} failed: ${message}`);
}

export type CloudflareAcceptanceNames = {
  runId: string;
  workerName: string;
  edgeWorkerName: string;
  d1Name: string;
  r2BucketName: string;
  r2Prefix: string;
  hostname: string;
  edgeHostname: string;
};

export type CloudflareAcceptanceInventory = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  expiresAt: string;
  names: CloudflareAcceptanceNames;
  resources: {
    workerName: string;
    edgeWorkerName: string;
    d1Name: string;
    d1Id?: string;
    r2BucketName: string;
    r2Prefix: string;
    hostname: string;
    edgeHostname: string;
  };
};

export type CloudflareResourceListing = {
  workers: string[];
  d1: Array<{ id: string; name: string }>;
  r2Buckets: string[];
};

export type CloudflareAcceptanceClient = {
  createD1(name: string): Promise<{ id: string; name: string }>;
  createR2Bucket(name: string): Promise<void>;
  listResources(): Promise<CloudflareResourceListing>;
  deleteWorker(name: string): Promise<void>;
  deleteD1(id: string): Promise<void>;
  deleteR2Bucket(name: string): Promise<void>;
};

export type CloudflareCleanupResult = {
  runId: string;
  deleted: string[];
  unknown: string[];
};

export type CloudflareAcceptanceWranglerConfigs = {
  authority: Record<string, unknown>;
  edge: Record<string, unknown>;
};

export type CloudflareAcceptanceVerification = {
  ok: true;
  runId: string;
  checks: number;
};

function normalizeRunId(runId: string): string {
  const normalized = runId.trim();
  if (!/^\d{1,20}$/.test(normalized)) {
    throw new Error('Cloudflare acceptance run ID must be numeric.');
  }
  return normalized;
}

export function buildCloudflareAcceptanceNames(
  runId: string,
): CloudflareAcceptanceNames {
  const normalized = normalizeRunId(runId);
  const resourceName = `${RESOURCE_PREFIX}${normalized}`;
  return {
    runId: normalized,
    workerName: resourceName,
    edgeWorkerName: `${resourceName}-edge`,
    d1Name: resourceName,
    r2BucketName: resourceName,
    r2Prefix: `${R2_OBJECT_PREFIX}/${normalized}/`,
    hostname: `os-dist-${normalized}.consuelohq.com`,
    edgeHostname: `workspace-dist-${normalized}.consuelohq.com`,
  };
}

export function createCloudflareAcceptanceInventory(input: {
  runId: string;
  nowMs?: number;
}): CloudflareAcceptanceInventory {
  const names = buildCloudflareAcceptanceNames(input.runId);
  const nowMs = input.nowMs ?? Date.now();
  return {
    schemaVersion: 1,
    runId: names.runId,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + MAX_TTL_MS).toISOString(),
    names,
    resources: {
      workerName: names.workerName,
      edgeWorkerName: names.edgeWorkerName,
      d1Name: names.d1Name,
      r2BucketName: names.r2BucketName,
      r2Prefix: names.r2Prefix,
      hostname: names.hostname,
      edgeHostname: names.edgeHostname,
    },
  };
}

function assertRunOwnedInventory(
  inventory: CloudflareAcceptanceInventory,
): void {
  const expected = buildCloudflareAcceptanceNames(inventory.runId);
  if (inventory.schemaVersion !== 1) {
    throw new Error('Unsupported Cloudflare acceptance inventory schema.');
  }
  for (const key of Object.keys(expected) as Array<
    keyof CloudflareAcceptanceNames
  >) {
    if (inventory.names[key] !== expected[key]) {
      throw new Error(
        'Cloudflare acceptance inventory is not owned by this run.',
      );
    }
  }
  const ttlMs =
    Date.parse(inventory.expiresAt) - Date.parse(inventory.createdAt);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    throw new Error(
      'Cloudflare acceptance inventory exceeds the six-hour TTL.',
    );
  }
}

export async function provisionCloudflareAcceptance(
  client: CloudflareAcceptanceClient,
  inventory: CloudflareAcceptanceInventory,
): Promise<CloudflareAcceptanceInventory> {
  try {
    assertRunOwnedInventory(inventory);
    const d1 = await client.createD1(inventory.names.d1Name);
    if (d1.name !== inventory.names.d1Name) {
      throw new Error(
        'Cloudflare returned a D1 database outside the current run.',
      );
    }
    await client.createR2Bucket(inventory.names.r2BucketName);
    return {
      ...inventory,
      resources: {
        ...inventory.resources,
        d1Id: d1.id,
      },
    };
  } catch (error: unknown) {
    throw cloudflareAcceptanceError('provisioning', error);
  }
}

export function renderCloudflareAcceptanceWranglerConfigs(
  inventory: CloudflareAcceptanceInventory,
  options: { projectRoot: string },
): CloudflareAcceptanceWranglerConfigs {
  assertRunOwnedInventory(inventory);
  const d1Id = inventory.resources.d1Id?.trim();
  if (!d1Id) {
    throw new Error('Cloudflare acceptance D1 database ID is required.');
  }
  const projectRoot = resolve(options.projectRoot);
  const authorityOrigin = `https://${inventory.names.hostname}`;
  const sharedSigningSecret = `acceptance-${inventory.runId}-edge-signing`;
  const d1Binding = {
    binding: 'WORKSPACE_ROUTE_REGISTRY',
    database_name: inventory.names.d1Name,
    database_id: d1Id,
    migrations_dir: join(
      projectRoot,
      'cloudflare',
      'workspace-edge',
      'migrations',
    ),
  };

  return {
    authority: {
      name: inventory.names.workerName,
      main: join(
        projectRoot,
        'cloudflare',
        'os-device-authority',
        'src',
        'worker.ts',
      ),
      compatibility_date: '2026-06-11',
      compatibility_flags: ['nodejs_compat'],
      routes: [
        {
          pattern: inventory.names.hostname,
          custom_domain: true,
        },
      ],
      vars: {
        OS_DEVICE_AUTH_ORIGIN: authorityOrigin,
        OS_DEVICE_AUTH_BASE_DOMAIN: 'consuelohq.com',
        OS_DEVICE_AUTH_WORKSPACE_EDGE_HOSTNAME: inventory.names.edgeHostname,
        WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: sharedSigningSecret,
      },
      d1_databases: [d1Binding],
      durable_objects: {
        bindings: [
          {
            name: 'DEVICE_GRANTS',
            class_name: 'OsDeviceGrantDurableObject',
          },
        ],
      },
      migrations: [
        {
          tag: 'v1',
          new_sqlite_classes: ['OsDeviceGrantDurableObject'],
        },
      ],
    },
    edge: {
      name: inventory.names.edgeWorkerName,
      main: join(
        projectRoot,
        'cloudflare',
        'workspace-edge',
        'src',
        'index.ts',
      ),
      compatibility_date: '2026-06-11',
      compatibility_flags: ['nodejs_compat'],
      routes: [
        {
          pattern: inventory.names.edgeHostname,
          custom_domain: true,
        },
      ],
      vars: {
        CONSUELO_EDGE_SIGNING_SECRET: sharedSigningSecret,
        WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: sharedSigningSecret,
      },
      durable_objects: {
        bindings: [
          {
            name: 'OS_DEVICE_AUTHORITY',
            class_name: 'OsDeviceGrantDurableObject',
            script_name: inventory.names.workerName,
          },
        ],
      },
      d1_databases: [d1Binding],
      r2_buckets: [
        {
          binding: 'SITES_SNAPSHOTS',
          bucket_name: inventory.names.r2BucketName,
        },
      ],
    },
  };
}

function reservedUnknownResources(
  listing: CloudflareResourceListing,
  names: CloudflareAcceptanceNames,
): string[] {
  const ownedWorkers = new Set([names.workerName, names.edgeWorkerName]);
  const unknown: string[] = [];
  for (const worker of listing.workers) {
    if (worker.startsWith(RESOURCE_PREFIX) && !ownedWorkers.has(worker)) {
      unknown.push(`worker:${worker}`);
    }
  }
  for (const database of listing.d1) {
    if (
      database.name.startsWith(RESOURCE_PREFIX) &&
      database.name !== names.d1Name
    ) {
      unknown.push(`d1:${database.id}:${database.name}`);
    }
  }
  for (const bucket of listing.r2Buckets) {
    if (bucket.startsWith(RESOURCE_PREFIX) && bucket !== names.r2BucketName) {
      unknown.push(`r2:${bucket}`);
    }
  }
  return unknown.sort();
}

export async function cleanupCloudflareAcceptance(
  client: CloudflareAcceptanceClient,
  inventory: CloudflareAcceptanceInventory,
): Promise<CloudflareCleanupResult> {
  try {
    assertRunOwnedInventory(inventory);
    const listing = await client.listResources();
    const deleted: string[] = [];

    for (const workerName of [
      inventory.names.workerName,
      inventory.names.edgeWorkerName,
    ]) {
      if (listing.workers.includes(workerName)) {
        await client.deleteWorker(workerName);
        deleted.push(`worker:${workerName}`);
      }
    }

    const database = listing.d1.find(
      (candidate) => candidate.name === inventory.names.d1Name,
    );
    if (database) {
      if (
        inventory.resources.d1Id &&
        inventory.resources.d1Id !== database.id
      ) {
        throw new Error(
          'Current-run D1 identity changed; cleanup failed closed.',
        );
      }
      await client.deleteD1(database.id);
      deleted.push(`d1:${database.id}`);
    }

    if (listing.r2Buckets.includes(inventory.names.r2BucketName)) {
      await client.deleteR2Bucket(inventory.names.r2BucketName);
      deleted.push(`r2:${inventory.names.r2BucketName}`);
    }

    return {
      runId: inventory.runId,
      deleted,
      unknown: reservedUnknownResources(listing, inventory.names),
    };
  } catch (error: unknown) {
    throw cloudflareAcceptanceError('cleanup', error);
  }
}

type CloudflareEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result: T;
};

async function readEnvelope<T>(response: Response): Promise<T> {
  try {
    const payload = (await response.json()) as CloudflareEnvelope<T>;
    if (!response.ok || !payload.success) {
      const message = payload.errors
        ?.map((error) => error.message ?? String(error.code ?? 'unknown'))
        .join('; ');
      throw new Error(
        `Cloudflare API request failed: ${message || response.status}`,
      );
    }
    return payload.result;
  } catch (error: unknown) {
    throw cloudflareAcceptanceError('response parsing', error);
  }
}

export function createCloudflareAcceptanceClient(input: {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}): CloudflareAcceptanceClient {
  const accountId = input.accountId.trim();
  const apiToken = input.apiToken.trim();
  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare acceptance requires account ID and test token.',
    );
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const request = async <T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> => {
    try {
      const headers = new Headers(init.headers);
      headers.set('authorization', `Bearer ${apiToken}`);
      if (init.body && !(init.body instanceof FormData)) {
        headers.set('content-type', 'application/json');
      }
      return await readEnvelope<T>(
        await fetchImpl(`${CLOUDFLARE_API_BASE}${path}`, {
          ...init,
          headers,
        }),
      );
    } catch (error: unknown) {
      throw cloudflareAcceptanceError(`request ${path}`, error);
    }
  };

  const listResources = async (): Promise<CloudflareResourceListing> => {
    try {
      const [workersResult, d1Result, r2Result] = await Promise.all([
        request<unknown>(`/accounts/${accountId}/workers/scripts`),
        request<Array<{ uuid?: string; id?: string; name: string }>>(
          `/accounts/${accountId}/d1/database?per_page=100`,
        ),
        request<unknown>(`/accounts/${accountId}/r2/buckets`),
      ]);
      const workerItems = Array.isArray(workersResult)
        ? workersResult
        : ((workersResult as { workers?: unknown[] }).workers ?? []);
      const bucketItems = Array.isArray(r2Result)
        ? r2Result
        : ((r2Result as { buckets?: unknown[] }).buckets ?? []);
      return {
        workers: workerItems
          .map((item) =>
            typeof item === 'string'
              ? item
              : String(
                  (item as { id?: string; name?: string }).id ??
                    (item as { name?: string }).name ??
                    '',
                ),
          )
          .filter(Boolean),
        d1: d1Result
          .map((database) => ({
            id: database.uuid ?? database.id ?? '',
            name: database.name,
          }))
          .filter((database) => Boolean(database.id)),
        r2Buckets: bucketItems
          .map((item) =>
            typeof item === 'string'
              ? item
              : String((item as { name?: string }).name ?? ''),
          )
          .filter(Boolean),
      };
    } catch (error: unknown) {
      throw cloudflareAcceptanceError('resource inventory', error);
    }
  };

  return {
    async createD1(name) {
      try {
        const listing = await listResources();
        const existing = listing.d1.find((database) => database.name === name);
        if (existing) return existing;
        const result = await request<{
          uuid?: string;
          id?: string;
          name: string;
        }>(`/accounts/${accountId}/d1/database`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        const id = result.uuid ?? result.id;
        if (!id) {
          throw new Error('Cloudflare D1 creation returned no database ID.');
        }
        return { id, name: result.name };
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`D1 creation ${name}`, error);
      }
    },
    async createR2Bucket(name) {
      try {
        const listing = await listResources();
        if (listing.r2Buckets.includes(name)) return;
        await request(`/accounts/${accountId}/r2/buckets`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`R2 creation ${name}`, error);
      }
    },
    listResources,
    async deleteWorker(name) {
      try {
        await request(`/accounts/${accountId}/workers/scripts/${name}`, {
          method: 'DELETE',
        });
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`worker deletion ${name}`, error);
      }
    },
    async deleteD1(id) {
      try {
        await request(`/accounts/${accountId}/d1/database/${id}`, {
          method: 'DELETE',
        });
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`D1 deletion ${id}`, error);
      }
    },
    async deleteR2Bucket(name) {
      try {
        await request(`/accounts/${accountId}/r2/buckets/${name}`, {
          method: 'DELETE',
        });
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`R2 deletion ${name}`, error);
      }
    },
  };
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function runVerificationCheck(input: {
  label: string;
  attempts: number;
  delayMs: number;
  sleep: (ms: number) => Promise<void>;
  check: () => Promise<void>;
}): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= input.attempts; attempt += 1) {
    try {
      await input.check();
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt < input.attempts) await input.sleep(input.delayMs);
    }
  }
  throw cloudflareAcceptanceError(input.label, lastError);
}

export async function verifyCloudflareAcceptance(
  client: CloudflareAcceptanceClient,
  inventory: CloudflareAcceptanceInventory,
  options: {
    fetchImpl?: typeof fetch;
    attempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<CloudflareAcceptanceVerification> {
  try {
    assertRunOwnedInventory(inventory);
    if (Date.now() >= Date.parse(inventory.expiresAt)) {
      throw new Error('Cloudflare acceptance inventory has expired.');
    }
    const listing = await client.listResources();
    for (const workerName of [
      inventory.names.workerName,
      inventory.names.edgeWorkerName,
    ]) {
      if (!listing.workers.includes(workerName)) {
        throw new Error(`Cloudflare worker was not found: ${workerName}`);
      }
    }
    const database = listing.d1.find(
      (candidate) => candidate.name === inventory.names.d1Name,
    );
    if (!database || database.id !== inventory.resources.d1Id) {
      throw new Error('Cloudflare acceptance D1 identity is incomplete.');
    }
    if (!listing.r2Buckets.includes(inventory.names.r2BucketName)) {
      throw new Error('Cloudflare acceptance R2 bucket was not found.');
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const attempts = options.attempts ?? DEFAULT_VERIFY_ATTEMPTS;
    const delayMs = options.delayMs ?? DEFAULT_VERIFY_DELAY_MS;
    const sleep =
      options.sleep ??
      ((ms: number) =>
        new Promise<void>((resolveSleep) => setTimeout(resolveSleep, ms)));
    const authorityOrigin = `https://${inventory.names.hostname}`;
    const edgeOrigin = `https://${inventory.names.edgeHostname}`;
    const checks: Array<{ label: string; check: () => Promise<void> }> = [
      {
        label: 'authority health',
        check: async () => {
          try {
            const response = await fetchImpl(`${authorityOrigin}/health`);
            if (response.status !== 200) {
              throw new Error(`expected 200, received ${response.status}`);
            }
          } catch (error: unknown) {
            throw cloudflareAcceptanceError('authority health probe', error);
          }
        },
      },
      {
        label: 'public OAuth metadata',
        check: async () => {
          try {
            const response = await fetchImpl(
              `${authorityOrigin}/.well-known/oauth-protected-resource`,
            );
            const payload = (await responseJson(response)) as
              | { resource?: string }
              | undefined;
            if (
              response.status !== 200 ||
              payload?.resource !== `${authorityOrigin}/mcp`
            ) {
              throw new Error(
                'protected-resource metadata did not match authority origin',
              );
            }
          } catch (error: unknown) {
            throw cloudflareAcceptanceError('OAuth metadata probe', error);
          }
        },
      },
      {
        label: 'MCP bearer challenge',
        check: async () => {
          try {
            const response = await fetchImpl(`${authorityOrigin}/mcp`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
              }),
            });
            const challenge = response.headers.get('www-authenticate') ?? '';
            if (
              response.status !== 401 ||
              !challenge.includes(
                `${authorityOrigin}/.well-known/oauth-protected-resource`,
              )
            ) {
              throw new Error(
                'MCP endpoint did not return the expected bearer challenge',
              );
            }
          } catch (error: unknown) {
            throw cloudflareAcceptanceError(
              'MCP bearer challenge probe',
              error,
            );
          }
        },
      },
      {
        label: 'edge authority binding',
        check: async () => {
          try {
            const response = await fetchImpl(`${edgeOrigin}/auth/consume`);
            const payload = (await responseJson(response)) as
              | { error?: string }
              | undefined;
            if (
              response.status !== 400 ||
              payload?.error !== 'invalid_handoff'
            ) {
              throw new Error(
                'workspace edge did not reach the authority Durable Object',
              );
            }
          } catch (error: unknown) {
            throw cloudflareAcceptanceError('edge authority probe', error);
          }
        },
      },
      {
        label: 'edge fail-closed routing',
        check: async () => {
          try {
            const response = await fetchImpl(`${edgeOrigin}/`, {
              headers: { accept: 'application/json' },
            });
            if (
              response.status !== 404 ||
              response.headers.get('cache-control') !== 'no-store'
            ) {
              throw new Error(
                'workspace edge did not fail closed for an unknown hostname',
              );
            }
          } catch (error: unknown) {
            throw cloudflareAcceptanceError('edge fail-closed probe', error);
          }
        },
      },
    ];

    for (const check of checks) {
      await runVerificationCheck({
        label: check.label,
        attempts,
        delayMs,
        sleep,
        check: check.check,
      });
    }
    return { ok: true, runId: inventory.runId, checks: checks.length };
  } catch (error: unknown) {
    throw cloudflareAcceptanceError('verification', error);
  }
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function writeJson(path: string, value: unknown): void {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readInventory(path: string): CloudflareAcceptanceInventory {
  return JSON.parse(
    readFileSync(resolve(path), 'utf8'),
  ) as CloudflareAcceptanceInventory;
}

async function main(): Promise<void> {
  try {
    const command = process.argv[2];
    const runId = arg('--run-id') ?? process.env.GITHUB_RUN_ID;
    const inventoryPath =
      arg('--inventory') ??
      `packages/os/cloudflare-acceptance-${runId ?? 'unknown'}.json`;
    if (!command || !runId) {
      throw new Error(
        'Usage: cloudflare-acceptance.ts <provision|render|verify|cleanup> --run-id <id> --inventory <path>',
      );
    }
    if (command === 'provision') {
      const client = createCloudflareAcceptanceClient({
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
        apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
      });
      const inventory = await provisionCloudflareAcceptance(
        client,
        createCloudflareAcceptanceInventory({ runId }),
      );
      writeJson(inventoryPath, inventory);
      process.stdout.write(`${JSON.stringify(inventory)}\n`);
      return;
    }

    if (!existsSync(resolve(inventoryPath))) {
      throw new Error('Cloudflare acceptance inventory was not found.');
    }
    const inventory = readInventory(inventoryPath);

    if (command === 'render') {
      const outputDir = arg('--output-dir');
      if (!outputDir) {
        throw new Error('Cloudflare acceptance render requires --output-dir.');
      }
      const configs = renderCloudflareAcceptanceWranglerConfigs(inventory, {
        projectRoot: DEFAULT_PROJECT_ROOT,
      });
      const authorityPath = resolve(outputDir, 'authority.wrangler.json');
      const edgePath = resolve(outputDir, 'edge.wrangler.json');
      writeJson(authorityPath, configs.authority);
      writeJson(edgePath, configs.edge);
      process.stdout.write(
        `${JSON.stringify({ authorityPath, edgePath, runId: inventory.runId })}\n`,
      );
      return;
    }

    const client = createCloudflareAcceptanceClient({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
      apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
    });

    if (command === 'verify') {
      const result = await verifyCloudflareAcceptance(client, inventory);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return;
    }

    if (command === 'cleanup') {
      const result = await cleanupCloudflareAcceptance(client, inventory);
      writeJson(`${inventoryPath}.cleanup.json`, result);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return;
    }

    throw new Error(`Unknown Cloudflare acceptance command: ${command}`);
  } catch (error: unknown) {
    throw cloudflareAcceptanceError('command execution', error);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
