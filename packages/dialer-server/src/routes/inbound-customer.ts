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

const clientAddress = (headers: Headers): string => {
  const cloudflare = headers.get('cf-connecting-ip')?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const direct = headers.get('x-real-ip')?.trim();
  return direct || 'unknown';
};

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
  const routes = new Hono();
  routes.use('/v1/inbound/customer/*', bodyLimit({ maxSize: 8192 }));

  routes.get('/v1/inbound/customer/:publicId', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    if (!entryId) return context.json({ error: 'Invalid customer entry' }, 404);
    try {
      return context.json(await application.snapshot(entryId));
    } catch {
      return context.json({ error: 'Customer entry unavailable' }, 404);
    }
  });

  routes.post('/v1/inbound/customer/:publicId/callbacks', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    const input = callbackRequest(await parseJson(context.req.raw));
    if (!entryId || !input)
      return context.json({ error: 'Invalid callback request' }, 400);
    try {
      const result = await application.requestCallback(
        entryId,
        clientAddress(context.req.raw.headers),
        input,
      );
      return context.json(result, 201);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : '';
      if (message === 'CUSTOMER_CALLBACK_RATE_LIMITED')
        return context.json({ error: 'Too many callback requests' }, 429);
      if (message === 'CUSTOMER_CALLBACK_INVALID')
        return context.json({ error: 'Callback request is unavailable' }, 409);
      return context.json({ error: 'Callback request could not be committed' }, 409);
    }
  });

  routes.get('/v1/inbound/customer/:publicId/callbacks/status', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    const token = managementToken(context.req.header('authorization'));
    if (!entryId || !token)
      return context.json({ error: 'Callback capability required' }, 401);
    try {
      return context.json(await application.readCallback(entryId, token));
    } catch {
      return context.json({ error: 'Callback capability is invalid' }, 401);
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
        return context.json({ error: 'Invalid reschedule request' }, 400);
      try {
        return context.json(
          await application.rescheduleCallback(
            entryId,
            token,
            body.serviceWindowId,
          ),
        );
      } catch {
        return context.json({ error: 'Callback reschedule rejected' }, 409);
      }
    },
  );

  routes.post('/v1/inbound/customer/:publicId/callbacks/cancel', async (context) => {
    const entryId = publicId(context.req.param('publicId'));
    const token = managementToken(context.req.header('authorization'));
    const body = jsonObject(await parseJson(context.req.raw));
    if (!entryId || !token || !body || !exactKeys(body, []))
      return context.json({ error: 'Invalid cancellation request' }, 400);
    try {
      return context.json(await application.cancelCallback(entryId, token));
    } catch {
      return context.json({ error: 'Callback cancellation rejected' }, 409);
    }
  });

  return routes;
};
