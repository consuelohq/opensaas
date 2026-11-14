import type { EmbedFetch } from './api-client.js';
import { EmbedApiError, EmbedSessionExpiredError } from './api-client.js';
import type { MercuryCueView } from './mercury-cues.js';
import { normalizeAsyncError } from '../errors/normalize-async-error.js';

export type MercuryControl = 'pin' | 'auto' | 'next' | 'previous' | 'off';
export type MercuryResponse = {
  view: MercuryCueView | null;
  publishedVersion: string;
  projectionToken: string;
};
export type MercuryFeedApi = {
  start: (
    input: { scopeKey: string; scriptId: string },
    signal?: AbortSignal,
  ) => Promise<MercuryResponse>;
  read: (
    scopeKey: string,
    afterRevision: number,
    signal?: AbortSignal,
  ) => Promise<MercuryResponse>;
  control: (
    scopeKey: string,
    action: MercuryControl,
    projectionToken: string,
    signal?: AbortSignal,
  ) => Promise<MercuryResponse>;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const boundedText = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const invalid = (): never => {
  throw new Error(
    'The coaching response could not be verified. Use your manual script.',
  );
};

export const parseMercuryResponse = (
  input: unknown,
  scopeKey: string,
): MercuryResponse => {
  if (
    !record(input) ||
    !boundedText(input.publishedVersion, 200) ||
    !boundedText(input.projectionToken, 2000)
  )
    return invalid();
  if (input.view === null)
    return {
      view: null,
      publishedVersion: input.publishedVersion,
      projectionToken: input.projectionToken,
    };
  const view = input.view;
  if (
    !record(view) ||
    view.scopeKey !== scopeKey ||
    !Number.isSafeInteger(view.revision) ||
    Number(view.revision) < 0 ||
    !boundedText(view.heading, 200) ||
    !['approved', 'manual'].includes(String(view.kind)) ||
    !['live', 'manual', 'delayed', 'reconnecting', 'unavailable'].includes(
      String(view.status),
    ) ||
    !Array.isArray(view.points) ||
    view.points.length < 1 ||
    view.points.length > 4
  )
    return invalid();
  const slots = new Set<string>();
  const points: MercuryCueView['points'][number][] = [];
  for (const point of view.points) {
    if (
      !record(point) ||
      !boundedText(point.slotId, 128) ||
      slots.has(point.slotId) ||
      !boundedText(point.text, 256) ||
      !boundedText(point.exact, 20_000) ||
      !boundedText(point.source, 1000)
    )
      return invalid();
    slots.add(point.slotId);
    points.push({
      slotId: point.slotId,
      text: point.text,
      exact: point.exact,
      source: point.source,
    });
  }
  return {
    publishedVersion: input.publishedVersion,
    projectionToken: input.projectionToken,
    view: {
      scopeKey,
      revision: Number(view.revision),
      heading: view.heading,
      kind: view.kind === 'approved' ? 'approved' : 'manual',
      status: view.status as MercuryCueView['status'],
      points,
    },
  };
};

const boundedJson = async (
  response: Response,
  maxBytes: number,
): Promise<unknown> => {
  const reader = response.body?.getReader();
  if (!reader) return invalid();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return invalid();
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } finally {
    reader.releaseLock();
  }
};

export type MercuryRequestOptions = {
  baseUrl: string;
  getToken: () => string | null;
  fetch?: EmbedFetch;
};
export const createMercuryJsonRequest = (
  input: MercuryRequestOptions,
  maxResponseBytes = 262_144,
) => {
  const fetcher = input.fetch ?? globalThis.fetch.bind(globalThis);
  return async (path: string, init: RequestInit = {}): Promise<unknown> => {
    const token = input.getToken();
    if (!token) throw new EmbedSessionExpiredError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    const deadline = setTimeout(abort, 15_000);
    try {
      const response = await fetcher(input.baseUrl.replace(/\/$/, '') + path, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 401) throw new EmbedSessionExpiredError();
      let body: unknown;
      try {
        body = await boundedJson(response, maxResponseBytes);
      } catch (error: unknown) {
        if (response.ok) throw error;
        throw new EmbedApiError(
          'COACHING_UNAVAILABLE',
          'Coaching is unavailable. Your call controls still work.',
          response.status >= 500 || response.status === 429,
          response.status,
        );
      }
      if (!response.ok) {
        const error = record(body) && record(body.error) ? body.error : {};
        throw new EmbedApiError(
          typeof error.code === 'string' ? error.code : 'COACHING_UNAVAILABLE',
          'Coaching is unavailable. Your call controls still work.',
          response.status >= 500 || response.status === 429,
          response.status,
        );
      }
      return body;
    } finally {
      clearTimeout(deadline);
      init.signal?.removeEventListener('abort', abort);
    }
  };
};
export const createMercuryFeedApi = (
  input: MercuryRequestOptions,
): MercuryFeedApi => {
  const requestJson = createMercuryJsonRequest(input);
  const request = async (
    scopeKey: string,
    path: string,
    init: RequestInit,
  ): Promise<MercuryResponse> => {
    try {
      return parseMercuryResponse(await requestJson(path, init), scopeKey);
    } catch (error: unknown) {
      throw normalizeAsyncError(error);
    }
  };
  return {
    start: (command, signal) =>
      request(command.scopeKey, '/v1/coaching/sessions', {
        method: 'POST',
        body: JSON.stringify(command),
        signal,
      }),
    read: (scopeKey, afterRevision, signal) =>
      request(
        scopeKey,
        `/v1/coaching/sessions/${encodeURIComponent(scopeKey)}/cue?afterRevision=${afterRevision}`,
        { signal },
      ),
    control: (scopeKey, action, projectionToken, signal) =>
      request(
        scopeKey,
        `/v1/coaching/sessions/${encodeURIComponent(scopeKey)}/control`,
        {
          method: 'POST',
          body: JSON.stringify({ action, projectionToken }),
          signal,
          keepalive: action === 'off',
        },
      ),
  };
};
