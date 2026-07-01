import { type ConfigVariableGraphQLError } from 'test/integration/twenty-config/types/config-variable-graphql-error.type';
import { type PerformTwentyConfigQueryParams } from 'test/integration/twenty-config/types/perform-twenty-config-query.type';

import {
  type CreateConfigVariableFactoryInput,
  createConfigVariableQueryFactory,
} from './create-config-variable.query-factory.util';
import { makeAdminPanelAPIRequest } from './make-admin-panel-api-request.util';

type CreateConfigVariableResponseData = {
  createDatabaseConfigVariable: boolean;
};

type ConfigVariableMutationResult = {
  data: CreateConfigVariableResponseData;
  errors: ConfigVariableGraphQLError[];
  rawResponse: {
    body: {
      data: CreateConfigVariableResponseData;
      errors: ConfigVariableGraphQLError[];
    };
  };
};

export const createConfigVariable = async ({
  input,
  expectToFail = false,
}: PerformTwentyConfigQueryParams<CreateConfigVariableFactoryInput>): Promise<ConfigVariableMutationResult> => {
  const graphqlOperation = createConfigVariableQueryFactory({
    key: input.key,
    value: input.value,
  });

  try {
    const response = await makeAdminPanelAPIRequest(graphqlOperation);

    if (!expectToFail) {
      expect(response.body.data).toBeDefined();
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.createDatabaseConfigVariable).toBeDefined();
    } else {
      // For failure cases, we'll check in the individual tests
    }

    return {
      data: response.body.data,
      errors: response.body.errors,
      rawResponse: response,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Config variable request failed with non-error value', {
      cause: error,
    });
  }
};
