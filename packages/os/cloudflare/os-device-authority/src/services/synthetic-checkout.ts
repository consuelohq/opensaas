import type { ManagedCloudPlanId } from '../../../../scripts/lib/managed-cloud-pricing';
import type { DeviceAuthorityRuntime } from '../types';
import { rand } from '../utils';
import { managedCloudQuoteForPlan } from './cloud-first-onboarding';
import {
  isPaidCloudFirstPlanId,
  verifyStripeWebhookSignature,
} from './managed-cloud-billing';

const DEFAULT_STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

type StripeSyntheticCheckoutResponse = {
  id?: unknown;
  url?: unknown;
  payment_status?: unknown;
  status?: unknown;
  metadata?: unknown;
};

type StripeSyntheticMetadata = {
  synthetic?: unknown;
  synthetic_account_id?: unknown;
  plan_id?: unknown;
  run_id?: unknown;
};

export class SyntheticCheckoutError extends Error {
  constructor(
    readonly code:
      | 'SYNTHETIC_UNAVAILABLE'
      | 'SYNTHETIC_FORBIDDEN'
      | 'SYNTHETIC_INVALID'
      | 'SYNTHETIC_STRIPE_FAILED',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SyntheticCheckoutError';
  }
}

function field(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function allowedAccountIds(runtime: DeviceAuthorityRuntime): Set<string> {
  return new Set(
    (runtime.stripeSyntheticAccountIds ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function allowedWorkspaceIds(runtime: DeviceAuthorityRuntime): Set<string> {
  return new Set(
    (runtime.stripeSyntheticWorkspaceIds ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export async function syntheticCheckoutAllowed(
  runtime: DeviceAuthorityRuntime,
  accountId: string,
): Promise<boolean> {
  if (!accountId) return false;
  if (allowedAccountIds(runtime).has(accountId)) return true;
  const workspaceIds = allowedWorkspaceIds(runtime);
  if (workspaceIds.size === 0) return false;
  try {
    const memberships = await runtime.store.listWorkspaceMemberships(accountId);
    return memberships.some(
      (membership) =>
        membership.status === 'active' && workspaceIds.has(membership.workspaceId),
    );
  } catch {
    return false;
  }
}

export function syntheticCheckoutConfigured(runtime: DeviceAuthorityRuntime): boolean {
  return Boolean(
    runtime.stripeSyntheticSecretKey?.trim() &&
      runtime.stripeSyntheticWebhookSecret?.trim() &&
      (allowedAccountIds(runtime).size > 0 || allowedWorkspaceIds(runtime).size > 0),
  );
}

async function assertAllowed(runtime: DeviceAuthorityRuntime, accountId: string): Promise<void> {
  try {
    if (await syntheticCheckoutAllowed(runtime, accountId)) return;
  } catch {
    // Synthetic authorization fails closed on any unexpected membership error.
  }
  throw new SyntheticCheckoutError('SYNTHETIC_FORBIDDEN', 404, 'Not found.');
}

function stripeApiBase(runtime: DeviceAuthorityRuntime): string {
  return (runtime.stripeApiBaseUrl?.trim() || DEFAULT_STRIPE_API_BASE_URL).replace(/\/+$/, '');
}

function syntheticSecret(runtime: DeviceAuthorityRuntime): string {
  const value = runtime.stripeSyntheticSecretKey?.trim();
  if (!value) {
    throw new SyntheticCheckoutError(
      'SYNTHETIC_UNAVAILABLE',
      503,
      'Synthetic checkout is unavailable.',
    );
  }
  return value;
}

function safePlanId(value: string): ManagedCloudPlanId {
  if (!isPaidCloudFirstPlanId(value)) {
    throw new SyntheticCheckoutError('SYNTHETIC_INVALID', 400, 'Choose a supported paid plan.');
  }
  return value;
}

export async function startSyntheticStripeCheckout(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  planId: string;
}): Promise<{ sessionId: string; url: string; runId: string }> {
  try {
    await assertAllowed(input.runtime, input.accountId);
  } catch (error: unknown) {
    if (error instanceof SyntheticCheckoutError) throw error;
    throw new SyntheticCheckoutError('SYNTHETIC_FORBIDDEN', 404, 'Not found.');
  }
  const planId = safePlanId(input.planId);
  const quote = managedCloudQuoteForPlan(input.runtime, planId);
  const secret = syntheticSecret(input.runtime);
  const runId = rand('syn', 18);
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('payment_method_types[0]', 'card');
  body.set('client_reference_id', runId);
  body.set(
    'success_url',
    `${input.runtime.origin}/auth/synthetic/checkout/result?session_id={CHECKOUT_SESSION_ID}`,
  );
  body.set('cancel_url', `${input.runtime.origin}/auth/synthetic/checkout?checkout=cancelled`);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', quote.currency.toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(quote.monthlyPriceCents));
  body.set('line_items[0][price_data][recurring][interval]', 'month');
  body.set(
    'line_items[0][price_data][product_data][name]',
    `Consuelo Cloud ${planId.charAt(0).toUpperCase()}${planId.slice(1)} (Synthetic)`,
  );
  const metadata = {
    synthetic: 'true',
    synthetic_account_id: input.accountId,
    plan_id: planId,
    run_id: runId,
    pricing_version: quote.pricingVersion,
  };
  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`subscription_data[metadata][${key}]`, value);
  }

  const startedAt = input.runtime.now();
  let response: Response;
  try {
    response = await input.runtime.fetchImpl(`${stripeApiBase(input.runtime)}/checkout/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': runId,
      },
      body: body.toString(),
    });
  } catch (error: unknown) {
    await input.runtime.checkoutObservability?.captureException(error, {
      name: 'checkout_synthetic_failed',
      accountId: input.accountId,
      planId,
      pricingVersion: quote.pricingVersion,
      monthlyPriceCents: quote.monthlyPriceCents,
      currency: quote.currency,
      synthetic: true,
      outcome: 'error',
      errorCode: 'SYNTHETIC_STRIPE_FAILED',
      durationMs: input.runtime.now() - startedAt,
    });
    throw new SyntheticCheckoutError(
      'SYNTHETIC_STRIPE_FAILED',
      503,
      'Synthetic Stripe checkout failed.',
    );
  }
  if (!response.ok) {
    const error = new Error(`Stripe sandbox checkout HTTP ${response.status}`);
    await input.runtime.checkoutObservability?.captureException(error, {
      name: 'checkout_synthetic_failed',
      accountId: input.accountId,
      planId,
      pricingVersion: quote.pricingVersion,
      monthlyPriceCents: quote.monthlyPriceCents,
      currency: quote.currency,
      synthetic: true,
      outcome: 'error',
      errorCode: 'SYNTHETIC_STRIPE_FAILED',
      durationMs: input.runtime.now() - startedAt,
    });
    throw new SyntheticCheckoutError(
      'SYNTHETIC_STRIPE_FAILED',
      503,
      'Synthetic Stripe checkout failed.',
    );
  }
  const payload = (await response.json()) as StripeSyntheticCheckoutResponse;
  const sessionId = field(payload.id);
  const url = field(payload.url);
  if (!sessionId || !url.startsWith('https://')) {
    throw new SyntheticCheckoutError('SYNTHETIC_STRIPE_FAILED', 503, 'Synthetic Stripe response was invalid.');
  }
  await input.runtime.checkoutObservability?.observe({
    name: 'checkout_synthetic_session_created',
    accountId: input.accountId,
    stripeSessionId: sessionId,
    planId,
    pricingVersion: quote.pricingVersion,
    monthlyPriceCents: quote.monthlyPriceCents,
    currency: quote.currency,
    synthetic: true,
    outcome: 'success',
    durationMs: input.runtime.now() - startedAt,
  });
  return { sessionId, url, runId };
}

export async function readSyntheticCheckoutSession(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  sessionId: string;
}): Promise<{
  paymentStatus: string;
  status: string;
  planId: string;
  runId: string;
}> {
  await assertAllowed(input.runtime, input.accountId);
  const sessionId = input.sessionId.trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    throw new SyntheticCheckoutError('SYNTHETIC_INVALID', 400, 'Invalid checkout session.');
  }
  try {
    const response = await input.runtime.fetchImpl(
      `${stripeApiBase(input.runtime)}/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { authorization: `Bearer ${syntheticSecret(input.runtime)}` } },
    );
    if (!response.ok) {
      throw new SyntheticCheckoutError(
        'SYNTHETIC_STRIPE_FAILED',
        503,
        'Synthetic Stripe lookup failed.',
      );
    }
    const payload = (await response.json()) as StripeSyntheticCheckoutResponse;
    const metadata = record(payload.metadata) as StripeSyntheticMetadata;
    if (
      field(metadata.synthetic) !== 'true' ||
      field(metadata.synthetic_account_id) !== input.accountId
    ) {
      throw new SyntheticCheckoutError('SYNTHETIC_FORBIDDEN', 404, 'Not found.');
    }
    return {
      paymentStatus: field(payload.payment_status),
      status: field(payload.status),
      planId: field(metadata.plan_id),
      runId: field(metadata.run_id),
    };
  } catch (error: unknown) {
    if (error instanceof SyntheticCheckoutError) throw error;
    await input.runtime.checkoutObservability?.captureException(error, {
      name: 'checkout_synthetic_failed',
      accountId: input.accountId,
      stripeSessionId: sessionId,
      synthetic: true,
      outcome: 'error',
      errorCode: 'SYNTHETIC_STRIPE_FAILED',
    });
    throw new SyntheticCheckoutError(
      'SYNTHETIC_STRIPE_FAILED',
      503,
      'Synthetic Stripe lookup failed.',
    );
  }
}

export async function handleSyntheticStripeWebhook(input: {
  runtime: DeviceAuthorityRuntime;
  rawBody: string;
  signatureHeader: string;
}): Promise<{ handled: boolean; paymentStatus?: string; planId?: string; runId?: string }> {
  const secret = input.runtime.stripeSyntheticWebhookSecret?.trim();
  if (!secret) {
    throw new SyntheticCheckoutError('SYNTHETIC_UNAVAILABLE', 503, 'Synthetic checkout is unavailable.');
  }
  if (!(await verifyStripeWebhookSignature({
    secret,
    header: input.signatureHeader,
    payload: input.rawBody,
    nowMs: input.runtime.now(),
  }))) {
    throw new SyntheticCheckoutError('SYNTHETIC_INVALID', 400, 'Invalid synthetic Stripe signature.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new SyntheticCheckoutError('SYNTHETIC_INVALID', 400, 'Invalid synthetic Stripe payload.');
  }
  const event = record(parsed);
  const stripeEventId = field(event.id);
  if (field(event.type) !== 'checkout.session.completed') return { handled: false };
  const session = record(record(event.data).object);
  const metadata = record(session.metadata);
  if (field(metadata.synthetic) !== 'true') return { handled: false };
  const accountId = field(metadata.synthetic_account_id);
  const planId = field(metadata.plan_id);
  const runId = field(metadata.run_id);
  const paymentStatus = field(session.payment_status);
  await input.runtime.checkoutObservability?.observe({
    name: 'checkout_synthetic_completed',
    accountId,
    stripeSessionId: field(session.id),
    planId,
    synthetic: true,
    outcome: paymentStatus === 'paid' ? 'success' : 'error',
    errorCode: paymentStatus === 'paid' ? undefined : 'SYNTHETIC_PAYMENT_NOT_PAID',
    dedupeKey: stripeEventId ? `stripe:${stripeEventId}:checkout_synthetic_completed` : undefined,
  });
  return { handled: true, paymentStatus, planId, runId };
}
