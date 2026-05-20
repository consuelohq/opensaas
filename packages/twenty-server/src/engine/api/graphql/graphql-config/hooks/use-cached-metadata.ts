import { createHash } from 'crypto';

import { type Plugin } from 'graphql-yoga';

import { InternalServerError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

type CustomRequest = {
  workspace?: WorkspaceEntity & { metadataVersion?: string };
  locale?: string;
  userWorkspaceId?: string;
  body?: { operationName?: string; query?: string };
};

type GraphQLYogaServerContext = {
  req?: CustomRequest;
};

type GraphQLYogaRequestHookPayload = {
  endResponse: (response: Response) => void;
  serverContext: GraphQLYogaServerContext;
};

type GraphQLYogaResponseHookPayload = {
  response: Response;
  serverContext: GraphQLYogaServerContext;
};

type GraphQLResponseBody = {
  errors?: unknown;
  [key: string]: unknown;
};

type MetadataCacheAction = 'get' | 'set';

export type MetadataCacheFailure = {
  action: MetadataCacheAction;
  operationName: string;
  reason: 'error' | 'timeout';
  message?: string;
};

export type CacheMetadataPluginConfig = {
  cacheGetter: (
    key: string,
  ) => Promise<unknown | undefined> | unknown | undefined;
  cacheSetter: (key: string, value: unknown) => Promise<void> | void;
  onCacheFailure?: (failure: MetadataCacheFailure) => void;
  operationsToCache: string[];
};

const METADATA_CACHE_TIMEOUT_MS = 250;

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'unknown error';

const runCacheOperation = async <T>({
  action,
  onCacheFailure,
  operation,
  operationName,
}: {
  action: MetadataCacheAction;
  onCacheFailure?: (failure: MetadataCacheFailure) => void;
  operation: () => Promise<T> | T;
  operationName: string;
}): Promise<T | undefined> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;

  const timeoutPromise = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => {
      didTimeout = true;
      resolve(undefined);
    }, METADATA_CACHE_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      Promise.resolve(operation()),
      timeoutPromise,
    ]);

    if (didTimeout) {
      onCacheFailure?.({
        action,
        operationName,
        reason: 'timeout',
      });
    }

    return result;
  } catch (err: unknown) {
    onCacheFailure?.({
      action,
      message: getErrorMessage(err),
      operationName,
      reason: 'error',
    });

    return undefined;
  } finally {
    if (isDefined(timeout)) {
      clearTimeout(timeout);
    }
  }
};

export function useCachedMetadata(config: CacheMetadataPluginConfig): Plugin {
  const computeCacheKey = ({
    operationName,
    request,
  }: {
    operationName: string;
    request: CustomRequest;
  }) => {
    const workspace = request.workspace;

    if (!isDefined(workspace)) {
      throw new InternalServerError('Workspace is not defined');
    }

    const workspaceMetadataVersion = workspace.metadataVersion ?? '0';
    const locale = request.locale;
    const queryHash = createHash('sha256')
      .update(request.body?.query ?? '')
      .digest('hex');

    // For FindAllCoreViews, use user-specific cache key since visibility filtering is user-dependent.
    if (operationName === 'FindAllCoreViews') {
      return `graphql:operations:${operationName}:${workspace.id}:${workspaceMetadataVersion}:${request.userWorkspaceId}:${queryHash}`;
    }

    return `graphql:operations:${operationName}:${workspace.id}:${workspaceMetadataVersion}:${locale}:${queryHash}`;
  };

  const getOperationName = (serverContext: GraphQLYogaServerContext) =>
    serverContext.req?.body?.operationName;

  const shouldCacheOperation = (
    operationName: string | undefined,
  ): operationName is string =>
    isDefined(operationName) &&
    config.operationsToCache.includes(operationName);

  return {
    onRequest: async (hookPayload: unknown) => {
      const { endResponse, serverContext } =
        hookPayload as GraphQLYogaRequestHookPayload;
      const request = serverContext.req;

      if (!request?.workspace?.id) {
        return;
      }

      const operationName = getOperationName(serverContext);

      if (!shouldCacheOperation(operationName)) {
        return;
      }

      const cacheKey = computeCacheKey({
        operationName,
        request,
      });
      let cachedResponse: unknown | undefined;

      try {
        cachedResponse = await runCacheOperation({
          action: 'get',
          onCacheFailure: config.onCacheFailure,
          operation: () => config.cacheGetter(cacheKey),
          operationName,
        });
      } catch {
        return;
      }

      if (isDefined(cachedResponse)) {
        const earlyResponse = Response.json(cachedResponse);

        endResponse(earlyResponse);
      }
    },
    onResponse: async (hookPayload: unknown) => {
      const { response, serverContext } =
        hookPayload as GraphQLYogaResponseHookPayload;
      const request = serverContext.req;

      if (!request?.workspace?.id) {
        return;
      }

      const operationName = getOperationName(serverContext);

      if (!shouldCacheOperation(operationName)) {
        return;
      }

      const cacheKey = computeCacheKey({
        operationName,
        request,
      });

      let cachedResponse: unknown | undefined;

      try {
        cachedResponse = await runCacheOperation({
          action: 'get',
          onCacheFailure: config.onCacheFailure,
          operation: () => config.cacheGetter(cacheKey),
          operationName,
        });
      } catch {
        return;
      }

      if (isDefined(cachedResponse)) {
        return;
      }

      let responseBody: GraphQLResponseBody;

      try {
        responseBody = (await response.clone().json()) as GraphQLResponseBody;
      } catch {
        return;
      }

      if (responseBody.errors) {
        return;
      }

      void runCacheOperation({
        action: 'set',
        onCacheFailure: config.onCacheFailure,
        operation: () => config.cacheSetter(cacheKey, responseBody),
        operationName,
      });
    },
  };
}
