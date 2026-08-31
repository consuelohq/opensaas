import { DialerRequestError } from '@consuelo/dialer';

import type {
  DialerIdentity,
  LeadConnectorServerApplication,
} from './contracts';
import { normalizeAsyncError } from './errors/normalize-async-error';
import { runApplicationEffect } from './effect-runner';

type CommercialCallInput = Record<string, unknown>;

const targetAuthorizationError = () =>
  new DialerRequestError({
    code: 'CALL_TARGET_NOT_AUTHORIZED',
    message: 'Call target could not be authorized',
    retryable: false,
  });

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = readString(item);
        return parsed ? [parsed] : [];
      })
    : [];

const resolveContact = async (
  leadConnector: LeadConnectorServerApplication,
  identity: DialerIdentity,
  contactId: string,
) => {
  try {
    if (!leadConnector.getContact) throw targetAuthorizationError();
    const result = await runApplicationEffect(
      leadConnector.getContact({
        workspaceId: identity.workspaceId,
        contactId,
      }),
    );
    if (!result.ok) throw targetAuthorizationError();
    const phone = result.value.phone?.trim();
    if (!phone || !result.value.id) throw targetAuthorizationError();
    return { contactId: result.value.id, phone };
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};

const resolveContactIds = async (
  leadConnector: LeadConnectorServerApplication,
  identity: DialerIdentity,
  contactIds: string[],
) => {
  try {
    if (contactIds.length === 0) throw targetAuthorizationError();
    const targets: Array<{ contactId: string; phone: string }> = [];
    for (const contactId of contactIds) {
      targets.push(await resolveContact(leadConnector, identity, contactId));
    }
    return targets;
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};

const readQueueCoordinates = (input: CommercialCallInput) => {
  const pipelineId = readString(input.pipelineId);
  const stageId = readString(input.stageId);
  if (pipelineId && stageId) return { pipelineId, stageId };

  const queueId = readString(input.queueId);
  if (!queueId) return null;
  const [parsedPipelineId, parsedStageId, ...rest] = queueId.split(':');
  return parsedPipelineId && parsedStageId && rest.length === 0
    ? { pipelineId: parsedPipelineId, stageId: parsedStageId }
    : null;
};

export const resolveCommercialCallTargetInput = async (
  input: CommercialCallInput,
  identity: DialerIdentity,
  leadConnector: LeadConnectorServerApplication | undefined,
): Promise<CommercialCallInput> => {
  try {
    if (!leadConnector) throw targetAuthorizationError();

    if (input.source === 'direct') {
      const contactId = readString(input.contactId);
      if (!contactId) throw targetAuthorizationError();
      const [target] = await resolveContactIds(leadConnector, identity, [
        contactId,
      ]);
      return {
        ...input,
        contactId: target.contactId,
        targetPhone: target.phone,
        targetPhones: undefined,
      };
    }

    if (input.source !== 'queue') throw targetAuthorizationError();

    const coordinates = readQueueCoordinates(input);
    if (coordinates) {
      const preview = await runApplicationEffect(
        leadConnector.resolveQueueCandidates({
          workspaceId: identity.workspaceId,
          pipelineId: coordinates.pipelineId,
          stageId: coordinates.stageId,
        }),
      );
      if (!preview.ok) throw targetAuthorizationError();

      const candidatesByContactId = new Map(
        preview.value.candidates
          .filter((candidate) => candidate.contactId && candidate.phone?.trim())
          .map((candidate) => [
            candidate.contactId,
            { contactId: candidate.contactId, phone: candidate.phone.trim() },
          ]),
      );
      const requestedContactIds = readStringArray(input.contactIds);
      const selectedContactIds =
        requestedContactIds.length > 0
          ? requestedContactIds
          : [...candidatesByContactId.keys()];
      const targets = selectedContactIds.map((contactId) =>
        candidatesByContactId.get(contactId),
      );
      if (targets.some((target) => !target)) throw targetAuthorizationError();
      const resolvedTargets = targets.filter(
        (target): target is { contactId: string; phone: string } =>
          target !== undefined,
      );
      if (resolvedTargets.length === 0) throw targetAuthorizationError();
      return {
        ...input,
        queueId: coordinates.pipelineId + ':' + coordinates.stageId,
        pipelineId: coordinates.pipelineId,
        stageId: coordinates.stageId,
        contactIds: resolvedTargets.map((target) => target.contactId),
        targetPhones: resolvedTargets.map((target) => target.phone),
      };
    }

    const targets = await resolveContactIds(
      leadConnector,
      identity,
      readStringArray(input.contactIds),
    );
    return {
      ...input,
      contactIds: targets.map((target) => target.contactId),
      targetPhones: targets.map((target) => target.phone),
    };
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};
