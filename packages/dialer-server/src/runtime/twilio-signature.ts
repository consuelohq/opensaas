import type { TwilioSignatureInput } from '../contracts';

export const createTwilioSignatureVerifier =
  (authToken: string) =>
  async (input: TwilioSignatureInput): Promise<boolean> => {
    try {
      const twilio = await import('twilio');
      return input.contentType.toLowerCase().includes('application/json')
        ? twilio.validateRequestWithBody(
            authToken,
            input.signature,
            input.url,
            input.rawBody,
          )
        : twilio.validateRequest(
            authToken,
            input.signature,
            input.url,
            input.params,
          );
    } catch (error: unknown) {
      throw new Error('Twilio signature verification failed', { cause: error });
    }
  };
