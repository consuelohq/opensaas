import { Effect } from 'effect';

import type {
  LeadConnectorContact,
  LeadConnectorOpportunity,
  LeadConnectorPipeline,
} from '../contracts/index.js';
import { LeadConnectorInstallationNotFoundError } from '../errors.js';
import { LeadConnectorInstallationStore } from '../ports/index.js';
import {
  asRecord,
  providerHeaders,
  providerUrl,
  readNumber,
  readString,
  requestLeadConnector,
} from './provider.js';
import { getValidLeadConnectorAccessToken } from './tokens.js';

const getProviderContext = (workspaceId: string) =>
  Effect.gen(function* () {
    const store = yield* LeadConnectorInstallationStore;
    const installation = yield* store.getByWorkspaceId(workspaceId);
    if (!installation) {
      return yield* Effect.fail(
        new LeadConnectorInstallationNotFoundError({
          workspaceId,
          message: 'LeadConnector installation not found',
          retryable: false,
        }),
      );
    }
    const accessToken = yield* getValidLeadConnectorAccessToken(workspaceId);
    return { installation, accessToken };
  });

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const mapContact = (value: unknown): LeadConnectorContact => {
  const record = asRecord(value);
  return {
    id: readString(record, 'id') ?? '',
    firstName: readString(record, 'firstName', 'first_name'),
    lastName: readString(record, 'lastName', 'last_name'),
    name: readString(record, 'name'),
    email: readString(record, 'email'),
    phone: readString(record, 'phone'),
    tags: stringArray(record.tags),
  };
};

const mapOpportunity = (value: unknown): LeadConnectorOpportunity => {
  const record = asRecord(value);
  return {
    id: readString(record, 'id') ?? '',
    name: readString(record, 'name') ?? '',
    contactId: readString(record, 'contactId', 'contact_id'),
    pipelineId: readString(record, 'pipelineId', 'pipeline_id'),
    stageId: readString(
      record,
      'pipelineStageId',
      'pipeline_stage_id',
      'stageId',
    ),
    status: readString(record, 'status'),
    monetaryValue: readNumber(record, 'monetaryValue', 'monetary_value'),
  };
};

const mapPipeline = (value: unknown): LeadConnectorPipeline => {
  const record = asRecord(value);
  const stages = Array.isArray(record.stages) ? record.stages : [];
  return {
    id: readString(record, 'id') ?? '',
    name: readString(record, 'name') ?? '',
    stages: stages.map((stage, index) => {
      const stageRecord = asRecord(stage);
      return {
        id: readString(stageRecord, 'id') ?? '',
        name: readString(stageRecord, 'name') ?? '',
        position:
          readNumber(stageRecord, 'position', 'stageOrder', 'stage_order') ??
          index,
      };
    }),
  };
};

export const listLeadConnectorContacts = (input: {
  workspaceId: string;
  query?: string;
  limit?: number;
  cursor?: string;
}) =>
  Effect.gen(function* () {
    const { installation, accessToken } = yield* getProviderContext(
      input.workspaceId,
    );
    const url = new URL(yield* providerUrl('/contacts/'));
    url.searchParams.set('locationId', installation.locationId);
    if (input.query) url.searchParams.set('query', input.query);
    if (input.limit) url.searchParams.set('limit', String(input.limit));
    if (input.cursor) url.searchParams.set('startAfterId', input.cursor);
    const response = yield* requestLeadConnector(
      {
        method: 'GET',
        url: url.toString(),
        headers: providerHeaders(accessToken),
      },
      'list-contacts',
    );
    const body = asRecord(response.body);
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];
    const meta = asRecord(body.meta);
    return {
      contacts: contacts.map(mapContact),
      total: readNumber(meta, 'total') ?? contacts.length,
      nextCursor: readString(meta, 'nextPageUrl', 'nextCursor'),
    };
  });

export const searchLeadConnectorOpportunities = (input: {
  workspaceId: string;
  query?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string;
  limit?: number;
}) =>
  Effect.gen(function* () {
    const { installation, accessToken } = yield* getProviderContext(
      input.workspaceId,
    );
    const response = yield* requestLeadConnector(
      {
        method: 'POST',
        url: yield* providerUrl('/opportunities/search'),
        headers: providerHeaders(accessToken),
        body: {
          locationId: installation.locationId,
          ...(input.query ? { query: input.query } : {}),
          ...(input.pipelineId ? { pipelineId: input.pipelineId } : {}),
          ...(input.stageId ? { pipelineStageId: input.stageId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.limit ? { limit: input.limit } : {}),
        },
      },
      'search-opportunities',
    );
    const body = asRecord(response.body);
    const opportunities = Array.isArray(body.opportunities)
      ? body.opportunities
      : [];
    const meta = asRecord(body.meta);
    return {
      opportunities: opportunities.map(mapOpportunity),
      total: readNumber(meta, 'total') ?? opportunities.length,
    };
  });

export const listLeadConnectorPipelines = (workspaceId: string) =>
  Effect.gen(function* () {
    const { installation, accessToken } =
      yield* getProviderContext(workspaceId);
    const url = new URL(yield* providerUrl('/opportunities/pipelines'));
    url.searchParams.set('locationId', installation.locationId);
    const response = yield* requestLeadConnector(
      {
        method: 'GET',
        url: url.toString(),
        headers: providerHeaders(accessToken),
      },
      'list-pipelines',
    );
    const body = asRecord(response.body);
    const pipelines = Array.isArray(body.pipelines) ? body.pipelines : [];
    return pipelines.map(mapPipeline);
  });

export const createLeadConnectorNote = (input: {
  workspaceId: string;
  contactId: string;
  body: string;
  userId?: string;
}) =>
  Effect.gen(function* () {
    const { accessToken } = yield* getProviderContext(input.workspaceId);
    const response = yield* requestLeadConnector(
      {
        method: 'POST',
        url: yield* providerUrl(
          `/contacts/${encodeURIComponent(input.contactId)}/notes`,
        ),
        headers: providerHeaders(accessToken),
        body: {
          body: input.body,
          ...(input.userId ? { userId: input.userId } : {}),
        },
      },
      'create-note',
    );
    return response.body;
  });

export const createLeadConnectorTask = (input: {
  workspaceId: string;
  contactId: string;
  title: string;
  dueDate: string;
  description?: string;
  assignedTo?: string;
}) =>
  Effect.gen(function* () {
    const { accessToken } = yield* getProviderContext(input.workspaceId);
    const response = yield* requestLeadConnector(
      {
        method: 'POST',
        url: yield* providerUrl(
          `/contacts/${encodeURIComponent(input.contactId)}/tasks`,
        ),
        headers: providerHeaders(accessToken),
        body: {
          title: input.title,
          dueDate: input.dueDate,
          ...(input.description ? { description: input.description } : {}),
          ...(input.assignedTo ? { assignedTo: input.assignedTo } : {}),
        },
      },
      'create-task',
    );
    return response.body;
  });

export const recordLeadConnectorDisposition = (input: {
  workspaceId: string;
  contactId: string;
  disposition: string;
  note?: string;
  tags?: string[];
}) =>
  Effect.gen(function* () {
    yield* createLeadConnectorNote({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      body: [`Call disposition: ${input.disposition}`, input.note]
        .filter(Boolean)
        .join('\n'),
    });
    if (input.tags && input.tags.length > 0) {
      const { accessToken } = yield* getProviderContext(input.workspaceId);
      yield* requestLeadConnector(
        {
          method: 'PUT',
          url: yield* providerUrl(
            `/contacts/${encodeURIComponent(input.contactId)}`,
          ),
          headers: providerHeaders(accessToken),
          body: { tags: input.tags },
        },
        'update-contact-tags',
      );
    }
    return { recorded: true as const };
  });
