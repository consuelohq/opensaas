import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
} from '@nestjs/common';

import { type Request, type Response } from 'express';

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

    const origin = request.headers.origin;
    const requestedHeaders = request.headers['access-control-request-headers'];

    if (typeof origin === 'string' && origin.length > 0) {
      response.header('Access-Control-Allow-Origin', origin);
      response.header('Vary', 'Origin');
      response.header('Access-Control-Allow-Credentials', 'true');
      response.header(
        'Access-Control-Allow-Headers',
        typeof requestedHeaders === 'string' && requestedHeaders.length > 0
          ? requestedHeaders
          : 'Authorization, Content-Type',
      );
      response.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(payload);
  }
}
