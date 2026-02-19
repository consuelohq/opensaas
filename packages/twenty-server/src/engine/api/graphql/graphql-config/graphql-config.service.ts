import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { type GqlOptionsFactory } from '@nestjs/graphql';

import {
  type YogaDriverConfig,
  type YogaDriverServerContext,
} from '@graphql-yoga/nestjs';
import * as Sentry from '@sentry/node';
import { GraphQLError, GraphQLSchema } from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  type GraphQLSchemaWithContext,
  type YogaInitialContext,
} from 'graphql-yoga';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { isDefined } from 'twenty-shared/utils';

import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';

import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { CoreEngineModule } from 'src/engine/core-modules/core-engine.module';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { useSentryTracing } from 'src/engine/core-modules/exception-handler/hooks/use-sentry-tracing';
import { useDisableIntrospectionAndSuggestionsForUnauthenticatedUsers } from 'src/engine/core-modules/graphql/hooks/use-disable-introspection-and-suggestions-for-unauthenticated-users.hook';
import { useGraphQLErrorHandlerHook } from 'src/engine/core-modules/graphql/hooks/use-graphql-error-handler.hook';
import { useValidateGraphqlQueryComplexity } from 'src/engine/core-modules/graphql/hooks/use-validate-graphql-query-complexity.hook';
import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataloaderService } from 'src/engine/dataloaders/dataloader.service';
import { handleExceptionAndConvertToGraphQLError } from 'src/engine/utils/global-exception-handler.util';
import { renderApolloPlayground } from 'src/engine/utils/render-apollo-playground.util';

// Custom request type with our augmented properties
type CustomRequest = {
  workspace?: WorkspaceEntity;
  user?: UserEntity;
  application?: { id: string };
};

export interface GraphQLContext extends YogaDriverServerContext<'express'> {
  user?: UserEntity;
  workspace?: WorkspaceEntity;
}

@Injectable()
export class GraphQLConfigService implements GqlOptionsFactory<
  YogaDriverConfig<'express'>
> {
  constructor(
    private readonly exceptionHandlerService: ExceptionHandlerService,
    private readonly twentyConfigService: TwentyConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly metricsService: MetricsService,
    private readonly dataloaderService: DataloaderService,
    private readonly i18nService: I18nService,
  ) {}

  createGqlOptions(): YogaDriverConfig {
    const isDebugMode =
      this.twentyConfigService.get('NODE_ENV') === NodeEnvironment.DEVELOPMENT;
    const plugins = [
      // DEV-878: debug plugin to capture errors at every yoga phase
      {
        onExecute({
          args,
        }: {
          args: { contextValue: { req: { workspace?: { id: string } } } };
        }) {
          try {
            return {
              onExecuteDone({
                result,
              }: {
                result: {
                  errors?: Array<{ message: string; originalError?: Error }>;
                };
              }) {
                try {
                  if (result && 'errors' in result && result.errors) {
                    for (const err of result.errors) {
                      const orig = (err.originalError || err) as Error;

                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (global as any).__lastYogaExecError = {
                        message: orig.message ?? err.message,
                        stack: orig.stack ?? '(no stack)',
                        name: orig.constructor?.name ?? typeof orig,
                        timestamp: new Date().toISOString(),
                      };
                    }
                  }
                } catch (innerErr) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (global as any).__lastYogaExecError = {
                    message:
                      innerErr instanceof Error
                        ? (innerErr as Error).message
                        : String(innerErr),
                    stack:
                      innerErr instanceof Error
                        ? (innerErr as Error).stack
                        : undefined,
                    name: 'PluginError',
                    timestamp: new Date().toISOString(),
                  };
                }
              },
            };
          } catch (outerErr) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (global as any).__lastYogaExecError = {
              message:
                outerErr instanceof Error
                  ? (outerErr as Error).message
                  : String(outerErr),
              stack:
                outerErr instanceof Error
                  ? (outerErr as Error).stack
                  : undefined,
              name: 'PluginError',
              timestamp: new Date().toISOString(),
            };
          }
        },
        onResultProcess({
          result,
        }: {
          result: { errors?: Array<{ message: string }> };
        }) {
          try {
            if (result && 'errors' in result && result.errors) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (global as any).__lastYogaResultError = {
                errors: result.errors.map(
                  (e: { message: string }) => e.message,
                ),
                timestamp: new Date().toISOString(),
              };
            }
          } catch (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (global as any).__lastYogaResultError = {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
              name: 'PluginError',
              timestamp: new Date().toISOString(),
            };
          }
        },
      },
      // DEV-878: catch validation errors (the "Cannot convert undefined or null to object" source)
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onValidate({ validateFn, params, setResult }: any) {
          try {
            const errors = validateFn(params.schema, params.documentAST);

            if (errors && errors.length > 0) {
              setResult(errors);
            }
          } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = global as any;
            const e = err instanceof Error ? err : new Error(String(err));

            // dump broken types from the schema
            const brokenTypes: string[] = [];

            try {
              const typeMap = params.schema?.getTypeMap?.();

              if (typeMap) {
                for (const [name, type] of Object.entries(typeMap)) {
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (typeof (type as any).getFields === 'function') {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (type as any).getFields();
                    }
                  } catch {
                    brokenTypes.push(name);
                  }
                }
              }
            } catch {
              // ignore
            }

            g.__lastValidationError = {
              message: e.message,
              stack: e.stack,
              brokenTypes,
              timestamp: new Date().toISOString(),
            };
            throw err;
          }
        },
      },
      useGraphQLErrorHandlerHook({
        metricsService: this.metricsService,
        exceptionHandlerService: this.exceptionHandlerService,
        i18nService: this.i18nService,
        twentyConfigService: this.twentyConfigService,
      }),
      useDisableIntrospectionAndSuggestionsForUnauthenticatedUsers(
        this.twentyConfigService.get('NODE_ENV') === NodeEnvironment.PRODUCTION,
      ),
      useValidateGraphqlQueryComplexity({
        maximumAllowedFields:
          this.twentyConfigService.get('GRAPHQL_MAX_FIELDS'),
        maximumAllowedRootResolvers: this.twentyConfigService.get(
          'GRAPHQL_MAX_ROOT_RESOLVERS',
        ),
        checkDuplicateRootResolvers: true,
      }),
    ];

    if (Sentry.isInitialized()) {
      // HACK: useSentryTracing() returns a Plugin type incompatible with graphql-yoga's Plugin — safe cast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins.push(useSentryTracing() as any);
    }

    const config: YogaDriverConfig = {
      autoSchemaFile: true,
      include: [CoreEngineModule],
      buildSchemaOptions: {},
      conditionalSchema: async (context) => {
        const customReq = context.req as typeof context.req & {
          workspace?: WorkspaceEntity;
          user?: UserEntity;
          application?: { id: string };
        };
        const { workspace, user, application } = customReq;

        try {
          if (!isDefined(workspace)) {
            return new GraphQLSchema({});
          }

          return await this.createSchema(
            context as YogaDriverServerContext<'express'> & YogaInitialContext,
            workspace,
            application?.id,
          );
        } catch (error) {
          // DEBUG: store error for /debug-error endpoint
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (global as any).__lastGraphQLError = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name:
              error instanceof Error ? error.constructor.name : typeof error,
            timestamp: new Date().toISOString(),
          };

          if (error instanceof UnauthorizedException) {
            throw new GraphQLError('Unauthenticated', {
              extensions: {
                code: 'UNAUTHENTICATED',
              },
            });
          }

          if (error instanceof JsonWebTokenError) {
            //mockedUserJWT
            throw new GraphQLError('Unauthenticated', {
              extensions: {
                code: 'UNAUTHENTICATED',
              },
            });
          }

          if (error instanceof TokenExpiredError) {
            throw new GraphQLError('Unauthenticated', {
              extensions: {
                code: 'UNAUTHENTICATED',
              },
            });
          }

          throw handleExceptionAndConvertToGraphQLError(
            error,
            this.exceptionHandlerService,
            isDefined(user)
              ? {
                  id: user.id,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                }
              : undefined,
            isDefined(workspace)
              ? {
                  id: workspace.id,
                  displayName: workspace.displayName,
                  activationStatus: workspace.activationStatus,
                }
              : undefined,
          );
        }
      },
      resolvers: { JSON: GraphQLJSON },
      plugins: plugins,
      context: () => ({
        loaders: this.dataloaderService.createLoaders(),
      }),
    };

    if (isDebugMode) {
      config.renderGraphiQL = () => {
        return renderApolloPlayground();
      };
    }

    return config;
  }

  async createSchema(
    context: YogaDriverServerContext<'express'> & YogaInitialContext,
    workspace: WorkspaceEntity,
    applicationId?: string,
  ): Promise<GraphQLSchemaWithContext<YogaDriverServerContext<'express'>>> {
    // Create a new contextId for each request
    const contextId = ContextIdFactory.create();

    if (this.moduleRef.registerRequestByContextId) {
      // Register the request in the contextId
      this.moduleRef.registerRequestByContextId(context.req, contextId);
    }

    // Resolve the WorkspaceSchemaFactory for the contextId
    const workspaceFactory = await this.moduleRef.resolve(
      WorkspaceSchemaFactory,
      contextId,
      {
        strict: false,
      },
    );

    return await workspaceFactory.createGraphQLSchema(workspace, applicationId);
  }
}
