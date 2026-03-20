// write tools — create_issue, update_issue, create_comment, update_comment
import { writeQuery } from '../graphql.js';
import { validateLabels, validateDescription } from '../validation.js';
import { getIdentity } from '../auth.js';

interface WriteResult {
  success: boolean;
  data?: unknown;
  warnings?: Array<{ field: string; message: string }>;
  error?: string;
}

export async function createIssue(params: {
  teamId: string;
  title: string;
  description?: string;
  parentId?: string;
  projectId?: string;
  stateId?: string;
  priority?: number;
  labelIds?: string[];
  labelNames?: string[];
  assigneeId?: string;
  skipValidation?: boolean;
}): Promise<WriteResult> {
  const warnings = [];

  if (!params.skipValidation) {
    if (params.labelNames?.length) warnings.push(...validateLabels(params.labelNames));
    if (params.description) warnings.push(...validateDescription(params.description));
  }

  const input: Record<string, unknown> = {
    teamId: params.teamId,
    title: params.title,
  };
  if (params.description) input.description = params.description;
  if (params.parentId) input.parentId = params.parentId;
  if (params.projectId) input.projectId = params.projectId;
  if (params.stateId) input.stateId = params.stateId;
  if (params.priority !== undefined) input.priority = params.priority;
  if (params.labelIds?.length) input.labelIds = params.labelIds;
  if (params.assigneeId) input.assigneeId = params.assigneeId;

  const res = await writeQuery(`mutation($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { id identifier title url } }
  }`, { input });

  const result = res.data?.issueCreate as { success: boolean; issue: unknown } | undefined;
  if (res.errors?.length) return { success: false, error: res.errors[0].message, warnings };
  return { success: result?.success ?? false, data: result?.issue, warnings };
}

export async function updateIssue(params: {
  issueId: string;
  title?: string;
  description?: string;
  stateId?: string;
  priority?: number;
  labelIds?: string[];
  labelNames?: string[];
  assigneeId?: string;
  parentId?: string;
  projectId?: string;
  skipValidation?: boolean;
}): Promise<WriteResult> {
  const warnings = [];

  if (!params.skipValidation) {
    if (params.labelNames?.length) warnings.push(...validateLabels(params.labelNames));
    if (params.description) warnings.push(...validateDescription(params.description));
  }

  const input: Record<string, unknown> = {};
  if (params.title) input.title = params.title;
  if (params.description) input.description = params.description;
  if (params.stateId) input.stateId = params.stateId;
  if (params.priority !== undefined) input.priority = params.priority;
  if (params.labelIds?.length) input.labelIds = params.labelIds;
  if (params.assigneeId) input.assigneeId = params.assigneeId;
  if (params.parentId) input.parentId = params.parentId;
  if (params.projectId) input.projectId = params.projectId;

  const res = await writeQuery(`mutation($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) { success issue { id identifier title url } }
  }`, { id: params.issueId, input });

  const result = res.data?.issueUpdate as { success: boolean; issue: unknown } | undefined;
  if (res.errors?.length) return { success: false, error: res.errors[0].message, warnings };
  return { success: result?.success ?? false, data: result?.issue, warnings };
}

export async function createComment(params: {
  issueId: string;
  body: string;
  addFooter?: boolean;
}): Promise<WriteResult> {
  const footer = params.addFooter !== false
    ? `\n\n---\n_posted by ${getIdentity()} via consuelo-linear-mcp_`
    : '';
  const body = params.body + footer;

  const res = await writeQuery(`mutation($input: CommentCreateInput!) {
    commentCreate(input: $input) { success comment { id body } }
  }`, { input: { issueId: params.issueId, body } });

  const result = res.data?.commentCreate as { success: boolean; comment: unknown } | undefined;
  if (res.errors?.length) return { success: false, error: res.errors[0].message };
  return { success: result?.success ?? false, data: result?.comment };
}

export async function updateComment(params: {
  commentId: string;
  body: string;
}): Promise<WriteResult> {
  const res = await writeQuery(`mutation($id: String!, $input: CommentUpdateInput!) {
    commentUpdate(id: $id, input: $input) { success comment { id body } }
  }`, { id: params.commentId, input: { body: params.body } });

  const result = res.data?.commentUpdate as { success: boolean; comment: unknown } | undefined;
  if (res.errors?.length) return { success: false, error: res.errors[0].message };
  return { success: result?.success ?? false, data: result?.comment };
}
