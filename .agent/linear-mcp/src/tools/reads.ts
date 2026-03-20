// read tools — get_issue, list_issues, list_comments, get_project, list_teams, list_labels, list_cycles
import { readQuery } from '../graphql.js';

const ISSUE_FIELDS = `
  id identifier title state { name } priority
  assignee { name } labels { nodes { name } }
  project { name } parent { identifier title }
  description url createdAt updatedAt
`;

export async function getIssue(params: { issueId: string }) {
  const { issueId } = params;
  // try identifier first (DEV-123), fall back to UUID
  const isIdentifier = /^[A-Z]+-\d+$/.test(issueId);
  if (isIdentifier) {
    const res = await readQuery(`query($filter: IssueFilter) {
      issues(filter: $filter, first: 1) { nodes { ${ISSUE_FIELDS} } }
    }`, { filter: { number: { eq: parseInt(issueId.split('-')[1]) }, team: { key: { eq: issueId.split('-')[0] } } } });
    const nodes = (res.data?.issues as { nodes: unknown[] })?.nodes;
    return nodes?.[0] || { error: `issue ${issueId} not found` };
  }
  const res = await readQuery(`query($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`, { id: issueId });
  return res.data?.issue || { error: `issue ${issueId} not found` };
}

export async function listIssues(params: { teamId?: string; projectId?: string; query?: string; limit?: number }) {
  const { query: q, limit = 20 } = params;
  if (q) {
    const res = await readQuery(`query($q: String!, $first: Int) {
      searchIssues(query: $q, first: $first) { nodes { ${ISSUE_FIELDS} } }
    }`, { q, first: limit });
    return (res.data?.searchIssues as { nodes: unknown[] })?.nodes || [];
  }
  const filter: Record<string, unknown> = {};
  if (params.teamId) filter.team = { id: { eq: params.teamId } };
  if (params.projectId) filter.project = { id: { eq: params.projectId } };
  const res = await readQuery(`query($filter: IssueFilter, $first: Int) {
    issues(filter: $filter, first: $first, orderBy: updatedAt) { nodes { ${ISSUE_FIELDS} } }
  }`, { filter, first: limit });
  return (res.data?.issues as { nodes: unknown[] })?.nodes || [];
}

export async function listComments(params: { issueId: string }) {
  const issue = await getIssue(params);
  const id = (issue as { id?: string }).id;
  if (!id) return { error: 'issue not found' };
  const res = await readQuery(`query($id: String!) {
    issue(id: $id) { comments { nodes { id body user { name } createdAt } } }
  }`, { id });
  return (res.data?.issue as { comments: { nodes: unknown[] } })?.comments?.nodes || [];
}

export async function getProject(params: { projectId: string }) {
  const res = await readQuery(`query($id: String!) {
    project(id: $id) { id name description state startDate targetDate
      issues { nodes { identifier title state { name } } } }
  }`, { id: params.projectId });
  return res.data?.project || { error: 'project not found' };
}

export async function listTeams() {
  const res = await readQuery(`{ teams { nodes { id name key } } }`);
  return (res.data?.teams as { nodes: unknown[] })?.nodes || [];
}

export async function listLabels(params: { teamId?: string }) {
  const gql = params.teamId
    ? `query($id: String!) { team(id: $id) { labels { nodes { id name } } } }`
    : `{ issueLabels(first: 100) { nodes { id name } } }`;
  const vars = params.teamId ? { id: params.teamId } : {};
  const res = await readQuery(gql, vars);
  if (params.teamId) return (res.data?.team as { labels: { nodes: unknown[] } })?.labels?.nodes || [];
  return (res.data?.issueLabels as { nodes: unknown[] })?.nodes || [];
}

export async function listCycles(params: { teamId: string }) {
  const res = await readQuery(`query($id: String!) {
    team(id: $id) { cycles(first: 5, orderBy: createdAt) {
      nodes { id name number startsAt endsAt completedAt } } }
  }`, { id: params.teamId });
  return (res.data?.team as { cycles: { nodes: unknown[] } })?.cycles?.nodes || [];
}
