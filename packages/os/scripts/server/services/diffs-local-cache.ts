import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SNAPSHOT_SCHEMA_VERSION = 1;

type CacheSource = 'memory' | 'disk' | 'fresh';

type StoredDiffsSnapshot = {
  schemaVersion: number;
  key: string;
  body: string;
  etag: string;
  writtenAt: number;
  expiresAt: number;
};

export type DiffsCacheSnapshot<T> = {
  value: T;
  etag: string;
  writtenAt: number;
  expiresAt: number;
  source: CacheSource;
};

type DiffsLocalCacheOptions = {
  root: string;
  maxEntries: number;
  now?: () => number;
};

export class DiffsLocalCache {
  private readonly root: string;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly memory = new Map<string, StoredDiffsSnapshot>();
  private readonly inFlight = new Map<string, Promise<StoredDiffsSnapshot>>();

  constructor(options: DiffsLocalCacheOptions) {
    this.root = options.root;
    this.maxEntries = Math.max(1, options.maxEntries);
    this.now = options.now ?? Date.now;
  }

  peek<T>(key: string): DiffsCacheSnapshot<T> | null {
    const memory = this.memory.get(key);
    if (memory) return decodeSnapshot<T>(memory, 'memory');

    const disk = this.readDiskSnapshot(key);
    if (!disk) return null;
    this.remember(disk);
    return decodeSnapshot<T>(disk, 'disk');
  }

  getFresh<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<DiffsCacheSnapshot<T>> {
    const existing = this.peek<T>(key);
    if (existing && existing.expiresAt > this.now()) return Promise.resolve(existing);

    const active = this.inFlight.get(key);
    if (active) return active.then((snapshot) => decodeSnapshot<T>(snapshot, 'fresh'));

    const refresh = loader()
      .then((value) => this.writeSnapshot(key, value, ttlMs))
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, refresh);
    return refresh.then((snapshot) => decodeSnapshot<T>(snapshot, 'fresh'));
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
    if (!fs.existsSync(this.root)) return;
    for (const fileName of fs.readdirSync(this.root)) {
      if (!fileName.endsWith('.json')) continue;
      const filePath = path.join(this.root, fileName);
      const snapshot = this.readSnapshotFile(filePath);
      if (snapshot?.key.startsWith(prefix)) fs.rmSync(filePath, { force: true });
    }
  }

  clear(): void {
    this.memory.clear();
    this.inFlight.clear();
  }

  private writeSnapshot<T>(key: string, value: T, ttlMs: number): StoredDiffsSnapshot {
    const writtenAt = this.now();
    const body = JSON.stringify(value);
    const snapshot: StoredDiffsSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      key,
      body,
      etag: weakEtag(body),
      writtenAt,
      expiresAt: writtenAt + Math.max(0, ttlMs),
    };

    this.remember(snapshot);
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const target = this.snapshotPath(key);
    const temporary = `${target}.tmp-${process.pid}-${writtenAt}`;
    fs.writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, target);
    this.pruneDisk();
    return snapshot;
  }

  private remember(snapshot: StoredDiffsSnapshot): void {
    this.memory.delete(snapshot.key);
    this.memory.set(snapshot.key, snapshot);
    while (this.memory.size > this.maxEntries) {
      const oldestKey = this.memory.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.memory.delete(oldestKey);
    }
  }

  private readDiskSnapshot(key: string): StoredDiffsSnapshot | null {
    return this.readSnapshotFile(this.snapshotPath(key), key);
  }

  private readSnapshotFile(filePath: string, expectedKey?: string): StoredDiffsSnapshot | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<StoredDiffsSnapshot>;
      if (
        parsed.schemaVersion !== SNAPSHOT_SCHEMA_VERSION
        || typeof parsed.key !== 'string'
        || typeof parsed.body !== 'string'
        || typeof parsed.etag !== 'string'
        || typeof parsed.writtenAt !== 'number'
        || typeof parsed.expiresAt !== 'number'
        || (expectedKey !== undefined && parsed.key !== expectedKey)
      ) {
        return null;
      }
      JSON.parse(parsed.body);
      return parsed as StoredDiffsSnapshot;
    } catch {
      return null;
    }
  }

  private snapshotPath(key: string): string {
    const digest = createHash('sha256').update(key).digest('hex');
    return path.join(this.root, `${digest}.json`);
  }

  private pruneDisk(): void {
    let entries: Array<{ path: string; mtimeMs: number }> = [];
    try {
      entries = fs.readdirSync(this.root)
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => {
          const filePath = path.join(this.root, fileName);
          return { path: filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
        })
        .sort((left, right) => left.mtimeMs - right.mtimeMs);
    } catch {
      return;
    }
    while (entries.length > this.maxEntries) {
      const oldest = entries.shift();
      if (oldest) fs.rmSync(oldest.path, { force: true });
    }
  }
}

function decodeSnapshot<T>(snapshot: StoredDiffsSnapshot, source: CacheSource): DiffsCacheSnapshot<T> {
  return {
    value: JSON.parse(snapshot.body) as T,
    etag: snapshot.etag,
    writtenAt: snapshot.writtenAt,
    expiresAt: snapshot.expiresAt,
    source,
  };
}

function weakEtag(body: string): string {
  const digest = createHash('sha256').update(body).digest('base64url').slice(0, 24);
  return `W/\"${digest}\"`;
}
