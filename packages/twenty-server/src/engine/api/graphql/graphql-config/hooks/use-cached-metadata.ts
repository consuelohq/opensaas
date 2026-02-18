import { createHash } from 'crypto';

import { type Plugin } from 'graphql-yoga';
import { isDefined } from 'twenty-shared/utils';

import { InternalServerError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

type CustomRequest = {
  workspace?: WorkspaceEntity & { metadataVersion?: string };
  locale?: string;
  userWorkspaceId?: string;
  body?: { query?: string };
};

export type CacheMetadataPluginConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cacheGetter: (key: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cacheSetter: (key: string, value: any) => void;
  operationsToCache: string[];
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

    // For FindAllCoreViews, use user-specific cache key since visibility filtering is user-dependent
    if (operationName === 'FindAllCoreViews') {
      return `graphql:operations:${operationName}:${workspace.id}:${workspaceMetadataVersion}:${request.userWorkspaceId}:${queryHash}`;
    }

    return `graphql:operations:${operationName}:${workspace.id}:${workspaceMetadataVersion}:${locale}:${queryHash}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getOperationName = (serverContext: any) =>
    serverContext?.req?.body?.operationName;

  return {
    // HACK: graphql-yoga Plugin hook types don't expose serverContext — safe destructure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRequest: async ({ endResponse, serverContext }: any) => {
      const request = serverContext.req as CustomRequest;

      if (!request.workspace?.id) {
        return;
      }

      if (!config.operationsToCache.includes(getOperationName(serverContext))) {
        return;
      }

      const cacheKey = computeCacheKey({
        operationName: getOperationName(serverContext),
        request,
      });
      const cachedResponse = await config.cacheGetter(cacheKey);

      if (cachedResponse) {
        const earlyResponse = Response.json(cachedResponse);

        return endResponse(earlyResponse);
      }
    },
    // HACK: graphql-yoga Plugin hook types don't expose serverContext — safe destructure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onResponse: async ({ response, serverContext }: any) => {
      const request = serverContext.req as CustomRequest;

      if (!request.workspace?.id) {
        return;
      }

      if (!config.operationsToCache.includes(getOperationName(serverContext))) {
        return;
      }

      const cacheKey = computeCacheKey({
        operationName: getOperationName(serverContext),
        request,
      });

      const cachedResponse = await config.cacheGetter(cacheKey);

      if (!cachedResponse) {
        const responseBody = await response.json();

        if (responseBody.errors) {
          return;
        }

        config.cacheSetter(cacheKey, responseBody);
      }
    },
  };
}
