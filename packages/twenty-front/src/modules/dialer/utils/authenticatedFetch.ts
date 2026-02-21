import { getTokenPair } from '@/apollo/utils/getTokenPair';

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const tokenPair = getTokenPair();
  const headers = new Headers(options.headers);
  if (tokenPair?.accessToken?.token) {
    headers.set('Authorization', `Bearer ${tokenPair.accessToken.token}`);
  }
  return fetch(url, { ...options, credentials: 'include', headers });
};
