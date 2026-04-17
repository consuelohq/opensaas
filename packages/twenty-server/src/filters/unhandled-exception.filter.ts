import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
} from '@nestjs/common';

import { type Request, type Response } from 'express';

import { applyCorsHeadersIfAllowed } from 'src/utils/cors';

// In case of exception in middleware run before the CORS middleware (eg: JSON Middleware that checks the request body),
// the CORS headers are missing in the response.
// This class add CORS headers to exception response to avoid misleading CORS error
@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (!response.header || response.headersSent) {
      return;
    }

    applyCorsHeadersIfAllowed({
      response,
      origin:
        typeof request.headers.origin === 'string'
          ? request.headers.origin
          : null,
      requestedHeaders: request.headers['access-control-request-headers'],
    });

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const normalizedObjectResponse =
      rawResponse !== null && typeof rawResponse === 'object'
        ? (rawResponse as Record<string, unknown>)
        : null;
    const payload =
      normalizedObjectResponse === null
        ? {
            statusCode: status,
            message:
              typeof rawResponse === 'string'
                ? rawResponse
                : 'Internal server error',
          }
        : {
            ...normalizedObjectResponse,
            statusCode:
              typeof normalizedObjectResponse.statusCode === 'number'
                ? normalizedObjectResponse.statusCode
                : status,
            message:
              normalizedObjectResponse.message ?? 'Internal server error',
          };

    response.status(status).json(payload);
  }
}
