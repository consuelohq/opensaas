import request from 'supertest';

type GraphQLResponseError = {
  message: string;
};

type UnauthenticatedApiResponse = {
  body: {
    data: Record<string, unknown>;
    errors: GraphQLResponseError[];
  };
};

export const makeUnauthenticatedAPIRequest = async (
  query: string,
): Promise<UnauthenticatedApiResponse> => {
  const client = request(`http://localhost:${APP_PORT}`);

  return client
    .post('/metadata')
    .send({
      query,
    })
    .expect(200);
};
