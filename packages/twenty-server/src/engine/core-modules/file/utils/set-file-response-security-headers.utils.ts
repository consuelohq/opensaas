import { type Response } from 'express';

export const FILE_RESPONSE_CONTENT_SECURITY_POLICY =
  "default-src 'none'; sandbox";

export const FILE_RESPONSE_CONTENT_TYPE_OPTIONS = 'nosniff';

export const setFileResponseSecurityHeaders = (response: Response): void => {
  response.setHeader(
    'Content-Security-Policy',
    FILE_RESPONSE_CONTENT_SECURITY_POLICY,
  );
  response.setHeader(
    'X-Content-Type-Options',
    FILE_RESPONSE_CONTENT_TYPE_OPTIONS,
  );
};
