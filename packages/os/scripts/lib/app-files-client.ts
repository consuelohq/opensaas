export type AppFilesCapability = {
  ok: boolean;
  apiUrl?: string;
  apiKey?: string;
  safeMessage?: string;
};

export type AppFileRecord = {
  id: string;
  name?: string;
  mimeType?: string;
  mime_type?: string;
  size?: number;
  storageKey?: string;
  storage_key?: string;
  downloadUrl?: string;
  url?: string;
  folder?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type AppFileAttachment = {
  id?: string;
  attachment_id?: string;
  fileId?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  storageKey: string;
};

export type CreateFileInput = {
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  folder?: string;
  tags?: string[];
};

export type AttachmentTarget = {
  entityType: string;
  entityId: string;
};

const SUPPORTED_ATTACHMENT_TARGETS = new Set(['contact', 'call', 'company', 'deal']);

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

export function getAppFilesCapability(): AppFilesCapability {
  const apiUrl = process.env.CONSUELO_APP_API_URL;
  const apiKey = process.env.CONSUELO_APP_API_KEY;
  if (!apiUrl || !apiKey) {
    return {
      ok: false,
      apiUrl,
      apiKey,
      safeMessage: 'CONSUELO_APP_API_URL or CONSUELO_APP_API_KEY is missing.',
    };
  }
  return { ok: true, apiUrl: trimTrailingSlash(apiUrl), apiKey };
}

export function isSupportedAttachmentTarget(target: AttachmentTarget): boolean {
  return SUPPORTED_ATTACHMENT_TARGETS.has(target.entityType);
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  };
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({}));
  return body != null && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  const error = body.error;
  if (error != null && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message.slice(0, 240);
  }
  return fallback;
}

export class AppFilesClient {
  constructor(private readonly capability: Required<Pick<AppFilesCapability, 'apiUrl' | 'apiKey'>>) {}

  async createUploadUrl(input: { name: string; mimeType: string; size?: number; folder?: string }): Promise<UploadUrlResponse> {
    try {
      const response = await fetch(`${this.capability.apiUrl}/v1/files/upload-url`, {
        method: 'POST',
        headers: authHeaders(this.capability.apiKey),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await parseJson(response);
      if (!response.ok || typeof body.uploadUrl !== 'string' || typeof body.storageKey !== 'string') {
        throw new Error(errorMessage(body, `Upload URL request failed with HTTP ${response.status}`));
      }
      return { uploadUrl: body.uploadUrl, storageKey: body.storageKey };
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error('Upload URL request failed.');
    }
  }

  async uploadBytes(uploadUrl: string, body: string | Buffer | Uint8Array, mimeType: string): Promise<void> {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': mimeType },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Artifact upload failed with HTTP ${response.status}`);
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error('Artifact upload failed.');
    }
  }

  async createFile(input: CreateFileInput): Promise<AppFileRecord> {
    try {
      const response = await fetch(`${this.capability.apiUrl}/v1/files`, {
        method: 'POST',
        headers: authHeaders(this.capability.apiKey),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await parseJson(response);
      const file = body.file;
      if (!response.ok || file == null || typeof file !== 'object' || Array.isArray(file)) {
        throw new Error(errorMessage(body, `File record creation failed with HTTP ${response.status}`));
      }
      return file as AppFileRecord;
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error('File record creation failed.');
    }
  }

  async attachFile(fileId: string, target: AttachmentTarget): Promise<AppFileAttachment | null> {
    try {
      if (!isSupportedAttachmentTarget(target)) {
        throw new Error(`Unsupported attachment target: ${target.entityType}`);
      }
      const response = await fetch(`${this.capability.apiUrl}/v1/files/${fileId}/attach`, {
        method: 'POST',
        headers: authHeaders(this.capability.apiKey),
        body: JSON.stringify(target),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await parseJson(response);
      if (!response.ok) throw new Error(errorMessage(body, `File attach failed with HTTP ${response.status}`));
      const attachment = body.attachment;
      return attachment != null && typeof attachment === 'object' && !Array.isArray(attachment)
        ? attachment as AppFileAttachment
        : null;
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error('File attach failed.');
    }
  }

  async getFile(fileId: string): Promise<AppFileRecord> {
    try {
      const response = await fetch(`${this.capability.apiUrl}/v1/files/${fileId}`, {
        method: 'GET',
        headers: authHeaders(this.capability.apiKey),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await parseJson(response);
      const file = body.file;
      if (!response.ok || file == null || typeof file !== 'object' || Array.isArray(file)) {
        throw new Error(errorMessage(body, `File lookup failed with HTTP ${response.status}`));
      }
      return file as AppFileRecord;
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error('File lookup failed.');
    }
  }
}

export function createAppFilesClient(): AppFilesClient | null {
  const capability = getAppFilesCapability();
  if (!capability.ok || !capability.apiUrl || !capability.apiKey) return null;
  return new AppFilesClient({ apiUrl: capability.apiUrl, apiKey: capability.apiKey });
}
