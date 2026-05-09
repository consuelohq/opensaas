import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import { type Request } from 'express';

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!authToken) {
        throw new UnauthorizedException('TWILIO_AUTH_TOKEN is not configured');
      }

      const signature = this.readFirstForwardedHeader(
        request.headers['x-twilio-signature'],
        '',
      );

      if (!signature) {
        throw new UnauthorizedException('Missing Twilio signature');
      }

      const protocol = this.readFirstForwardedHeader(
        request.headers['x-forwarded-proto'],
        'https',
      );
      const host = this.readFirstForwardedHeader(
        request.headers['x-forwarded-host'],
        request.headers.host ?? '',
      );
      const path = request.originalUrl ?? request.path;
      const url = `${protocol}://${host}${path}`;

      const twilio = await import('twilio');

      const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
      const bodyString = rawBody ? rawBody.toString('utf8') : '';
      const bodyParams =
        (request.body as Record<string, unknown> | undefined) ?? {};

      const contentType = this.readFirstForwardedHeader(
        request.headers['content-type'],
        '',
      );
      const isJsonBody = contentType.toLowerCase().includes('application/json');
      const isValid =
        rawBody && isJsonBody
          ? twilio.validateRequestWithBody(
              authToken,
              signature,
              url,
              bodyString,
            )
          : twilio.validateRequest(authToken, signature, url, bodyParams);

      if (!isValid) {
        throw new UnauthorizedException('Invalid Twilio signature');
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';

      throw new UnauthorizedException(`Twilio validation failed: ${message}`);
    }
  }

  private readFirstForwardedHeader(
    value: string | string[] | undefined,
    fallback: string,
  ): string {
    if (Array.isArray(value)) {
      return this.readFirstForwardedHeader(value[0], fallback);
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    return value.split(',')[0]?.trim() || fallback;
  }
}
