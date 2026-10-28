import type { TwilioSignatureInput } from '../contracts';

export const createTwilioSignatureVerifier = (
  authToken: string,
  publicUrl?: string,
) => {
  const configured = publicUrl ? new URL(publicUrl) : undefined;
  if (
    configured &&
    (configured.protocol !== 'https:' ||
      configured.pathname !== '/' ||
      configured.search ||
      configured.hash ||
      configured.username ||
      configured.password)
  ) {
    throw new Error('Twilio public URL must be an HTTPS origin');
  }

  return async (input: TwilioSignatureInput): Promise<boolean> => {
    try {
      // A later proxy may replace forwarded authority; the deployment owns this origin.
      const observed = new URL(input.url);
      const url = configured
        ? `${configured.origin}${observed.pathname}${observed.search}`
        : input.url;
      const twilio = await import('twilio');
      return input.contentType.toLowerCase().includes('application/json')
        ? twilio.validateRequestWithBody(
            authToken,
            input.signature,
            url,
            input.rawBody,
          )
        : twilio.validateRequest(authToken, input.signature, url, input.params);
    } catch (error: unknown) {
      throw new Error('Twilio signature verification failed', { cause: error });
    }
  };
};
