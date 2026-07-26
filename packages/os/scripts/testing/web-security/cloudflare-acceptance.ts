import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const RESOURCE_PREFIX = 'consuelo-os-dist-test-';
const R2_OBJECT_PREFIX = 'consuelo-os-dist-test';
const MAX_TTL_MS = 6 * 60 * 60 * 1000;
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

function cloudflareAcceptanceError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Cloudflare acceptance ${operation} failed: ${message}`);
}

export type CloudflareAcceptanceNames = {
  runId: string;
  workerName: string;
  d1Name: string;
  r2BucketName: string;
  r2Prefix: string;
  hostname: string;
};

export type CloudflareAcceptanceInventory = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  expiresAt: string;
  names: CloudflareAcceptanceNames;
  resources: {
    workerName: string;
    d1Name: string;
    d1Id?: string;
    r2BucketName: string;
    r2Prefix: string;
    hostname: string;
  };
};

export type CloudflareResourceListing = {
  workers: string[];
  d1: Array<{ id: string; name: string }>;
  r2Buckets: string[];
};

export type CloudflareAcceptanceClient = {
  createWorker(name: string): Promise<void>;
  createD1(name: string): Promise<{ id: string; name: string }>;
  migrateD1(id: string): Promise<void>;
  createR2Bucket(name: string): Promise<void>;
  verifyWorker(name: string): Promise<void>;
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
    d1Name: resourceName,
    r2BucketName: resourceName,
    r2Prefix: `${R2_OBJECT_PREFIX}/${normalized}/`,
    hostname: `os-dist-${normalized}.consuelohq.com`,
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
      d1Name: names.d1Name,
      r2BucketName: names.r2BucketName,
      r2Prefix: names.r2Prefix,
      hostname: names.hostname,
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
  if (
    inventory.names.workerName !== expected.workerName ||
    inventory.names.d1Name !== expected.d1Name ||
    inventory.names.r2BucketName !== expected.r2BucketName ||
    inventory.names.r2Prefix !== expected.r2Prefix ||
    inventory.names.hostname !== expected.hostname
  ) {
    throw new Error(
      'Cloudflare acceptance inventory is not owned by this run.',
    );
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
    await client.createWorker(inventory.names.workerName);
    const d1 = await client.createD1(inventory.names.d1Name);
    if (d1.name !== inventory.names.d1Name) {
      throw new Error(
        'Cloudflare returned a D1 database outside the current run.',
      );
    }
    await client.migrateD1(d1.id);
    await client.createR2Bucket(inventory.names.r2BucketName);
    await client.verifyWorker(inventory.names.workerName);
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

function reservedUnknownResources(
  listing: CloudflareResourceListing,
  names: CloudflareAcceptanceNames,
): string[] {
  const unknown: string[] = [];
  for (const worker of listing.workers) {
    if (worker.startsWith(RESOURCE_PREFIX) && worker !== names.workerName) {
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

    if (listing.workers.includes(inventory.names.workerName)) {
      await client.deleteWorker(inventory.names.workerName);
      deleted.push(`worker:${inventory.names.workerName}`);
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
    async createWorker(name) {
      try {
        const form = new FormData();
        form.set(
          'metadata',
          new Blob(
            [
              JSON.stringify({
                main_module: 'worker.mjs',
                compatibility_date: '2026-07-01',
              }),
            ],
            { type: 'application/json' },
          ),
          'metadata.json',
        );
        form.set(
          'worker.mjs',
          new Blob(
            [
              "export default { async fetch(request) { const url = new URL(request.url); return Response.json({ ok: true, path: url.pathname }, { headers: { 'cache-control': 'no-store' } }); } };\n",
            ],
            { type: 'application/javascript+module' },
          ),
          'worker.mjs',
        );
        await request(`/accounts/${accountId}/workers/scripts/${name}`, {
          method: 'PUT',
          body: form,
        });
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`worker creation ${name}`, error);
      }
    },
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
        if (!id)
          throw new Error('Cloudflare D1 creation returned no database ID.');
        return { id, name: result.name };
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`D1 creation ${name}`, error);
      }
    },
    async migrateD1(id) {
      try {
        await request(`/accounts/${accountId}/d1/database/${id}/query`, {
          method: 'POST',
          body: JSON.stringify({
            sql: 'CREATE TABLE IF NOT EXISTS web_security_acceptance (run_id TEXT PRIMARY KEY, created_at TEXT NOT NULL)',
          }),
        });
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`D1 migration ${id}`, error);
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
    async verifyWorker(name) {
      try {
        const listing = await listResources();
        if (!listing.workers.includes(name)) {
          throw new Error(`Cloudflare worker was not found: ${name}`);
        }
      } catch (error: unknown) {
        throw cloudflareAcceptanceError(`worker verification ${name}`, error);
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
        'Usage: cloudflare-acceptance.ts <provision|verify|cleanup> --run-id <id> --inventory <path>',
      );
    }
    const client = createCloudflareAcceptanceClient({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
      apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
    });

    if (command === 'provision') {
      const inventory = await provisionCloudflareAcceptance(
        client,
        createCloudflareAcceptanceInventory({ runId }),
      );
      writeJson(inventoryPath, inventory);
      process.stdout.write(`${JSON.stringify(inventory)}\n`);
      return;
    }

    const inventory = existsSync(resolve(inventoryPath))
      ? readInventory(inventoryPath)
      : createCloudflareAcceptanceInventory({ runId });

    if (command === 'verify') {
      assertRunOwnedInventory(inventory);
      if (Date.now() >= Date.parse(inventory.expiresAt)) {
        throw new Error('Cloudflare acceptance inventory has expired.');
      }
      await client.verifyWorker(inventory.names.workerName);
      const listing = await client.listResources();
      if (
        !listing.workers.includes(inventory.names.workerName) ||
        !listing.d1.some(
          (database) => database.name === inventory.names.d1Name,
        ) ||
        !listing.r2Buckets.includes(inventory.names.r2BucketName)
      ) {
        throw new Error('Cloudflare acceptance resources are incomplete.');
      }
      process.stdout.write(
        `${JSON.stringify({ ok: true, runId: inventory.runId })}\n`,
      );
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
