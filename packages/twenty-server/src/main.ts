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
    cors: true,
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

  // Mount @consuelo/api routes on the Express instance (optional — server works without them)
  // HACK: dynamic path prevents nx from detecting this as a build dependency (DEV-878)
  // Path: /app/packages/twenty-server -> /app/packages/api/dist/routes/index.js
  const apiRoutesPath = [
    '..',
    '..',
    '..',
    'packages',
    'api',
    'dist',
    'routes',
    'index.js',
  ].join('/');
  try {
    const routesModule = await import(apiRoutesPath);
    const expressApp = app.getHttpAdapter().getInstance();
    for (const route of routesModule.allRoutes()) {
      const method = route.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';
      expressApp[method](route.path, async (req: any, res: any) => {
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
    }
    console.log(
      `Mounted ${routesModule.allRoutes().length} @consuelo/api routes`,
    ); // HACK: one-time startup log is acceptable
  } catch {
    console.log('@consuelo/api routes not available, skipping'); // HACK: one-time startup log is acceptable
  }

  await app.listen(twentyConfigService.get('NODE_PORT'));
};

bootstrap();
