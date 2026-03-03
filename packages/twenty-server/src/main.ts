import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import fs from 'fs';

import bytes from 'bytes';
import { useContainer } from 'class-validator';
import session from 'express-session';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';

import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';

import { setPgDateTypeParser } from 'src/database/pg/set-pg-date-type-parser';
import { LoggerService } from 'src/engine/core-modules/logger/logger.service';
import { getSessionStorageOptions } from 'src/engine/core-modules/session-storage/session-storage.module-factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UnhandledExceptionFilter } from 'src/filters/unhandled-exception.filter';

import { AppModule } from './app.module';
import './instrument';

import { settings } from './engine/constants/settings';
import { generateFrontConfig } from './utils/generate-front-config';

const bootstrap = async () => {
  setPgDateTypeParser();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
    bufferLogs: process.env.LOGGER_IS_BUFFER_ENABLED === 'true',
    rawBody: true,
    snapshot: process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT,
    ...(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH
      ? {
          httpsOptions: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
          },
        }
      : {}),
  });
  const logger = app.get(LoggerService);
  const twentyConfigService = app.get(TwentyConfigService);

  app.use(session(getSessionStorageOptions(twentyConfigService)));

  // Apply class-validator container so that we can use injection in validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Use our logger
  app.useLogger(logger);

  app.useGlobalFilters(new UnhandledExceptionFilter());

  app.useBodyParser('json', { limit: settings.storage.maxFileSize });
  app.useBodyParser('urlencoded', {
    limit: settings.storage.maxFileSize,
    extended: true,
  });

  // Graphql file upload
  app.use(
    '/graphql',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize)!,
      maxFiles: 10,
    }),
  );

  app.use(
    '/metadata',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize)!,
      maxFiles: 10,
    }),
  );

  // Inject the server url in the frontend page
  generateFrontConfig();

  // Log uncaught errors but avoid flooding logs on repeated connection resets
  let uncaughtCount = 0;

  process.on('uncaughtException', (err) => {
    uncaughtCount++;
    if (uncaughtCount <= 5) {
      console.error('UNCAUGHT EXCEPTION:', err.stack ?? err.message);
    } else if (uncaughtCount === 6) {
      console.error(
        'UNCAUGHT EXCEPTION: suppressing further logs (too many errors)',
      );
    }
  });
  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
  });

  // Mount API routes on the Express instance (optional — server works without them)
  // Dynamic path prevents nx from detecting this as a build dependency
  const apiRoutesPath = ['..', '..', 'api', 'dist', 'routes', 'index.js'].join(
    '/',
  );
  try {
    console.log('Importing API routes from:', apiRoutesPath);
    const routesModule = await import(apiRoutesPath);
    console.log('Import succeeded, calling allRoutes()');
    const routes = routesModule.allRoutes();
    console.log(`allRoutes() returned ${routes.length} routes, mounting...`);
    const expressApp = app.getHttpAdapter().getInstance();

    const apiMiddlewarePath = [
      '..',
      '..',
      'api',
      'dist',
      'middleware',
      'index.js',
    ].join('/');
    const { authMiddleware } = await import(apiMiddlewarePath);
    const auth = authMiddleware();

    for (const route of routes) {
      const method = route.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';
      const handlers: any[] = [];

      if (route.auth !== false) {
        handlers.push(auth);
      }

      handlers.push(async (req: any, res: any) => {
        // HACK: Express types are compatible with ApiRequest/ApiResponse but TypeScript cannot verify across packages
        try {
          await route.handler(req, res);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';
          if (!res.headersSent) {
            res
              .status(500)
              .json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
          }
        }
      });

      expressApp[method](route.path, ...handlers);
    }
    console.log(`Mounted ${routes.length} API routes OK`);
  } catch (err: unknown) {
    console.log(
      'API route loading failed:',
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
  }

  await app.listen(twentyConfigService.get('NODE_PORT'));
};

bootstrap();
