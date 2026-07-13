import { type Plugin } from 'graphql-yoga';

import { useCachedMetadata } from 'src/engine/api/graphql/graphql-config/hooks/use-cached-metadata';

type RequestHook = (payload: {
  endResponse: (response: Response) => void;
  serverContext: MetadataCacheTestContext;
}) => Promise<void>;

type ResponseHook = (payload: {
  response: Response;
  serverContext: MetadataCacheTestContext;
}) => Promise<void>;

type MetadataCacheTestContext = {
  req: {
    workspace: {
      id: string;
      metadataVersion: string;
    };
    locale: string;
    userWorkspaceId: string;
    body: {
      operationName: string;
      query: string;
    };
  };
};

const getRequestHook = (plugin: Plugin): RequestHook =>
  plugin.onRequest as unknown as RequestHook;

const getResponseHook = (plugin: Plugin): ResponseHook =>
  plugin.onResponse as unknown as ResponseHook;

const buildServerContext = (
  operationName = 'ObjectMetadataItems',
): MetadataCacheTestContext => ({
  req: {
    workspace: {
      id: 'workspace-id',
      metadataVersion: '42',
    },
    locale: 'en',
    userWorkspaceId: 'user-workspace-id',
    body: {
      operationName,
      query: `query ${operationName} { id }`,
    },
  },
});

describe('useCachedMetadata', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns a cached response when cache lookup succeeds', async () => {
    const cachedResponse = { data: { objectMetadataItems: [] } };
    const cacheGetter = jest.fn().mockResolvedValue(cachedResponse);
    const cacheSetter = jest.fn();
    const endResponse = jest.fn();
    const plugin = useCachedMetadata({
      cacheGetter,
      cacheSetter,
      operationsToCache: ['ObjectMetadataItems'],
    });

    await getRequestHook(plugin)({
      endResponse,
      serverContext: buildServerContext(),
    });

    expect(endResponse).toHaveBeenCalledTimes(1);
    expect(await endResponse.mock.calls[0][0].json()).toEqual(cachedResponse);
  });

  it('continues the request when cache lookup rejects', async () => {
    const cacheGetter = jest
      .fn()
      .mockRejectedValue(new Error('read ECONNRESET'));
    const cacheSetter = jest.fn();
    const endResponse = jest.fn();
    const plugin = useCachedMetadata({
      cacheGetter,
      cacheSetter,
      operationsToCache: ['ObjectMetadataItems'],
    });

    await expect(
      getRequestHook(plugin)({
        endResponse,
        serverContext: buildServerContext(),
      }),
    ).resolves.toBeUndefined();

    expect(endResponse).not.toHaveBeenCalled();
  });

  it('continues the request when cache lookup hangs', async () => {
    jest.useFakeTimers();

    const cacheGetter = jest.fn(() => new Promise<unknown>(() => undefined));
    const cacheSetter = jest.fn();
    const endResponse = jest.fn();
    const plugin = useCachedMetadata({
      cacheGetter,
      cacheSetter,
      operationsToCache: ['ObjectMetadataItems'],
    });

    const requestPromise = getRequestHook(plugin)({
      endResponse,
      serverContext: buildServerContext(),
    });

    await jest.advanceTimersByTimeAsync(251);
    await expect(requestPromise).resolves.toBeUndefined();

    expect(endResponse).not.toHaveBeenCalled();
  });

  it('caches successful responses without consuming the original response body', async () => {
    const responseBody = { data: { objectMetadataItems: [] } };
    const cacheGetter = jest.fn().mockResolvedValue(undefined);
    const cacheSetter = jest.fn().mockResolvedValue(undefined);
    const response = Response.json(responseBody);
    const plugin = useCachedMetadata({
      cacheGetter,
      cacheSetter,
      operationsToCache: ['ObjectMetadataItems'],
    });

    await getResponseHook(plugin)({
      response,
      serverContext: buildServerContext(),
    });
    await Promise.resolve();

    expect(cacheSetter).toHaveBeenCalledWith(
      expect.stringContaining(
        'graphql:operations:ObjectMetadataItems:workspace-id:42:en:',
      ),
      responseBody,
    );
    expect(await response.json()).toEqual(responseBody);
  });

  it('does not throw when cache write rejects', async () => {
    const cacheGetter = jest.fn().mockResolvedValue(undefined);
    const cacheSetter = jest
      .fn()
      .mockRejectedValue(new Error('read ECONNRESET'));
    const response = Response.json({ data: { objectMetadataItems: [] } });
    const plugin = useCachedMetadata({
      cacheGetter,
      cacheSetter,
      operationsToCache: ['ObjectMetadataItems'],
    });

    await expect(
      getResponseHook(plugin)({
        response,
        serverContext: buildServerContext(),
      }),
    ).resolves.toBeUndefined();

    expect(cacheSetter).toHaveBeenCalledTimes(1);
  });
});
