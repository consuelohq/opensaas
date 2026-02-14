#!/usr/bin/env npx tsx
// seed-knowledge.ts — manifest-driven knowledge base seeding (DEV-797)
// Usage: npx tsx scripts/seed-knowledge.ts --workspace <id> [--vertical <name>] [--dry-run] [--force]

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// -- types -------------------------------------------------------------------

interface ManifestFile {
  path: string;
  metadata: Record<string, string>;
}

interface ManifestCollection {
  name: string;
  description: string;
  strategy: {
    maxTokens: number;
    overlap: number;
    splitOn: 'sentence' | 'paragraph' | 'page';
    preserveHeaders: boolean;
    preserveTables: boolean;
  };
  files: ManifestFile[];
}

interface Manifest {
  vertical: string;
  description: string;
  collections: ManifestCollection[];
}

// -- arg parsing -------------------------------------------------------------

function parseArgs(): { workspaceId: string; vertical?: string; dryRun: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let workspaceId = '';
  let vertical: string | undefined;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workspace' && args[i + 1]) {
      workspaceId = args[++i];
    } else if (args[i] === '--vertical' && args[i + 1]) {
      vertical = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  if (!workspaceId) {
    process.stderr.write('error: --workspace <id> is required\n');
    process.exit(1);
  }

  return { workspaceId, vertical, dryRun, force };
}

// -- manifest discovery ------------------------------------------------------

function discoverManifests(seedDir: string, verticalFilter?: string): Array<{ dir: string; manifest: Manifest }> {
  const results: Array<{ dir: string; manifest: Manifest }> = [];

  let entries: string[];
  try {
    entries = readdirSync(seedDir);
  } catch {
    process.stderr.write('error: seed directory not found: ' + seedDir + '\n');
    process.exit(1);
  }

  for (const entry of entries) {
    const dir = join(seedDir, entry);
    if (!statSync(dir).isDirectory()) continue;

    const manifestPath = join(dir, 'manifest.json');
    try {
      const raw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as Manifest;
      if (verticalFilter && manifest.vertical !== verticalFilter) continue;
      results.push({ dir, manifest });
    } catch {
      // no manifest.json in this dir — skip
    }
  }

  return results;
}

// -- main --------------------------------------------------------------------

async function main(): Promise<void> {
  const { workspaceId, vertical, dryRun, force } = parseArgs();
  const seedDir = resolve(import.meta.dirname ?? '.', '..', 'packages', 'api', 'fixtures', 'seed');
  const manifests = discoverManifests(seedDir, vertical);

  if (manifests.length === 0) {
    process.stderr.write('no manifests found' + (vertical ? ' for vertical "' + vertical + '"' : '') + '\n');
    process.exit(0);
  }

  process.stderr.write('found ' + String(manifests.length) + ' manifest(s)\n');

  if (dryRun) {
    for (const { manifest } of manifests) {
      process.stderr.write('\n[dry-run] vertical: ' + manifest.vertical + '\n');
      for (const col of manifest.collections) {
        process.stderr.write('  collection: ' + col.name + ' (' + String(col.files.length) + ' files)\n');
        for (const f of col.files) {
          process.stderr.write('    - ' + f.path + '\n');
        }
      }
    }
    process.exit(0);
  }

  // lazy imports — pg, openai, pdf-parse are peer deps
  const { KnowledgeService } = await import('../packages/api/src/services/knowledge.js');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: process.env.KNOWLEDGE_DATABASE_URL ?? process.env.DATABASE_URL,
    max: 3,
  });

  const knowledge = new KnowledgeService();
  let totalChunks = 0;

  try {
    for (const { dir, manifest } of manifests) {
      process.stderr.write('\nseeding vertical: ' + manifest.vertical + '\n');

      for (const col of manifest.collections) {
        // check if collection exists
        const existing = await knowledge.listCollections(workspaceId);
        const found = existing.find((c) => c.name === col.name);

        if (found && !force) {
          process.stderr.write('  skip: collection "' + col.name + '" exists (use --force to re-seed)\n');
          continue;
        }

        if (found && force) {
          process.stderr.write('  force: deleting existing collection "' + col.name + '"\n');
          await knowledge.deleteCollection(found.id, workspaceId);
        }

        const collection = await knowledge.createCollection(workspaceId, col.name, col.description);
        process.stderr.write('  created collection: ' + col.name + ' (' + collection.id + ')\n');

        for (const file of col.files) {
          const filePath = join(dir, file.path);
          const buffer = readFileSync(filePath);
          const mimeType = file.path.endsWith('.pdf') ? 'application/pdf' : 'text/plain';

          // create file record
          const fileResult = await pool.query(
            'INSERT INTO files (workspace_id, name, mime_type, size, storage_key, folder, tags) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [workspaceId, file.path, mimeType, buffer.length, 'seed/' + col.name + '/' + file.path, 'seed', ['seed', manifest.vertical]],
          );
          const fileId = fileResult.rows[0].id as string;

          // extract + index
          const extracted = await knowledge.extractText(buffer, mimeType);
          const { chunkCount } = await knowledge.indexFile(fileId, collection.id, extracted.text, {
            strategy: col.strategy,
            metadata: file.metadata,
            sourceName: file.path,
          });

          totalChunks += chunkCount;
          process.stderr.write('    indexed: ' + file.path + ' (' + String(chunkCount) + ' chunks)\n');
        }
      }
    }

    process.stderr.write('\ndone. total chunks indexed: ' + String(totalChunks) + '\n');
  } finally {
    await knowledge.destroy();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  process.stderr.write('fatal: ' + (err instanceof Error ? err.message : String(err)) + '\n');
  process.exit(1);
});
