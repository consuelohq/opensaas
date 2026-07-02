import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ensureRuntimePaths, getRuntimePaths } from './runtime-state';

export type ProcessTelemetrySample = {
  tsEpochMs: number;
  pid: number;
  ppid: number | null;
  command: string;
  cpuPercent: number;
  memPercent: number;
  rssBytes: number;
  cpuSeconds: number | null;
  elapsedSeconds: number | null;
  sampleReason: string;
};

export type ProcessIdentity = {
  identityId: string;
  normalizedName: string;
  executablePath: string | null;
  bundleId: string | null;
  family: string;
  role: string;
  tags: string[];
};

export type ProcessTelemetryHotProcess = {
  identityId: string;
  name: string;
  family: string;
  role: string;
  tags: string[];
  sampleCount: number;
  avgCpuPercent: number;
  maxCpuPercent: number;
  avgRssMiB: number;
  maxRssMiB: number;
  lastPid: number;
  lastSeenAt: string;
  sampleReasons: string[];
};

export type ProcessTelemetryPacket = {
  ok: true;
  dbPath: string;
  generatedAt: string;
  window: {
    since: string;
    sinceEpochMs: number;
    untilEpochMs: number;
    sampleCount: number;
    processCount: number;
  };
  summary: {
    answer: string;
    topFamily: string | null;
    topProcess: string | null;
    consueloAvgCpuPercent: number;
    consueloMaxCpuPercent: number;
    consueloSampleCount: number;
    hotProcessCount: number;
    unknownHotspotCount: number;
    systemHotspotCount: number;
    appHotspotCount: number;
  };
  families: Array<{
    family: string;
    processCount: number;
    sampleCount: number;
    avgCpuPercent: number;
    maxCpuPercent: number;
    avgRssMiB: number;
    maxRssMiB: number;
  }>;
  hotProcesses: ProcessTelemetryHotProcess[];
  consueloProcesses: ProcessTelemetryHotProcess[];
  notableProcesses: ProcessTelemetryHotProcess[];
  guidance: string[];
};

export type ProcessTelemetryReportOptions = {
  dbPath?: string;
  since?: string;
  limit?: number;
  nowMs?: number;
};

export type ProcessTelemetrySampleOptions = {
  dbPath?: string;
  nowMs?: number;
  minCpuPercent?: number;
  minRssBytes?: number;
  includeAll?: boolean;
};

type PsRow = {
  pid: number;
  ppid: number | null;
  cpuPercent: number;
  memPercent: number;
  rssBytes: number;
  elapsedSeconds: number | null;
  cpuSeconds: number | null;
  command: string;
};

type AggregateRow = {
  identity_id: string;
  normalized_name: string;
  family: string;
  role: string;
  tags_json: string | null;
  samples: number;
  avg_cpu: number;
  max_cpu: number;
  avg_rss: number;
  max_rss: number;
  last_pid: number;
  last_seen_ms: number;
  sample_reasons: string | null;
};

type FamilyRow = {
  family: string;
  process_count: number;
  samples: number;
  avg_cpu: number;
  max_cpu: number;
  avg_rss: number;
  max_rss: number;
};

const DEFAULT_SINCE = '1h';
const DEFAULT_LIMIT = 30;
const DEFAULT_MIN_CPU_PERCENT = 0.5;
const DEFAULT_MIN_RSS_BYTES = 100 * 1024 * 1024;

function nowIso(ms: number): string {
  return new Date(ms).toISOString();
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function parseProcessWindow(value: string | undefined): number {
  const raw = value ?? DEFAULT_SINCE;
  const match = /^(\d+)(m|h|d)$/.exec(raw.trim());
  if (!match) throw new Error('expected window like 5m, 1h, 24h, or 7d');
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('window amount must be positive');
  const unit = match[2];
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

function parseElapsed(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let days = 0;
  let rest = trimmed;
  if (rest.includes('-')) {
    const [rawDays, rawRest] = rest.split('-', 2);
    days = Number(rawDays);
    rest = rawRest ?? '';
  }
  const parts = rest.split(':').map((part) => Number(part.split('.')[0]));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return days * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return days * 86400 + parts[0] * 60 + parts[1];
  if (parts.length === 1) return days * 86400 + parts[0];
  return null;
}

function parsePsOutput(text: string): PsRow[] {
  const rows: PsRow[] = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) continue;
    const [pid, ppid, cpu, mem, rssKb, elapsed] = parts;
    const command = parts.slice(6).join(' ');
    const parsedPid = Number(pid);
    const parsedCpu = Number(cpu);
    const parsedMem = Number(mem);
    const parsedRss = Number(rssKb);
    if (!Number.isFinite(parsedPid) || !Number.isFinite(parsedCpu) || !Number.isFinite(parsedMem) || !Number.isFinite(parsedRss)) continue;
    rows.push({
      pid: parsedPid,
      ppid: Number.isFinite(Number(ppid)) ? Number(ppid) : null,
      cpuPercent: parsedCpu,
      memPercent: parsedMem,
      rssBytes: parsedRss * 1024,
      elapsedSeconds: parseElapsed(elapsed),
      cpuSeconds: null,
      command,
    });
  }
  return rows;
}

function extractAppName(command: string): string | null {
  const match = command.match(/\/Applications\/([^/]+)\.app\//);
  if (!match) return null;
  return match[1].replace(/ Helper( \([^)]+\))?$/, '').trim();
}

function executableFromCommand(command: string): string | null {
  const first = command.split(/\s+/, 1)[0];
  return first?.startsWith('/') ? first : null;
}

function inferRole(command: string): string {
  if (/renderer/i.test(command)) return 'renderer';
  if (/gpu-process|\(GPU\)/i.test(command)) return 'gpu-process';
  if (/network\.mojom\.NetworkService|network/i.test(command)) return 'network-service';
  if (/storage\.mojom\.StorageService|storage/i.test(command)) return 'storage-service';
  if (/server\.py|server\.ts|serve\b|app-server/i.test(command)) return 'server';
  if (/watch|watchdog/i.test(command)) return 'watcher';
  if (/index|embedding|semantic/i.test(command)) return 'indexer';
  if (/worker/i.test(command)) return 'worker';
  return 'process';
}

export function classifyProcess(command: string): ProcessIdentity {
  const executablePath = executableFromCommand(command);
  const appName = extractAppName(command);
  const lower = command.toLowerCase();
  let normalizedName = executablePath ? path.basename(executablePath) : command.split(/\s+/, 1)[0] || 'unknown';
  let family = 'unknown';
  let role = inferRole(command);
  const tags = new Set<string>();

  if (lower.includes('/.consuelo/os/') || lower.includes('/packages/os/')) {
    normalizedName = 'Consuelo OS';
    family = 'consuelo';
    tags.add('consuelo');
    tags.add('os');
  } else if (lower.includes('/packages/workspace/') || lower.includes('/dev/opensaas/packages/workspace/')) {
    normalizedName = 'Consuelo Workspace';
    family = 'consuelo';
    tags.add('consuelo');
    tags.add('workspace');
  } else if (appName) {
    normalizedName = appName;
    family = 'app';
    tags.add('app');
    if (/renderer|gpu-process|network\.mojom|storage\.mojom/i.test(command)) tags.add('browser-process');
  } else if (lower.includes('/system/library/') || lower.includes('/usr/libexec/') || lower.includes('/usr/sbin/')) {
    normalizedName = executablePath ? path.basename(executablePath) : normalizedName;
    family = 'macos';
    tags.add('system');
  } else if (/\b(bun|node|python|ruby|java|go)\b/i.test(command)) {
    family = 'runtime';
    tags.add('runtime');
    if (lower.includes('opencode')) {
      normalizedName = 'OpenCode';
      tags.add('agent');
    } else if (lower.includes('codex')) {
      normalizedName = 'Codex';
      tags.add('agent');
    }
  }

  if (lower.includes('windowserver')) {
    normalizedName = 'WindowServer';
    family = 'macos';
    role = 'display-server';
    tags.add('system');
    tags.add('display');
  }
  if (lower.includes('duetexpertd')) {
    normalizedName = 'duetexpertd';
    family = 'macos';
    role = 'background-intelligence';
    tags.add('system');
    tags.add('background');
  }

  const identityBasis = `${family}:${normalizedName}:${role}:${executablePath ?? ''}`;
  return {
    identityId: stableHash(identityBasis),
    normalizedName,
    executablePath,
    bundleId: null,
    family,
    role,
    tags: [...tags].sort(),
  };
}

function sampleReason(row: PsRow, options: Required<Pick<ProcessTelemetrySampleOptions, 'minCpuPercent' | 'minRssBytes' | 'includeAll'>>, identity: ProcessIdentity): string | null {
  if (options.includeAll) return 'include-all';
  if (identity.tags.includes('consuelo')) return 'consuelo';
  if (row.cpuPercent >= options.minCpuPercent) return 'cpu-threshold';
  if (row.rssBytes >= options.minRssBytes) return 'rss-threshold';
  return null;
}

export function ensureProcessTelemetrySchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_identities (
      identity_id TEXT PRIMARY KEY,
      normalized_name TEXT NOT NULL,
      executable_path TEXT,
      bundle_id TEXT,
      family TEXT NOT NULL DEFAULT 'unknown',
      role TEXT NOT NULL DEFAULT 'process',
      tags_json TEXT NOT NULL DEFAULT '[]',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS process_commands (
      command_hash TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS process_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts_epoch_ms INTEGER NOT NULL,
      identity_id TEXT NOT NULL,
      pid INTEGER NOT NULL,
      ppid INTEGER,
      command_hash TEXT NOT NULL,
      cpu_percent REAL NOT NULL,
      mem_percent REAL NOT NULL,
      rss_bytes INTEGER NOT NULL,
      cpu_seconds REAL,
      elapsed_seconds INTEGER,
      sample_reason TEXT NOT NULL,
      FOREIGN KEY(identity_id) REFERENCES process_identities(identity_id),
      FOREIGN KEY(command_hash) REFERENCES process_commands(command_hash)
    );

    CREATE INDEX IF NOT EXISTS process_samples_ts_idx
      ON process_samples(ts_epoch_ms);

    CREATE INDEX IF NOT EXISTS process_samples_identity_ts_idx
      ON process_samples(identity_id, ts_epoch_ms);

    CREATE TABLE IF NOT EXISTS process_metric_rollups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      window_start_epoch_ms INTEGER NOT NULL,
      window_seconds INTEGER NOT NULL,
      identity_id TEXT NOT NULL,
      sample_count INTEGER NOT NULL,
      avg_cpu_percent REAL NOT NULL,
      max_cpu_percent REAL NOT NULL,
      avg_rss_bytes INTEGER NOT NULL,
      max_rss_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(window_start_epoch_ms, window_seconds, identity_id)
    );
  `);
}

function openTelemetryDb(dbPath?: string): Database {
  ensureRuntimePaths();
  const resolved = dbPath ?? getRuntimePaths().dbPath;
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved, { create: true });
  ensureProcessTelemetrySchema(db);
  return db;
}

export function recordProcessTelemetrySamples(samples: ProcessTelemetrySample[], options: { dbPath?: string } = {}): number {
  const db = openTelemetryDb(options.dbPath);
  try {
    const upsertIdentity = db.prepare(`
      INSERT INTO process_identities(identity_id, normalized_name, executable_path, bundle_id, family, role, tags_json, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(identity_id) DO UPDATE SET
        normalized_name = excluded.normalized_name,
        executable_path = excluded.executable_path,
        bundle_id = excluded.bundle_id,
        family = excluded.family,
        role = excluded.role,
        tags_json = excluded.tags_json,
        last_seen_at = excluded.last_seen_at
    `);
    const upsertCommand = db.prepare(`
      INSERT INTO process_commands(command_hash, command, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(command_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at
    `);
    const insertSample = db.prepare(`
      INSERT INTO process_samples(ts_epoch_ms, identity_id, pid, ppid, command_hash, cpu_percent, mem_percent, rss_bytes, cpu_seconds, elapsed_seconds, sample_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rows: ProcessTelemetrySample[]) => {
      for (const sample of rows) {
        const identity = classifyProcess(sample.command);
        const commandHash = stableHash(sample.command);
        const timestamp = nowIso(sample.tsEpochMs);
        upsertIdentity.run(identity.identityId, identity.normalizedName, identity.executablePath, identity.bundleId, identity.family, identity.role, JSON.stringify(identity.tags), timestamp, timestamp);
        upsertCommand.run(commandHash, sample.command, timestamp, timestamp);
        insertSample.run(sample.tsEpochMs, identity.identityId, sample.pid, sample.ppid, commandHash, sample.cpuPercent, sample.memPercent, sample.rssBytes, sample.cpuSeconds, sample.elapsedSeconds, sample.sampleReason);
      }
    });
    tx(samples);
    return samples.length;
  } finally {
    db.close();
  }
}

export function sampleProcessTelemetry(options: ProcessTelemetrySampleOptions = {}): ProcessTelemetrySample[] {
  const proc = Bun.spawnSync(['ps', 'axo', 'pid=,ppid=,pcpu=,pmem=,rss=,etime=,command='], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr).trim() || 'ps failed');
  }
  const tsEpochMs = options.nowMs ?? Date.now();
  const minCpuPercent = options.minCpuPercent ?? DEFAULT_MIN_CPU_PERCENT;
  const minRssBytes = options.minRssBytes ?? DEFAULT_MIN_RSS_BYTES;
  const includeAll = options.includeAll ?? false;
  const rows = parsePsOutput(new TextDecoder().decode(proc.stdout));
  const samples: ProcessTelemetrySample[] = [];
  for (const row of rows) {
    const identity = classifyProcess(row.command);
    const reason = sampleReason(row, { minCpuPercent, minRssBytes, includeAll }, identity);
    if (!reason) continue;
    samples.push({
      tsEpochMs,
      pid: row.pid,
      ppid: row.ppid,
      command: row.command,
      cpuPercent: row.cpuPercent,
      memPercent: row.memPercent,
      rssBytes: row.rssBytes,
      cpuSeconds: row.cpuSeconds,
      elapsedSeconds: row.elapsedSeconds,
      sampleReason: reason,
    });
  }
  return samples;
}

export function sampleAndStoreProcessTelemetry(options: ProcessTelemetrySampleOptions = {}): { stored: number; samples: ProcessTelemetrySample[] } {
  const samples = sampleProcessTelemetry(options);
  const stored = recordProcessTelemetrySamples(samples, { dbPath: options.dbPath });
  return { stored, samples };
}

function readTags(row: AggregateRow): string[] {
  if (!row.tags_json) return [];
  try {
    const value = JSON.parse(row.tags_json) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toHotProcess(row: AggregateRow): ProcessTelemetryHotProcess {
  return {
    identityId: row.identity_id,
    name: row.normalized_name,
    family: row.family,
    role: row.role,
    tags: readTags(row),
    sampleCount: Number(row.samples),
    avgCpuPercent: Number(row.avg_cpu.toFixed(2)),
    maxCpuPercent: Number(row.max_cpu.toFixed(2)),
    avgRssMiB: Number((row.avg_rss / 1024 / 1024).toFixed(1)),
    maxRssMiB: Number((row.max_rss / 1024 / 1024).toFixed(1)),
    lastPid: Number(row.last_pid),
    lastSeenAt: nowIso(Number(row.last_seen_ms)),
    sampleReasons: row.sample_reasons ? row.sample_reasons.split(',').filter(Boolean).sort() : [],
  };
}

function buildAnswer(args: { topProcess: ProcessTelemetryHotProcess | null; consueloAvgCpu: number; consueloMaxCpu: number; consueloSampleCount: number; windowSampleCount: number }): string {
  if (!args.topProcess) return 'No process telemetry samples were found for this window.';
  const enoughConsueloEvidence = args.consueloSampleCount >= 3 || (args.windowSampleCount > 0 && args.consueloSampleCount / args.windowSampleCount >= 0.2);
  const consueloHot = enoughConsueloEvidence && (args.consueloMaxCpu >= 10 || args.consueloAvgCpu >= 5);
  if (consueloHot) {
    return `Consuelo was a meaningful CPU contributor in this window. Top process was ${args.topProcess.name} (${args.topProcess.family}) with max ${args.topProcess.maxCpuPercent}% CPU; Consuelo max was ${args.consueloMaxCpu.toFixed(2)}%.`;
  }
  if (args.consueloSampleCount > 0 && args.consueloMaxCpu >= 10) {
    return `Consuelo had a brief sampled CPU spike, but there is not enough evidence that it drove the whole window. Top process was ${args.topProcess.name} (${args.topProcess.family}) with max ${args.topProcess.maxCpuPercent}% CPU; Consuelo max was ${args.consueloMaxCpu.toFixed(2)}%.`;
  }
  return `Consuelo was not the primary heat source. Top process was ${args.topProcess.name} (${args.topProcess.family}) with max ${args.topProcess.maxCpuPercent}% CPU; Consuelo max was ${args.consueloMaxCpu.toFixed(2)}%.`;
}


export function pruneProcessTelemetry(options: { dbPath?: string; retentionMs: number; nowMs?: number }): number {
  const db = openTelemetryDb(options.dbPath);
  try {
    const cutoff = (options.nowMs ?? Date.now()) - options.retentionMs;
    const before = db.query('SELECT changes() AS changes').get() as { changes: number };
    void before;
    db.query('DELETE FROM process_samples WHERE ts_epoch_ms < ?').run(cutoff);
    const row = db.query('SELECT changes() AS changes').get() as { changes: number };
    return Number(row.changes ?? 0);
  } finally {
    db.close();
  }
}

export function buildProcessTelemetryPacket(options: ProcessTelemetryReportOptions = {}): ProcessTelemetryPacket {
  const since = options.since ?? DEFAULT_SINCE;
  const windowMs = parseProcessWindow(since);
  const untilEpochMs = options.nowMs ?? Date.now();
  const sinceEpochMs = untilEpochMs - windowMs;
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 100));
  const dbPath = options.dbPath ?? getRuntimePaths().dbPath;
  const db = openTelemetryDb(dbPath);
  try {
    const aggregateRows = db.query([
      'SELECT',
      '  i.identity_id,',
      '  i.normalized_name,',
      '  i.family,',
      '  i.role,',
      '  i.tags_json,',
      '  count(*) AS samples,',
      '  avg(s.cpu_percent) AS avg_cpu,',
      '  max(s.cpu_percent) AS max_cpu,',
      '  avg(s.rss_bytes) AS avg_rss,',
      '  max(s.rss_bytes) AS max_rss,',
      '  (SELECT s2.pid FROM process_samples s2 WHERE s2.identity_id = i.identity_id AND s2.ts_epoch_ms >= ? ORDER BY s2.ts_epoch_ms DESC, s2.id DESC LIMIT 1) AS last_pid,',
      '  max(s.ts_epoch_ms) AS last_seen_ms,',
      '  group_concat(DISTINCT s.sample_reason) AS sample_reasons',
      'FROM process_samples s',
      'JOIN process_identities i ON i.identity_id = s.identity_id',
      'WHERE s.ts_epoch_ms >= ? AND s.ts_epoch_ms <= ?',
      'GROUP BY i.identity_id',
      'ORDER BY max_cpu DESC, avg_cpu DESC, max_rss DESC',
      'LIMIT ?',
    ].join(' ')).all(sinceEpochMs, sinceEpochMs, untilEpochMs, limit) as AggregateRow[];

    const familyRows = db.query([
      'SELECT',
      '  i.family AS family,',
      '  count(DISTINCT i.identity_id) AS process_count,',
      '  count(*) AS samples,',
      '  avg(s.cpu_percent) AS avg_cpu,',
      '  max(s.cpu_percent) AS max_cpu,',
      '  avg(s.rss_bytes) AS avg_rss,',
      '  max(s.rss_bytes) AS max_rss',
      'FROM process_samples s',
      'JOIN process_identities i ON i.identity_id = s.identity_id',
      'WHERE s.ts_epoch_ms >= ? AND s.ts_epoch_ms <= ?',
      'GROUP BY i.family',
      'ORDER BY max_cpu DESC, avg_cpu DESC',
    ].join(' ')).all(sinceEpochMs, untilEpochMs) as FamilyRow[];

    const countRow = db.query([
      'SELECT count(*) AS sample_count, count(DISTINCT identity_id) AS process_count',
      'FROM process_samples',
      'WHERE ts_epoch_ms >= ? AND ts_epoch_ms <= ?',
    ].join(' ')).get(sinceEpochMs, untilEpochMs) as { sample_count: number; process_count: number };

    const hotProcesses = aggregateRows.map(toHotProcess);
    const consueloProcesses = hotProcesses.filter((row) => row.tags.includes('consuelo') || row.family === 'consuelo');
    const notableProcesses = hotProcesses.filter((row) => row.family !== 'consuelo').slice(0, Math.min(20, limit));
    const consueloAvgCpu = consueloProcesses.reduce((sum, row) => sum + row.avgCpuPercent, 0);
    const consueloMaxCpu = consueloProcesses.reduce((max, row) => Math.max(max, row.maxCpuPercent), 0);
    const topProcess = hotProcesses[0] ?? null;
    const topFamily = familyRows[0]?.family ?? null;
    const consueloSampleCount = consueloProcesses.reduce((sum, row) => sum + row.sampleCount, 0);
    const answer = buildAnswer({
      topProcess,
      consueloAvgCpu,
      consueloMaxCpu,
      consueloSampleCount,
      windowSampleCount: Number(countRow.sample_count ?? 0),
    });

    return {
      ok: true,
      dbPath,
      generatedAt: nowIso(untilEpochMs),
      window: {
        since,
        sinceEpochMs,
        untilEpochMs,
        sampleCount: Number(countRow.sample_count ?? 0),
        processCount: Number(countRow.process_count ?? 0),
      },
      summary: {
        answer,
        topFamily,
        topProcess: topProcess?.name ?? null,
        consueloAvgCpuPercent: Number(consueloAvgCpu.toFixed(2)),
        consueloMaxCpuPercent: Number(consueloMaxCpu.toFixed(2)),
        consueloSampleCount,
        hotProcessCount: hotProcesses.length,
        unknownHotspotCount: hotProcesses.filter((row) => row.family === 'unknown').length,
        systemHotspotCount: hotProcesses.filter((row) => row.family === 'macos').length,
        appHotspotCount: hotProcesses.filter((row) => row.family === 'app').length,
      },
      families: familyRows.map((row) => ({
        family: row.family,
        processCount: Number(row.process_count),
        sampleCount: Number(row.samples),
        avgCpuPercent: Number(row.avg_cpu.toFixed(2)),
        maxCpuPercent: Number(row.max_cpu.toFixed(2)),
        avgRssMiB: Number((row.avg_rss / 1024 / 1024).toFixed(1)),
        maxRssMiB: Number((row.max_rss / 1024 / 1024).toFixed(1)),
      })),
      hotProcesses,
      consueloProcesses,
      notableProcesses,
      guidance: [
        'Use hotProcesses for the broad picture, not raw process dumps.',
        'Use consueloProcesses to decide whether Consuelo OS caused the heat.',
        'Unknown hotspots should be inspected before adding permanent classifiers.',
        'Cache and disk growth should be correlated separately through runtime_assets/cache telemetry.',
      ],
    };
  } finally {
    db.close();
  }
}

export function renderProcessTelemetryPacket(packet: ProcessTelemetryPacket): string {
  const lines = [
    `OS process health packet (${packet.window.since})`,
    packet.summary.answer,
    '',
    `samples: ${packet.window.sampleCount} across ${packet.window.processCount} process groups`,
    `top family: ${packet.summary.topFamily ?? 'none'}`,
    `consuelo avg/max CPU: ${packet.summary.consueloAvgCpuPercent}% / ${packet.summary.consueloMaxCpuPercent}%`,
    '',
    'hot processes:',
  ];
  for (const row of packet.hotProcesses.slice(0, 20)) {
    lines.push(`  ${row.maxCpuPercent.toFixed(2).padStart(7)} max  ${row.avgCpuPercent.toFixed(2).padStart(7)} avg  ${String(row.maxRssMiB).padStart(7)} MiB  ${row.family}/${row.role}  ${row.name}`);
  }
  if (packet.consueloProcesses.length) {
    lines.push('', 'consuelo processes:');
    for (const row of packet.consueloProcesses) {
      lines.push(`  ${row.maxCpuPercent.toFixed(2).padStart(7)} max  ${row.avgCpuPercent.toFixed(2).padStart(7)} avg  ${row.family}/${row.role}  ${row.name}`);
    }
  }
  lines.push('', 'guidance:');
  for (const item of packet.guidance) lines.push(`  - ${item}`);
  return `${lines.join('\n')}\n`;
}
