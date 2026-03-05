// Route test helper — mock ApiRequest/ApiResponse for testing route handlers
// Simulates authenticated requests with JWT auth context

import type { ApiRequest, ApiResponse, AuthContext } from '../types.js';

type ResponseData = {
  statusCode: number;
  body: unknown;
  contentType?: string;
  rawBody?: string;
};

export interface MockResponse extends ApiResponse {
  _getData: () => ResponseData;
}

/** Default auth context for authenticated test requests */
export const defaultAuthContext: AuthContext = {
  userId: 'user-test-001',
  workspaceId: 'ws-test-001',
  workspaceMemberId: 'wm-test-001',
  userWorkspaceId: 'uws-test-001',
};

/** Create a mock ApiRequest */
export const createMockRequest = (
  overrides?: Partial<ApiRequest> & { auth?: AuthContext },
): ApiRequest => ({
  method: 'GET',
  path: '/',
  headers: {},
  body: undefined,
  query: {},
  params: {},
  ...overrides,
});

/** Create an authenticated mock ApiRequest */
export const createAuthenticatedRequest = (
  overrides?: Partial<ApiRequest>,
): ApiRequest =>
  createMockRequest({
    headers: {
      authorization: 'Bearer mock-jwt-token',
    },
    auth: defaultAuthContext,
    ...overrides,
  });

/** Create a mock ApiResponse that captures status/json calls */
export const createMockResponse = (): MockResponse => {
  const data: ResponseData = {
    statusCode: 200,
    body: undefined,
    contentType: undefined,
    rawBody: undefined,
  };

  const res: MockResponse = {
    status: (code: number) => {
      data.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      data.body = body;
      data.contentType = 'application/json';
    },
    type: (contentType: string) => {
      data.contentType = contentType;
      return res;
    },
    send: (body: string) => {
      data.rawBody = body;
    },
    _getData: () => ({ ...data }),
  };

  return res;
};

/** Execute a route handler with mock req/res and return the response data */
export const executeHandler = async (
  handler: (req: ApiRequest, res: ApiResponse) => Promise<void>,
  request?: Partial<ApiRequest> & { auth?: AuthContext },
): Promise<ResponseData> => {
  const req = request?.auth
    ? createMockRequest(request)
    : createAuthenticatedRequest(request);
  const res = createMockResponse();
  try {
    await handler(req, res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: { code: 'HANDLER_ERROR', message } });
  }
  return res._getData();
};
