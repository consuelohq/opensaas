import * as fs from 'node:fs';
import { basename } from 'node:path';
import type { Command } from 'commander';
import ora from 'ora';
import { apiGet, apiPost, apiDelete, handleApiError } from '../api-client.js';
import { getErrorCode, handle501 } from '../cli-utils.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

interface FileRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  tags?: string[];
  indexed: boolean;
  collection?: string;
  uploadedAt: string;
  uploadedBy: string;
}

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const inferMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const filesErrorMessage = (data: unknown, ctx: Record<string, string>): string | null => {
  const code = getErrorCode(data);
  if (code === 'FILE_NOT_FOUND') return `file not found: ${ctx.id ?? 'unknown'}`;
  if (code === 'FILE_TOO_LARGE') return 'file too large — max 50 MB';
  if (code === 'UNSUPPORTED_TYPE') return `unsupported file type: ${ctx.ext ?? 'unknown'} — supported: pdf, csv, txt, doc, docx`;
  return null;
};

export const registerFiles = (program: Command): void => {
  const files = program
    .command('files')
    .description('manage files');

  files.command('list').description('list uploaded files')
    .option('--type <type>', 'filter by type (pdf|csv|txt|doc|docx)')
    .option('--limit <n>', 'max results', '50')
    .action(filesList);

  files.command('get <id>').description('get file metadata').action(filesGet);

  files.command('upload <path>').description('upload a file')
    .option('--collection <name>', 'auto-index into collection after upload')
    .option('--tags <tags>', 'comma-separated tags')
    .action(filesUpload);

  files.command('download <id>').description('download a file')
    .option('--output <path>', 'output path (defaults to original filename)')
    .action(filesDownload);

  files.command('delete <id>').description('delete a file').action(filesDelete);
};

const filesList = async (opts: { type?: string; limit: string }): Promise<void> => {
  try {
    const query: Record<string, string> = { limit: opts.limit };
    if (opts.type) query.type = opts.type;

    const res = await apiGet<{ files: FileRecord[] }>('/v1/files', query);
    handle501(res.status, 'files API routes (phase 6)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { files } = res.data;
    if (!files.length) { log('no files'); return; }

    log('id          | filename                    | type | size    | indexed | uploaded');
    log('------------|-----------------------------|------|---------|---------|------------------');
    for (const f of files) {
      const id = f.id.padEnd(11).slice(0, 11);
      const name = f.filename.padEnd(27).slice(0, 27);
      const ext = (f.filename.split('.').pop() ?? '').padEnd(4).slice(0, 4);
      const size = formatSize(f.size).padEnd(7);
      const indexed = f.indexed ? '✓' : ' ';
      log(`${id} | ${name} | ${ext} | ${size} | ${indexed.padEnd(7)} | ${f.uploadedAt}`);
    }
    log(`\n${files.length} file${files.length === 1 ? '' : 's'}`);
  } catch (err: unknown) {
    captureError(err, { command: 'files list' });
    error(err instanceof Error ? err.message : 'failed to list files');
    process.exit(1);
  }
};

const filesGet = async (id: string): Promise<void> => {
  try {
    const res = await apiGet<{ file: FileRecord }>(`/v1/files/${id}`);
    handle501(res.status, 'files API routes (phase 6)');
    if (!res.ok) {
      const msg = filesErrorMessage(res.data, { id });
      if (msg) { error(msg); process.exit(1); }
      handleApiError(res.status, res.data);
    }

    if (isJson()) { json(res.data); return; }

    const f = res.data.file;
    log(`id:         ${f.id}`);
    log(`filename:   ${f.filename}`);
    log(`type:       ${f.contentType}`);
    log(`size:       ${formatSize(f.size)}`);
    if (f.tags?.length) log(`tags:       ${f.tags.join(', ')}`);
    log(`indexed:    ${f.indexed ? `✓ (${f.collection ?? 'unknown'})` : 'no'}`);
    log(`uploaded:   ${f.uploadedAt}`);
    log(`uploaded by: ${f.uploadedBy}`);
  } catch (err: unknown) {
    captureError(err, { command: 'files get' });
    error(err instanceof Error ? err.message : 'failed to get file');
    process.exit(1);
  }
};

const filesUpload = async (filePath: string, opts: { collection?: string; tags?: string }): Promise<void> => {
  try {
    if (!fs.existsSync(filePath)) {
      error(`file not found: ${filePath}`);
      process.exit(1);
    }

    const stat = fs.statSync(filePath);
    const filename = basename(filePath);
    const contentType = inferMimeType(filename);

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (stat.size > MAX_FILE_SIZE) {
      error(`file too large: ${formatSize(stat.size)} — max 50 MB`);
      process.exit(1);
    }

    const tags = opts.tags?.split(',').map((t: string) => t.trim());

    const spinner = ora(`uploading ${filename} (${formatSize(stat.size)})...`).start();

    // step 1: get presigned upload URL
    const initRes = await apiPost<{ fileId: string; uploadUrl: string }>('/v1/files/upload', {
      filename, contentType, size: stat.size, tags,
    });
    handle501(initRes.status, 'files API routes (phase 6)');
    if (!initRes.ok) {
      spinner.fail('upload failed');
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      const msg = filesErrorMessage(initRes.data, { id: filename, ext });
      if (msg) { error(msg); process.exit(1); }
      handleApiError(initRes.status, initRes.data);
    }

    // step 2: PUT to S3
    const fileBuffer = fs.readFileSync(filePath);
    const s3Res = await fetch(initRes.data.uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: { 'Content-Type': contentType },
    });
    if (!s3Res.ok) {
      spinner.fail('upload failed');
      error('upload failed — try again');
      process.exit(1);
    }

    // step 3: confirm upload with API
    const confirmRes = await apiPost(`/v1/files/${initRes.data.fileId}/confirm`);
    if (!confirmRes.ok) {
      spinner.fail('upload failed — file uploaded to storage but could not confirm with API');
      const msg = filesErrorMessage(confirmRes.data, { id: initRes.data.fileId, ext: '' });
      if (msg) { error(msg); process.exit(1); }
      handleApiError(confirmRes.status, confirmRes.data);
    }

    spinner.succeed(`uploaded ${filename} → ${initRes.data.fileId}`);

    if (isJson()) { json({ fileId: initRes.data.fileId }); return; }

    // step 4: auto-index if collection specified
    if (opts.collection) {
      const indexRes = await apiPost<{ indexed: boolean; chunks: number }>(`/v1/files/${initRes.data.fileId}/index`, {
        collection: opts.collection,
      });
      if (indexRes.ok) {
        log(`indexed into ${opts.collection} (${indexRes.data.chunks} chunks)`);
      } else {
        error(`uploaded but indexing failed — run \`consuelo kb index ${initRes.data.fileId} --collection ${opts.collection}\` to retry`);
      }
    }
  } catch (err: unknown) {
    captureError(err, { command: 'files upload' });
    error(err instanceof Error ? err.message : 'upload failed');
    process.exit(1);
  }
};

const filesDownload = async (id: string, opts: { output?: string }): Promise<void> => {
  try {
    // get download URL
    const res = await apiGet<{ downloadUrl: string }>(`/v1/files/${id}/download`);
    handle501(res.status, 'files API routes (phase 6)');
    if (!res.ok) {
      const msg = filesErrorMessage(res.data, { id });
      if (msg) { error(msg); process.exit(1); }
      handleApiError(res.status, res.data);
    }

    // fetch from S3
    const fileRes = await fetch(res.data.downloadUrl);
    if (!fileRes.ok) {
      error('download failed — try again');
      process.exit(1);
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    // determine output path
    const metaRes = await apiGet<{ file: FileRecord }>(`/v1/files/${id}`);
    const filename = metaRes.ok ? metaRes.data.file.filename : id;
    const outputPath = opts.output ?? filename;

    try {
      fs.writeFileSync(outputPath, buffer);
    } catch (err: unknown) {
      captureError(err, { command: 'files download' });
      const detail = err instanceof Error ? `: ${err.message}` : '';
      error(`could not write to ${outputPath}${detail}`);
      process.exit(1);
    }

    if (isJson()) { json({ path: outputPath, size: buffer.length }); return; }

    log(`downloaded ${filename} → ${outputPath} (${formatSize(buffer.length)})`);
  } catch (err: unknown) {
    captureError(err, { command: 'files download' });
    error(err instanceof Error ? err.message : 'download failed');
    process.exit(1);
  }
};

const filesDelete = async (id: string): Promise<void> => {
  try {
    const res = await apiDelete<{ deleted: boolean }>(`/v1/files/${id}`);
    handle501(res.status, 'files API routes (phase 6)');
    if (!res.ok) {
      const msg = filesErrorMessage(res.data, { id });
      if (msg) { error(msg); process.exit(1); }
      handleApiError(res.status, res.data);
    }

    if (isJson()) { json(res.data); return; }

    log(`file deleted: ${id}`);
  } catch (err: unknown) {
    captureError(err, { command: 'files delete' });
    error(err instanceof Error ? err.message : 'failed to delete file');
    process.exit(1);
  }
};
