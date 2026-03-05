import { authenticatedFetch } from '../authenticatedFetch';

const mockGetTokenPair = jest.fn();

jest.mock('@/apollo/utils/getTokenPair', () => ({
  getTokenPair: (...args: unknown[]) => mockGetTokenPair(...args),
}));

const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: () => ({}) });
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authenticatedFetch', () => {
  it('should set Authorization header from accessOrWorkspaceAgnosticToken', async () => {
    mockGetTokenPair.mockReturnValue({
      accessOrWorkspaceAgnosticToken: { token: 'test-jwt', expiresAt: '' },
      refreshToken: { token: 'refresh', expiresAt: '' },
    });

    await authenticatedFetch('https://example.com/v1/test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.get('Authorization')).toBe('Bearer test-jwt');
    expect(opts.credentials).toBe('include');
  });

  it('should not set Authorization when token pair is undefined', async () => {
    mockGetTokenPair.mockReturnValue(undefined);

    await authenticatedFetch('https://example.com/v1/test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.has('Authorization')).toBe(false);
  });

  it('should forward custom headers and options', async () => {
    mockGetTokenPair.mockReturnValue(undefined);

    await authenticatedFetch('https://example.com/v1/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://example.com/v1/test');
    expect(opts.method).toBe('POST');
    expect(opts.headers.get('Content-Type')).toBe('application/json');
  });
});
