declare module 'mammoth' {
  export function extractRawText(options: {
    buffer: Buffer;
  }): Promise<{ value: string }>;
}

declare module 'pdf-parse' {
  // HACK: pdf-parse options type is untyped upstream — no published @types/pdf-parse
  function pdfParse(
    buffer: Buffer,
    options?: any, // HACK: untyped upstream
  ): Promise<{
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    text: string;
    version: string;
  }>;
  export default pdfParse;
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(
    client: unknown,
    command: object,
    options?: { expiresIn?: number },
  ): Promise<string>;
}

declare module 'pdf-parse' {
  const pdfParse: (
    buffer: Buffer,
    options?: Record<string, unknown>,
  ) => Promise<{
    text: string;
    info?: { numpages?: number };
  }>;
  export default pdfParse;
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(
    client: unknown,
    command: object,
    options?: { expiresIn?: number },
  ): Promise<string>;
}
