import { Effect } from 'effect';

import type {
  LeadConnectorWebhookEvent,
  LeadConnectorWebhookEventType,
} from '../contracts/index.js';
import {
  LeadConnectorInstallationNotFoundError,
  LeadConnectorStateError,
  LeadConnectorWebhookPayloadError,
  LeadConnectorWebhookSignatureError,
  errorMessage,
} from '../errors.js';
import {
  LeadConnectorInstallationStore,
  LeadConnectorWebhookEventStore,
  LeadConnectorWebhookVerifier,
} from '../ports/index.js';
import { asRecord, readNumber, readString } from './provider.js';

const eventTypeMap: Record<string, LeadConnectorWebhookEventType> = {
  ContactCreate: 'contact.created',
  ContactDelete: 'contact.deleted',
  ContactUpdate: 'contact.updated',
  UNINSTALL: 'installation.uninstalled',
  OpportunityCreate: 'opportunity.created',
  OpportunityDelete: 'opportunity.deleted',
  OpportunityUpdate: 'opportunity.updated',
};

const hashBody = (body: string) =>
  Effect.tryPromise({
    try: async () => {
      try {
        return Buffer.from(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)),
        ).toString('hex');
      } catch (cause: unknown) {
        throw new Error('Failed to derive the webhook idempotency key', {
          cause,
        });
      }
    },
    catch: (cause) =>
      new LeadConnectorStateError({
        operation: 'hash-webhook',
        message: errorMessage(cause),
        retryable: true,
        cause,
      }),
  });

const parsePayload = (rawBody: string) =>
  Effect.try({
    try: () => JSON.parse(rawBody) as unknown,
    catch: () =>
      new LeadConnectorWebhookPayloadError({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'LeadConnector webhook payload is invalid',
        retryable: false,
      }),
  });

const translatePayload = (
  payload: Record<string, unknown>,
  eventId: string,
  workspaceId: string,
  locationId: string,
): Effect.Effect<LeadConnectorWebhookEvent, LeadConnectorWebhookPayloadError> =>
  Effect.gen(function* () {
    const eventData = { ...asRecord(payload.data), ...payload };
    const providerType = readString(eventData, 'type');
    const type = providerType ? eventTypeMap[providerType] : undefined;
    if (!type) {
      return yield* Effect.fail(
        new LeadConnectorWebhookPayloadError({
          code: 'UNSUPPORTED_WEBHOOK_EVENT',
          message: 'LeadConnector webhook event is not supported',
          retryable: false,
        }),
      );
    }
    const occurredAt = readString(
      eventData,
      'timestamp',
      'occurredAt',
      'dateAdded',
      'dateUpdated',
    );
    if (type === 'installation.uninstalled') {
      return {
        id: eventId,
        type,
        workspaceId,
        locationId,
        occurredAt,
        data: { appId: readString(eventData, 'appId') },
      };
    }
    if (type.startsWith('opportunity.')) {
      const monetaryValue = readNumber(eventData, 'monetaryValue');
      return {
        id: eventId,
        type,
        workspaceId,
        locationId,
        occurredAt,
        data: {
          opportunityId: readString(eventData, 'id', 'opportunityId'),
          contactId: readString(eventData, 'contactId'),
          pipelineId: readString(eventData, 'pipelineId'),
          stageId: readString(eventData, 'pipelineStageId', 'stageId'),
          status: readString(eventData, 'status'),
          ...(monetaryValue === null ? {} : { monetaryValue }),
        },
      };
    }
    return {
      id: eventId,
      type,
      workspaceId,
      locationId,
      occurredAt,
      data: {
        contactId: readString(eventData, 'id', 'contactId'),
        email: readString(eventData, 'email'),
        phone: readString(eventData, 'phone'),
        firstName: readString(eventData, 'firstName'),
        lastName: readString(eventData, 'lastName'),
      },
    };
  });

export const processLeadConnectorWebhook = (input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
}) =>
  Effect.gen(function* () {
    const verifier = yield* LeadConnectorWebhookVerifier;
    const valid = yield* verifier.verify(input);
    if (!valid) {
      return yield* Effect.fail(
        new LeadConnectorWebhookSignatureError({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'LeadConnector webhook signature is invalid',
          retryable: false,
        }),
      );
    }
    const payload = asRecord(yield* parsePayload(input.rawBody));
    const locationId = readString(payload, 'locationId');
    if (!locationId) {
      return yield* Effect.fail(
        new LeadConnectorWebhookPayloadError({
          code: 'INVALID_WEBHOOK_PAYLOAD',
          message: 'LeadConnector webhook location is missing',
          retryable: false,
        }),
      );
    }
    const installations = yield* LeadConnectorInstallationStore;
    const installation = yield* installations.getByLocationId(locationId);
    if (!installation) {
      return yield* Effect.fail(
        new LeadConnectorInstallationNotFoundError({
          locationId,
          message: 'LeadConnector installation not found',
          retryable: false,
        }),
      );
    }
    const eventId =
      readString(payload, 'webhookId', 'eventId') ??
      `payload-${yield* hashBody(input.rawBody)}`;
    const event = yield* translatePayload(
      payload,
      eventId,
      installation.workspaceId,
      locationId,
    );
    const events = yield* LeadConnectorWebhookEventStore;
    const claimed = yield* events.claim(eventId);
    if (!claimed) {
      return {
        accepted: true as const,
        duplicate: true,
        workspaceId: installation.workspaceId,
        event,
      };
    }
    return {
      accepted: true as const,
      duplicate: false,
      workspaceId: installation.workspaceId,
      event,
    };
  });
