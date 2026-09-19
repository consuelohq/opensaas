import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export type PublicCallbackRequest = {
  phoneNumber: string;
  permissionAccepted: true;
  idempotencyKey: string;
  mode: 'immediate' | 'scheduled';
  serviceWindowId?: string;
};

export type InboundCustomerApplication = {
  snapshot: (publicId: string) => Promise<unknown>;
  requestCallback: (
    publicId: string,
    clientAddress: string,
    input: PublicCallbackRequest,
  ) => Promise<unknown>;
  readCallback: (publicId: string, managementToken: string) => Promise<unknown>;
  rescheduleCallback: (
    publicId: string,
    managementToken: string,
    serviceWindowId: string,
  ) => Promise<unknown>;
  cancelCallback: (publicId: string, managementToken: string) => Promise<unknown>;
};

export type InboundCustomerBindings = {
  readonly clientAddress?: string;
  readonly trustedClientIdentity?: boolean;
};

const jsonObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const publicId = (value: string): string | null =>
  /^[A-Za-z0-9_.:-]{1,160}$/.test(value) ? value : null;

const managementToken = (authorization: string | undefined): string | null => {
  const match = authorization?.match(/^Callback ([A-Za-z0-9._~-]{20,2048})$/);
  return match?.[1] ?? null;
};

const clientAddress = (value: string | undefined): string =>
  value?.trim() || 'unknown';

const normalizePhone = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\+?[0-9().\-\s]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    const normalized = `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
};

const callbackRequest = (value: unknown): PublicCallbackRequest | null => {
  const input = jsonObject(value);
  const rawPhoneNumber = input?.phoneNumber;
  if (
    !input ||
    !exactKeys(input, [
      'phoneNumber',
      'permissionAccepted',
      'idempotencyKey',
      'mode',
      'serviceWindowId',
    ]) ||
    typeof rawPhoneNumber !== 'string' ||
    input.permissionAccepted !== true ||
    typeof input.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9_.:-]{8,128}$/.test(input.idempotencyKey) ||
    (input.mode !== 'immediate' && input.mode !== 'scheduled')
  )
    return null;
  const phoneNumber = normalizePhone(rawPhoneNumber);
  if (!phoneNumber) return null;
  if (input.mode === 'scheduled') {
    if (
      typeof input.serviceWindowId !== 'string' ||
      !/^[A-Za-z0-9._~-]{8,512}$/.test(input.serviceWindowId)
    )
      return null;
  } else if (input.serviceWindowId !== undefined) return null;
  return {
    phoneNumber,
    permissionAccepted: true,
    idempotencyKey: input.idempotencyKey,
    mode: input.mode,
    ...(input.serviceWindowId === undefined
      ? {}
      : { serviceWindowId: input.serviceWindowId }),
  };
};

const parseJson = async (request: Request): Promise<unknown | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const createInboundCustomerRoutes = (
  application: InboundCustomerApplication,
) => {
  const error = (code: string, message: string, retryable: boolean) => ({
    error: { code, message, retryable },
  });
  const routes = new Hono<{ Bindings: InboundCustomerBindings }>();
  routes.use('/v1/inbound/customer/*', bodyLimit({ maxSize: 8192 }));

  routes.get('/v1/inbound/customer/:publicId', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    if (!entryId)
      return context.json(
        error('INVALID_CUSTOMER_ENTRY', 'Invalid customer entry', false),
        404,
      );
    try {
      return context.json(await application.snapshot(entryId));
    } catch {
      return context.json(
        error('CUSTOMER_ENTRY_UNAVAILABLE', 'Customer entry unavailable', true),
        404,
      );
    }
  });

  routes.post('/v1/inbound/customer/:publicId/callbacks', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    const input = callbackRequest(await parseJson(context.req.raw));
    if (!entryId || !input)
      return context.json(
        error('INVALID_CALLBACK_REQUEST', 'Invalid callback request', false),
        400,
      );
    if (context.env?.trustedClientIdentity === false)
      return context.json(
        error(
          'EDGE_PROXY_UNAVAILABLE',
          'Customer callback service is temporarily unavailable',
          true,
        ),
        503,
      );
    try {
      const result = await application.requestCallback(
        entryId,
        clientAddress(context.env?.clientAddress),
        input,
      );
      return context.json(result, 201);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : '';
      if (message === 'CUSTOMER_CALLBACK_RATE_LIMITED')
        return context.json(
          error(
            'CUSTOMER_CALLBACK_RATE_LIMITED',
            'Too many callback requests',
            true,
          ),
          429,
        );
      if (message === 'CUSTOMER_CALLBACK_INVALID')
        return context.json(
          error(
            'CUSTOMER_CALLBACK_UNAVAILABLE',
            'Callback request is unavailable',
            false,
          ),
          409,
        );
      return context.json(
        error(
          'CUSTOMER_CALLBACK_COMMIT_FAILED',
          'Callback request could not be committed',
          true,
        ),
        409,
      );
    }
  });

  routes.get('/v1/inbound/customer/:publicId/callbacks/status', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    const token = managementToken(context.req.header('authorization'));
    if (!entryId || !token)
      return context.json(
        error(
          'CALLBACK_CAPABILITY_REQUIRED',
          'Callback capability required',
          false,
        ),
        401,
      );
    try {
      return context.json(await application.readCallback(entryId, token));
    } catch {
      return context.json(
        error(
          'CALLBACK_CAPABILITY_INVALID',
          'Callback capability is invalid',
          false,
        ),
        401,
      );
    }
  });

  routes.post(
    '/v1/inbound/customer/:publicId/callbacks/reschedule',
    async (context) => {
      const entryId = publicId(context.req.param('publicId'));
      const token = managementToken(context.req.header('authorization'));
      const body = jsonObject(await parseJson(context.req.raw));
      if (
        !entryId ||
        !token ||
        !body ||
        !exactKeys(body, ['serviceWindowId']) ||
        typeof body.serviceWindowId !== 'string' ||
        !/^[A-Za-z0-9._~-]{8,512}$/.test(body.serviceWindowId)
      )
        return context.json(
          error(
            'INVALID_CALLBACK_RESCHEDULE',
            'Invalid reschedule request',
            false,
          ),
          400,
        );
      try {
        return context.json(
          await application.rescheduleCallback(
            entryId,
            token,
            body.serviceWindowId,
          ),
        );
      } catch {
        return context.json(
          error(
            'CALLBACK_RESCHEDULE_REJECTED',
            'Callback reschedule rejected',
            false,
          ),
          409,
        );
      }
    },
  );

  routes.post('/v1/inbound/customer/:publicId/callbacks/cancel', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    const token = managementToken(context.req.header('authorization'));
    const body = jsonObject(await parseJson(context.req.raw));
    if (!entryId || !token || !body || !exactKeys(body, []))
      return context.json(
        error(
          'INVALID_CALLBACK_CANCELLATION',
          'Invalid cancellation request',
          false,
        ),
        400,
      );
    try {
      return context.json(await application.cancelCallback(entryId, token));
    } catch {
      return context.json(
        error(
          'CALLBACK_CANCELLATION_REJECTED',
          'Callback cancellation rejected',
          false,
        ),
        409,
      );
    }
  });

  return routes;
};
