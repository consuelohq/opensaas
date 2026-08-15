import type {
  ManagedCloudPlanId,
} from '../../../../scripts/lib/managed-cloud-pricing';
import type { ManagedCloudProvisioningJob } from '../../../../scripts/lib/managed-cloud-provisioning';
import type {
  DeviceAuthorityRuntime,
  ManagedCloudCheckout,
} from '../types';
import { hashHex } from '../utils';
import {
  CLOUD_FIRST_REGION_ID,
  derivedCloudFirstWorkspaceIdentity,
  managedCloudQuoteForPlan,
  normalizeCloudFirstWorkspaceName,
} from './cloud-first-onboarding';
import { buildManagedCloudPublicCatalog } from './managed-cloud-pricing';

export const PAID_CLOUD_FIRST_PLAN_IDS = [
  'performance',
  'power',
  'max',
] as const satisfies readonly ManagedCloudPlanId[];
export const SIGNUP_CLOUD_FIRST_PLAN_IDS = [
  'standard',
  ...PAID_CLOUD_FIRST_PLAN_IDS,
] as const satisfies readonly ManagedCloudPlanId[];

const STRIPE_CHECKOUT_TTL_MS = 30 * 60_000;
const STRIPE_WEBHOOK_TOLERANCE_MS = 5 * 60_000;
const DEFAULT_STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

type PaidCloudFirstPlanId = (typeof PAID_CLOUD_FIRST_PLAN_IDS)[number];

type StripeCheckoutSessionResponse = {
  id?: unknown;
  url?: unknown;
};

type StripeCheckoutSessionEvent = {
  id: string;
  mode: string;
  paymentStatus: string;
  amountTotal: number;
  currency: string;
  clientReferenceId: string;
  customerId: string;
  subscriptionId: string;
  checkoutId: string;
  accountId: string;
  planId: string;
  pricingVersion: string;
};

export class ManagedCloudBillingError extends Error {
  constructor(
    readonly code:
      | 'BILLING_UNAVAILABLE'
      | 'PLAN_INVALID'
      | 'WORKSPACE_NAME_INVALID'
      | 'WORKSPACE_EXISTS'
      | 'CHECKOUT_PENDING'
      | 'CHECKOUT_NOT_FOUND'
      | 'PAYMENT_INVALID',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ManagedCloudBillingError';
  }
}

export function managedCloudBillingConfigured(
  runtime: DeviceAuthorityRuntime,
): boolean {
  return Boolean(
    runtime.stripeSecretKey?.trim() && runtime.stripeWebhookSecret?.trim(),
  );
}

export function managedCloudSignupCatalog(runtime: DeviceAuthorityRuntime) {
  const catalog = buildManagedCloudPublicCatalog(
    runtime.managedCloudPricing,
    CLOUD_FIRST_REGION_ID,
  );
  return {
    pricingAvailable: catalog.pricingAvailable,
    billingConfigured: managedCloudBillingConfigured(runtime),
    quotes: catalog.quotes.filter((quote) =>
      SIGNUP_CLOUD_FIRST_PLAN_IDS.some((planId) => planId === quote.plan.id),
    ),
  };
}

export function isPaidCloudFirstPlanId(
  value: string,
): value is PaidCloudFirstPlanId {
  return PAID_CLOUD_FIRST_PLAN_IDS.includes(value as PaidCloudFirstPlanId);
}

function normalizedStripeApiBaseUrl(runtime: DeviceAuthorityRuntime): string {
  return (
    runtime.stripeApiBaseUrl?.trim() || DEFAULT_STRIPE_API_BASE_URL
  ).replace(/\/+$/, '');
}

function field(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function deterministicCheckoutId(input: {
  accountId: string;
  displayName: string;
  planId: PaidCloudFirstPlanId;
  pricingVersion: string;
  monthlyPriceCents: number;
}): Promise<string> {
  try {
    const digest = await hashHex(
      [
        'consuelo:managed-cloud-checkout:v1',
        input.accountId,
        input.displayName.toLowerCase(),
        input.planId,
        input.pricingVersion,
        String(input.monthlyPriceCents),
      ].join('\n'),
    );
    return `mcc_${digest.slice(0, 28)}`;
  } catch {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
}

async function deterministicProvisioningIds(checkoutId: string): Promise<{
  jobId: string;
  nodeId: string;
}> {
  try {
    const digest = await hashHex(`consuelo:managed-cloud-paid-job:v1:${checkoutId}`);
    return {
      jobId: `mcpj_${digest.slice(0, 28)}`,
      nodeId: `node_${digest.slice(28, 56)}`,
    };
  } catch {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
}

function paidPlan(input: string): PaidCloudFirstPlanId {
  if (!isPaidCloudFirstPlanId(input)) {
    throw new ManagedCloudBillingError(
      'PLAN_INVALID',
      400,
      'Choose a supported paid cloud plan.',
    );
  }
  return input;
}

function validWorkspaceName(value: string): string {
  const displayName = normalizeCloudFirstWorkspaceName(value);
  if (displayName.length < 1 || displayName.length > 80) {
    throw new ManagedCloudBillingError(
      'WORKSPACE_NAME_INVALID',
      400,
      'Workspace names must be between 1 and 80 characters.',
    );
  }
  return displayName;
}

function checkoutResponseUrl(checkout: ManagedCloudCheckout): string | undefined {
  return checkout.stripeCheckoutUrl?.trim() || undefined;
}

async function createStripeCheckoutSession(input: {
  runtime: DeviceAuthorityRuntime;
  checkout: ManagedCloudCheckout;
}): Promise<{ sessionId: string; url: string }> {
  const secret = input.runtime.stripeSecretKey?.trim();
  if (!secret) {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('payment_method_types[0]', 'card');
  body.set('customer_email', input.checkout.email);
  body.set('client_reference_id', input.checkout.checkoutId);
  body.set('expires_at', String(Math.floor(input.checkout.expiresAt / 1000)));
  body.set(
    'success_url',
    `${input.runtime.origin}/onboarding/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  );
  body.set('cancel_url', `${input.runtime.origin}/auth/workspaces?checkout=cancelled`);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', input.checkout.currency.toLowerCase());
  body.set(
    'line_items[0][price_data][unit_amount]',
    String(input.checkout.monthlyPriceCents),
  );
  body.set('line_items[0][price_data][recurring][interval]', 'month');
  body.set(
    'line_items[0][price_data][product_data][name]',
    `Consuelo Cloud ${input.checkout.planId.charAt(0).toUpperCase()}${input.checkout.planId.slice(1)}`,
  );
  const metadata = {
    checkout_id: input.checkout.checkoutId,
    account_id: input.checkout.accountId,
    workspace_id: input.checkout.workspaceId,
    plan_id: input.checkout.planId,
    pricing_version: input.checkout.pricingVersion,
  };
  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`subscription_data[metadata][${key}]`, value);
  }

  let response: Response;
  try {
    response = await input.runtime.fetchImpl(
      `${normalizedStripeApiBaseUrl(input.runtime)}/checkout/sessions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/x-www-form-urlencoded',
          'idempotency-key': input.checkout.checkoutId,
        },
        body: body.toString(),
      },
    );
  } catch {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
  if (!response.ok) {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
  const payload = (await response.json()) as StripeCheckoutSessionResponse;
  const sessionId = field(payload.id);
  const url = field(payload.url);
  if (!sessionId || !url || !url.startsWith('https://')) {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
  return { sessionId, url };
}

export async function startManagedCloudCheckout(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  email: string;
  workspaceName: string;
  planId: string;
}): Promise<ManagedCloudCheckout> {
  try {
    if (!managedCloudBillingConfigured(input.runtime)) {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
  const planId = paidPlan(input.planId);
  const displayName = validWorkspaceName(input.workspaceName);
  const quote = managedCloudQuoteForPlan(input.runtime, planId);
  const identity = await derivedCloudFirstWorkspaceIdentity({
    accountId: input.accountId,
    displayName,
  });
  const nowMs = input.runtime.now();
  const checkoutId = await deterministicCheckoutId({
    accountId: input.accountId,
    displayName,
    planId,
    pricingVersion: quote.pricingVersion,
    monthlyPriceCents: quote.monthlyPriceCents,
  });
  const existingWorkspace = await input.runtime.store.byAccountWorkspace(input.accountId);
  if (existingWorkspace) {
    throw new ManagedCloudBillingError(
      'WORKSPACE_EXISTS',
      409,
      'This account already has a workspace.',
    );
  }
  const active = await input.runtime.store.byAccountManagedCloudCheckout(input.accountId);
  if (active?.status === 'paid') {
    throw new ManagedCloudBillingError(
      'WORKSPACE_EXISTS',
      409,
      'This account already completed cloud checkout.',
    );
  }
  if (active?.status === 'pending' && active.expiresAt > nowMs) {
    if (active.checkoutId !== checkoutId) {
      throw new ManagedCloudBillingError(
        'CHECKOUT_PENDING',
        409,
        'A cloud checkout is already in progress. Finish it before choosing another plan.',
      );
    }
    const url = checkoutResponseUrl(active);
    if (url) return active;
  }

  const candidate: ManagedCloudCheckout = {
    checkoutId,
    accountId: input.accountId,
    email: input.email.trim().toLowerCase(),
    displayName,
    ...identity,
    planId,
    region: CLOUD_FIRST_REGION_ID,
    pricingVersion: quote.pricingVersion,
    monthlyPriceCents: quote.monthlyPriceCents,
    currency: quote.currency,
    status: 'pending',
    createdAt: active?.checkoutId === checkoutId ? active.createdAt : nowMs,
    updatedAt: nowMs,
    expiresAt: nowMs + STRIPE_CHECKOUT_TTL_MS,
  };
  await input.runtime.store.putManagedCloudCheckout(candidate);
  const session = await createStripeCheckoutSession({ runtime: input.runtime, checkout: candidate });
  const updated: ManagedCloudCheckout = {
    ...candidate,
    stripeCheckoutSessionId: session.sessionId,
    stripeCheckoutUrl: session.url,
    updatedAt: input.runtime.now(),
  };
    await input.runtime.store.putManagedCloudCheckout(updated);
    return updated;
  } catch (error: unknown) {
    if (error instanceof ManagedCloudBillingError) throw error;
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
}

function secureHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length || left.length === 0) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function stripeWebhookSignatureHex(secret: string, payload: string): Promise<string> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
    );
    return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 400, 'Invalid Stripe webhook signature.');
  }
}

async function verifyStripeWebhookSignature(input: {
  secret: string;
  header: string;
  payload: string;
  nowMs: number;
}): Promise<boolean> {
  try {
    const parts = input.header.split(',').map((part) => part.trim());
  const timestampRaw = parts.find((part) => part.startsWith('t='))?.slice(2) ?? '';
  const timestamp = Number(timestampRaw);
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));
  if (!Number.isInteger(timestamp) || timestamp <= 0 || signatures.length === 0) return false;
  if (Math.abs(input.nowMs - timestamp * 1000) > STRIPE_WEBHOOK_TOLERANCE_MS) return false;
  const expected = await stripeWebhookSignatureHex(
    input.secret,
    `${timestamp}.${input.payload}`,
  );
    return signatures.some((signature) => secureHexEqual(signature, expected));
  } catch {
    return false;
  }
}

function checkoutSessionEvent(value: unknown): StripeCheckoutSessionEvent | undefined {
  const event = record(value);
  if (field(event.type) !== 'checkout.session.completed') return undefined;
  const session = record(record(event.data).object);
  const metadata = record(session.metadata);
  const amountTotal = session.amount_total;
  if (typeof amountTotal !== 'number' || !Number.isInteger(amountTotal)) return undefined;
  return {
    id: field(session.id),
    mode: field(session.mode),
    paymentStatus: field(session.payment_status),
    amountTotal,
    currency: field(session.currency).toLowerCase(),
    clientReferenceId: field(session.client_reference_id),
    customerId: field(session.customer),
    subscriptionId: field(session.subscription),
    checkoutId: field(metadata.checkout_id),
    accountId: field(metadata.account_id),
    planId: field(metadata.plan_id),
    pricingVersion: field(metadata.pricing_version),
  };
}

async function fulfillPaidManagedCloudCheckout(input: {
  runtime: DeviceAuthorityRuntime;
  event: StripeCheckoutSessionEvent;
}): Promise<ManagedCloudCheckout> {
  try {
    const checkout = await input.runtime.store.byManagedCloudCheckout(input.event.checkoutId);
  if (!checkout) {
    throw new ManagedCloudBillingError('CHECKOUT_NOT_FOUND', 400, 'Checkout was not found.');
  }
  const current = await input.runtime.store.byAccountManagedCloudCheckout(checkout.accountId);
  if (current?.checkoutId !== checkout.checkoutId) {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 409, 'Checkout is no longer active.');
  }
  const exact =
    input.event.id &&
    input.event.mode === 'subscription' &&
    input.event.paymentStatus === 'paid' &&
    input.event.amountTotal === checkout.monthlyPriceCents &&
    input.event.currency === checkout.currency.toLowerCase() &&
    input.event.clientReferenceId === checkout.checkoutId &&
    input.event.checkoutId === checkout.checkoutId &&
    input.event.accountId === checkout.accountId &&
    input.event.planId === checkout.planId &&
    input.event.pricingVersion === checkout.pricingVersion &&
    input.event.customerId &&
    input.event.subscriptionId &&
    (!checkout.stripeCheckoutSessionId || checkout.stripeCheckoutSessionId === input.event.id);
  if (!exact) {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 400, 'Checkout payment did not match the quoted plan.');
  }
  if (checkout.status === 'paid' && checkout.provisioningJobId) return checkout;

  const nowMs = input.runtime.now();
  const existingWorkspace = await input.runtime.store.byAccountWorkspace(checkout.accountId);
  if (existingWorkspace?.workspaceId && existingWorkspace.workspaceId !== checkout.workspaceId) {
    throw new ManagedCloudBillingError('WORKSPACE_EXISTS', 409, 'This account already has a workspace.');
  }
  await input.runtime.store.putAccountWorkspace({
    accountId: checkout.accountId,
    displayName: checkout.displayName,
    workspaceId: checkout.workspaceId,
    workspaceSlug: checkout.workspaceSlug,
    workspaceHost: checkout.workspaceHost,
    updatedAt: nowMs,
  });
  await input.runtime.store.putWorkspaceMembership({
    accountId: checkout.accountId,
    workspaceId: checkout.workspaceId,
    workspaceSlug: checkout.workspaceSlug,
    workspaceHost: checkout.workspaceHost,
    status: 'active',
    createdAt: checkout.createdAt,
    updatedAt: nowMs,
  });

  const ids = await deterministicProvisioningIds(checkout.checkoutId);
  const candidate: ManagedCloudProvisioningJob = {
    jobId: ids.jobId,
    accountId: checkout.accountId,
    workspaceId: checkout.workspaceId,
    workspaceSlug: checkout.workspaceSlug,
    workspaceHost: checkout.workspaceHost,
    nodeId: ids.nodeId,
    nodeName: 'Cloud',
    planId: checkout.planId,
    region: checkout.region,
    pricingVersion: checkout.pricingVersion,
    monthlyPriceCents: checkout.monthlyPriceCents,
    currency: checkout.currency,
    idempotencyKey: `cloud-paid:${checkout.checkoutId}`,
    status: 'requested',
    createdAt: checkout.createdAt,
    updatedAt: nowMs,
  };
  const created = await input.runtime.store.createManagedCloudProvisioningJob(candidate);
  if (created.job.workspaceId !== checkout.workspaceId || created.job.planId !== checkout.planId) {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 409, 'Cloud provisioning state conflicted with checkout.');
  }
  const repository = input.runtime.installControlPlaneRepository;
  if (!repository) {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Consuelo identity is temporarily unavailable.',
    );
  }
  const nowIso = new Date(nowMs).toISOString();
  await repository.upsertUser({
    userId: checkout.accountId,
    email: checkout.email,
    workspaceIds: [checkout.workspaceId],
    workspaceMembershipVerifiedAt: nowIso,
    createdAt: new Date(checkout.createdAt).toISOString(),
    updatedAt: nowIso,
  });

  const paid: ManagedCloudCheckout = {
    ...checkout,
    status: 'paid',
    stripeCheckoutSessionId: input.event.id,
    stripeCustomerId: input.event.customerId,
    stripeSubscriptionId: input.event.subscriptionId,
    provisioningJobId: created.job.jobId,
    paidAt: nowMs,
    updatedAt: nowMs,
  };
    await input.runtime.store.putManagedCloudCheckout(paid);
    return paid;
  } catch (error: unknown) {
    if (error instanceof ManagedCloudBillingError) throw error;
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
}

export async function handleManagedCloudStripeWebhook(input: {
  runtime: DeviceAuthorityRuntime;
  rawBody: string;
  signatureHeader: string;
}): Promise<{ handled: boolean; checkout?: ManagedCloudCheckout }> {
  const secret = input.runtime.stripeWebhookSecret?.trim();
  if (!secret) {
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
  if (
    !(await verifyStripeWebhookSignature({
      secret,
      header: input.signatureHeader,
      payload: input.rawBody,
      nowMs: input.runtime.now(),
    }))
  ) {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 400, 'Invalid Stripe webhook signature.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 400, 'Invalid Stripe webhook payload.');
  }
  const eventType = field(record(parsed).type);
  if (eventType !== 'checkout.session.completed') return { handled: false };
  const event = checkoutSessionEvent(parsed);
  if (!event?.checkoutId) {
    throw new ManagedCloudBillingError('PAYMENT_INVALID', 400, 'Invalid Stripe checkout event.');
  }
  return {
    handled: true,
    checkout: await fulfillPaidManagedCloudCheckout({ runtime: input.runtime, event }),
  };
}

export async function managedCloudCheckoutStatus(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  sessionId: string;
}): Promise<
  | { status: 'pending' | 'expired'; planId: ManagedCloudPlanId }
  | { status: 'paid'; planId: ManagedCloudPlanId; jobId: string }
  | undefined
> {
  try {
    const checkout = await input.runtime.store.byAccountManagedCloudCheckout(input.accountId);
  if (!checkout || checkout.stripeCheckoutSessionId !== input.sessionId) return undefined;
  if (checkout.status === 'paid' && checkout.provisioningJobId) {
    return { status: 'paid', planId: checkout.planId, jobId: checkout.provisioningJobId };
  }
    return {
      status: input.runtime.now() >= checkout.expiresAt ? 'expired' : 'pending',
      planId: checkout.planId,
    };
  } catch (error: unknown) {
    if (error instanceof ManagedCloudBillingError) throw error;
    throw new ManagedCloudBillingError(
      'BILLING_UNAVAILABLE',
      503,
      'Cloud billing is temporarily unavailable.',
    );
  }
}
