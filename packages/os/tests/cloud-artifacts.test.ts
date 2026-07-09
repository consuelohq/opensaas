import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publishArtifactToAppFile } from '../scripts/lib/cloud-artifacts';
import type { ArtifactDescriptor } from '../scripts/lib/types';

const artifact: ArtifactDescriptor = {
  id: 'art_test',
  name: 'daily-revenue-brief.json',
  title: 'Daily Revenue Brief',
  type: 'brief',
  format: 'json',
  status: 'draft',
  storageMode: 'local',
  path: 'artifacts/trc_test/daily-revenue-brief.json',
  localPath: '/tmp/daily-revenue-brief.json',
  traceId: 'trc_test',
  skillName: 'daily-revenue-brief',
  createdAt: '2026-05-24T00:00:00.000Z',
};

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    CONSUELO_APP_API_URL: 'https://app.example',
    CONSUELO_APP_API_KEY: 'app-key',
    CONSUELO_APP_URL: 'https://consuelo.example',
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

type FetchCall = { url: string; init: RequestInit };

function mockFetch(handler: (call: FetchCall, index: number) => Response): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return handler(call, calls.length - 1);
  });
  return calls;
}

describe('publishArtifactToAppFile', () => {
  it('fails safely when app files capability is missing', async () => {
    delete process.env.CONSUELO_APP_API_URL;
    delete process.env.CONSUELO_APP_API_KEY;

    const result = await publishArtifactToAppFile({ artifact, content: '{}' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'MISSING_APP_FILES_CAPABILITY' });
    expect(result.artifact).toBe(artifact);
  });

  it('fails before network for unsupported attachment target', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await publishArtifactToAppFile({
      artifact,
      content: '{}',
      attachmentTarget: { entityType: 'task', entityId: 'task-1' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'UNSUPPORTED_ATTACHMENT_TARGET' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails safely when upload URL request fails', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: { message: 'storage down' } }), { status: 500 }));

    const result = await publishArtifactToAppFile({ artifact, content: '{}' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'APP_FILE_PUBLISH_FAILED', message: 'storage down' });
  });

  it('fails safely when S3 PUT through presigned URL fails', async () => {
    mockFetch((call) => {
      if (call.url.endsWith('/v1/files/upload-url')) {
        return new Response(JSON.stringify({ uploadUrl: 'https://s3.example/upload', storageKey: 'workspace/os-artifacts/file.json' }), { status: 200 });
      }
      return new Response('', { status: 403 });
    });

    const result = await publishArtifactToAppFile({ artifact, content: '{}' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'APP_FILE_PUBLISH_FAILED', message: 'Artifact upload failed with HTTP 403' });
  });

  it('fails safely when file record creation fails', async () => {
    mockFetch((call) => {
      if (call.url.endsWith('/v1/files/upload-url')) {
        return new Response(JSON.stringify({ uploadUrl: 'https://s3.example/upload', storageKey: 'workspace/os-artifacts/file.json' }), { status: 200 });
      }
      if (call.url === 'https://s3.example/upload') return new Response('', { status: 200 });
      return new Response(JSON.stringify({ error: { message: 'db down' } }), { status: 500 });
    });

    const result = await publishArtifactToAppFile({ artifact, content: '{}' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'APP_FILE_PUBLISH_FAILED', message: 'db down' });
  });

  it('publishes through app files API and returns app-visible refs', async () => {
    const calls = mockFetch((call) => {
      if (call.url.endsWith('/v1/files/upload-url')) {
        return new Response(JSON.stringify({ uploadUrl: 'https://s3.example/upload', storageKey: 'workspace/os-artifacts/file.json' }), { status: 200 });
      }
      if (call.url === 'https://s3.example/upload') return new Response('', { status: 200 });
      if (call.url.endsWith('/v1/files') && call.init.method === 'POST') {
        return new Response(JSON.stringify({ file: { id: 'file-1', name: artifact.name, storage_key: 'workspace/os-artifacts/file.json' } }), { status: 201 });
      }
      if (call.url.endsWith('/v1/files/file-1/attach')) {
        return new Response(JSON.stringify({ success: true, created: true, attachment: { id: 'attach-1' } }), { status: 201 });
      }
      if (call.url.endsWith('/v1/files/file-1')) {
        return new Response(JSON.stringify({ file: { id: 'file-1', name: artifact.name, storage_key: 'workspace/os-artifacts/file.json', downloadUrl: 'https://s3.example/download' } }), { status: 200 });
      }
      throw new Error(`Unexpected URL ${call.url}`);
    });

    const result = await publishArtifactToAppFile({
      artifact,
      content: '{"ok":true}',
      attachmentTarget: { entityType: 'company', entityId: 'company-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.artifact).toMatchObject({
      storageMode: 's3',
      appFileId: 'file-1',
      appAttachmentId: 'attach-1',
      storageKey: 'workspace/os-artifacts/file.json',
      downloadUrl: 'https://s3.example/download',
      appUrl: 'https://consuelo.example/files/file-1',
      cloud: {
        provider: 'consuelo-app-files',
        fileId: 'file-1',
        attachmentId: 'attach-1',
      },
    });
    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ['POST', 'https://app.example/v1/files/upload-url'],
      ['PUT', 'https://s3.example/upload'],
      ['POST', 'https://app.example/v1/files'],
      ['POST', 'https://app.example/v1/files/file-1/attach'],
      ['GET', 'https://app.example/v1/files/file-1'],
    ]);
  });
});
