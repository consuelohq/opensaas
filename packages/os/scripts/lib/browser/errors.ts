export class BrowserServiceError extends Error {
  readonly code: 'BROWSER_RUNTIME_MISSING' | 'BROWSER_TIMEOUT' | 'BROWSER_COMMAND_FAILED' | 'BROWSER_INVALID_URL';

  constructor(
    code: BrowserServiceError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'BrowserServiceError';
    this.code = code;
  }
}
