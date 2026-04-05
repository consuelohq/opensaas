import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      throw new UnauthorizedException('TWILIO_AUTH_TOKEN is not configured');
    }

    const signature = request.headers['x-twilio-signature'];
    if (!signature || typeof signature !== 'string') {
      throw new UnauthorizedException('Missing Twilio signature');
    }

    const protocol =
      typeof request.headers['x-forwarded-proto'] === 'string'
        ? request.headers['x-forwarded-proto']
        : 'https';
    const host = request.headers.host ?? '';
    const url = `${protocol}://${host}${request.path}`;

    const twilio = await import('twilio');

    const isValid = twilio.default.validateRequest(
      authToken,
      signature,
      url,
      (request.body as Record<string, string> | undefined) ?? {},
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    return true;
  }
}
