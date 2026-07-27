import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { resolveConsueloHomeLayout } from './consuelo-home';

const presenceSchema = z.enum(['online', 'stale', 'offline']);
const workspaceIdSchema = z.string().min(1).refine(
  (value) => value !== '.'
    && value !== '..'
    && !value.includes('\0')
    && !/[\\/]/.test(value),
  'workspaceId must be a safe path segment',
);

const workspaceNodeSummarySchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().min(1),
  displayName: z.string().min(1),
  role: z.string().min(1),
  platform: z.string().min(1),
  architecture: z.string().min(1),
  channel: z.string().min(1),
  connectorId: z.string().min(1).nullable(),
  capabilities: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
  presence: presenceSchema,
  state: z.string().min(1),
  publicKeyThumbprint: z.string().min(1),
}).strict();

const workspaceNodeListSummarySchema = z.object({
  workspaceId: workspaceIdSchema,
  workspaceHost: z.string().min(1),
  currentNodeId: z.string().min(1).nullable(),
  currentNode: workspaceNodeSummarySchema.nullable(),
  defaultNodeId: z.string().min(1).nullable(),
  nodeCount: z.number().int().nonnegative(),
  presence: z.object({
    online: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
    offline: z.number().int().nonnegative(),
  }).strict(),
  nodes: z.array(workspaceNodeSummarySchema),
}).strict().superRefine((value, context) => {
  if (value.nodeCount !== value.nodes.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nodeCount'],
      message: 'nodeCount must equal nodes.length',
    });
  }
  const counted = value.presence.online + value.presence.stale + value.presence.offline;
  if (counted !== value.nodeCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['presence'],
      message: 'presence totals must equal nodeCount',
    });
  }
  if (value.nodes.some((node) => node.workspaceId !== value.workspaceId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nodes'],
      message: 'all nodes must belong to workspaceId',
    });
  }
  const current = value.currentNodeId
    ? value.nodes.find((node) => node.nodeId === value.currentNodeId)
    : undefined;
  if (value.currentNodeId && !current) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currentNodeId'],
      message: 'currentNodeId must reference a listed node',
    });
  }
  if (value.currentNodeId && value.currentNode?.nodeId !== value.currentNodeId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currentNode'],
      message: 'currentNode must match currentNodeId',
    });
  }
});

const workspaceNodeSummaryCacheSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('consuelo-workspace-node-summary-cache'),
  cachedAt: z.string().datetime(),
  summary: workspaceNodeListSummarySchema,
}).strict();

export type WorkspaceNodeSummary = z.infer<typeof workspaceNodeSummarySchema>;
export type WorkspaceNodeListSummary = z.infer<typeof workspaceNodeListSummarySchema>;
export type WorkspaceNodeSummaryCache = z.infer<typeof workspaceNodeSummaryCacheSchema> & {
  path: string;
};

export const WORKSPACE_NODE_SUMMARY_CACHE_FILE = 'workspace-nodes.json';

function validationDetail(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

export function parseWorkspaceNodeListSummary(value: unknown): WorkspaceNodeListSummary {
  const parsed = workspaceNodeListSummarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`invalid workspace node summary: ${validationDetail(parsed.error)}`);
  }
  return parsed.data;
}

export function workspaceNodeSummaryCachePath(home: string, workspaceId: string): string {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    throw new Error('workspaceId must be a safe path segment');
  }
  return path.join(
    resolveConsueloHomeLayout(home).nodeWorkspaceStateDir(parsedWorkspaceId.data),
    WORKSPACE_NODE_SUMMARY_CACHE_FILE,
  );
}

export function writeWorkspaceNodeSummaryCache(input: {
  home: string;
  summary: unknown;
  cachedAt?: string;
}): WorkspaceNodeSummaryCache {
  const summary = parseWorkspaceNodeListSummary(input.summary);
  const value = workspaceNodeSummaryCacheSchema.parse({
    schemaVersion: 1,
    kind: 'consuelo-workspace-node-summary-cache',
    cachedAt: input.cachedAt ?? new Date().toISOString(),
    summary,
  });
  const filePath = workspaceNodeSummaryCachePath(input.home, summary.workspaceId);
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return { ...value, path: filePath };
}

export function readWorkspaceNodeSummaryCache(
  home: string,
  workspaceId: string,
): WorkspaceNodeSummaryCache | null {
  const filePath = workspaceNodeSummaryCachePath(home, workspaceId);
  if (!fs.existsSync(filePath)) return null;
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    throw new Error('invalid workspace node summary cache: unreadable JSON');
  }
  const parsed = workspaceNodeSummaryCacheSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`invalid workspace node summary cache: ${validationDetail(parsed.error)}`);
  }
  if (parsed.data.summary.workspaceId !== workspaceId) {
    throw new Error('invalid workspace node summary cache: workspaceId mismatch');
  }
  return { ...parsed.data, path: filePath };
}
