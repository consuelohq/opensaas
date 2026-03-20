// graphql client — thin wrapper around linear's API
import { getReadToken, getWriteToken, getIdentity } from './auth.js';

const ENDPOINT = 'https://api.linear.app/graphql';

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

async function query(gql: string, variables: Record<string, unknown>, token: string): Promise<GraphQLResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (res.status === 401) {
    throw new Error('TOKEN_EXPIRED');
  }
  return res.json() as Promise<GraphQLResponse>;
}

export async function readQuery(gql: string, variables: Record<string, unknown> = {}): Promise<GraphQLResponse> {
  return query(gql, variables, getReadToken());
}

export async function writeQuery(gql: string, variables: Record<string, unknown> = {}): Promise<GraphQLResponse> {
  const token = getWriteToken(getIdentity());
  if (!token) throw new Error(`no write token for ${getIdentity()}`);
  return query(gql, variables, token);
}
