import { Effect } from 'effect';

import type {
  LeadConnectorContact,
  LeadConnectorOpportunity,
  LeadConnectorPipeline,
  LeadConnectorQueuePreview,
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

type LeadConnectorOpportunitySearchItem = {
  opportunity: LeadConnectorOpportunity;
  contact: LeadConnectorContact | null;
};

type LeadConnectorOpportunitySearchPage = {
  items: LeadConnectorOpportunitySearchItem[];
  total: number;
  nextPage: number | null;
};

const searchLeadConnectorOpportunityPage = (input: {
  workspaceId: string;
  query?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string;
  limit?: number;
  page?: number;
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
          query: input.query ?? '',
          sort: [{ field: 'date_added', direction: 'desc' }],
          filters: [
            ...(input.pipelineId
              ? [
                  {
                    field: 'pipeline_id',
                    operator: 'eq',
                    value: [input.pipelineId],
                  },
                ]
              : []),
            ...(input.stageId
              ? [
                  {
                    field: 'pipeline_stage_id',
                    operator: 'eq',
                    value: [input.stageId],
                  },
                ]
              : []),
            ...(input.status
              ? [
                  {
                    field: 'status',
                    operator: 'eq',
                    value: [input.status],
                  },
                ]
              : []),
          ],
          ...(input.limit ? { limit: input.limit } : {}),
          ...(input.page ? { page: input.page } : {}),
          includeTopRelations: true,
        },
      },
      'search-opportunities',
    );
    const body = asRecord(response.body);
    const rawOpportunities = Array.isArray(body.opportunities)
      ? body.opportunities
      : [];
    const meta = asRecord(body.meta);
    const items = rawOpportunities.map((value) => {
      const record = asRecord(value);
      const rawContact = asRecord(record.contact);
      return {
        opportunity: mapOpportunity(value),
        contact:
          Object.keys(rawContact).length > 0 ? mapContact(rawContact) : null,
      } satisfies LeadConnectorOpportunitySearchItem;
    });
    return {
      items,
      total: readNumber(meta, 'total') ?? items.length,
      nextPage: readNumber(meta, 'nextPage', 'next_page'),
    } satisfies LeadConnectorOpportunitySearchPage;
  });

export const searchLeadConnectorOpportunities = (input: {
  workspaceId: string;
  query?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string;
  limit?: number;
}) =>
  searchLeadConnectorOpportunityPage({ ...input, page: 1 }).pipe(
    Effect.map((result) => ({
      opportunities: result.items.map((item) => item.opportunity),
      total: result.total,
    })),
  );

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


export const getLeadConnectorContact = (input: {
  workspaceId: string;
  contactId: string;
}) =>
  Effect.gen(function* () {
    const { accessToken } = yield* getProviderContext(input.workspaceId);
    const response = yield* requestLeadConnector(
      {
        method: 'GET',
        url: yield* providerUrl(
          `/contacts/${encodeURIComponent(input.contactId)}`,
        ),
        headers: providerHeaders(accessToken),
      },
      'get-contact',
    );
    const body = asRecord(response.body);
    return mapContact(body.contact ?? response.body);
  });

const contactDisplayName = (contact: LeadConnectorContact): string => {
  const composed = [contact.firstName, contact.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim();
  return contact.name?.trim() || composed || contact.email?.trim() || contact.id;
};

export const resolveLeadConnectorQueueCandidates = (input: {
  workspaceId: string;
  pipelineId: string;
  stageId: string;
}) =>
  Effect.gen(function* () {
    const [pipelines, firstPage] = yield* Effect.all(
      [
        listLeadConnectorPipelines(input.workspaceId),
        searchLeadConnectorOpportunityPage({
          workspaceId: input.workspaceId,
          pipelineId: input.pipelineId,
          stageId: input.stageId,
          status: 'open',
          limit: 100,
          page: 1,
        }),
      ] as const,
      { concurrency: 2 },
    );
    const itemsByOpportunityId = new Map(
      firstPage.items.map((item) => [item.opportunity.id, item]),
    );
    let currentPage = 1;
    let nextPage =
      firstPage.nextPage ??
      (itemsByOpportunityId.size < firstPage.total ? 2 : null);
    while (
      nextPage !== null &&
      nextPage > currentPage &&
      itemsByOpportunityId.size < firstPage.total &&
      currentPage < 100
    ) {
      const page = yield* searchLeadConnectorOpportunityPage({
        workspaceId: input.workspaceId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        status: 'open',
        limit: 100,
        page: nextPage,
      });
      const previousSize = itemsByOpportunityId.size;
      for (const item of page.items) {
        itemsByOpportunityId.set(item.opportunity.id, item);
      }
      currentPage = nextPage;
      if (itemsByOpportunityId.size === previousSize) break;
      nextPage =
        page.nextPage ??
        (itemsByOpportunityId.size < firstPage.total ? currentPage + 1 : null);
    }
    const items = [...itemsByOpportunityId.values()];
    const pipeline = pipelines.find((item) => item.id === input.pipelineId);
    const stage = pipeline?.stages.find((item) => item.id === input.stageId);
    const embeddedContacts = new Map<string, LeadConnectorContact>();
    for (const item of items) {
      if (item.contact?.id) embeddedContacts.set(item.contact.id, item.contact);
    }
    const missingContactIds = [
      ...new Set(
        items
          .map((item) => item.opportunity.contactId)
          .filter((value): value is string => Boolean(value))
          .filter((contactId) => !embeddedContacts.get(contactId)?.phone?.trim()),
      ),
    ];
    const hydratedContacts = yield* Effect.all(
      missingContactIds.map((contactId) =>
        getLeadConnectorContact({
          workspaceId: input.workspaceId,
          contactId,
        }),
      ),
      { concurrency: 8 },
    );
    const contactsById = new Map(embeddedContacts);
    for (const contact of hydratedContacts) contactsById.set(contact.id, contact);
    const candidates = items.flatMap(({ opportunity }) => {
      const contact = opportunity.contactId
        ? contactsById.get(opportunity.contactId)
        : undefined;
      const phone = contact?.phone?.trim();
      if (!contact || !phone) return [];
      return [
        {
          opportunityId: opportunity.id,
          contactId: contact.id,
          contactName: contactDisplayName(contact),
          phone,
          status: opportunity.status,
          monetaryValue: opportunity.monetaryValue,
        },
      ];
    });
    return {
      pipelineId: input.pipelineId,
      pipelineName: pipeline?.name || 'Pipeline',
      stageId: input.stageId,
      stageName: stage?.name || 'Stage',
      opportunityTotal: firstPage.total,
      callableTotal: candidates.length,
      truncated: items.length < firstPage.total,
      candidates,
    } satisfies LeadConnectorQueuePreview;
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
