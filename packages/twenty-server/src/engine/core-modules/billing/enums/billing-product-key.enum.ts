/* @license Enterprise */

import { registerEnumType } from '@nestjs/graphql';

export enum BillingProductKey {
  BASE_PRODUCT = 'BASE_PRODUCT',
  WORKFLOW_NODE_EXECUTION = 'WORKFLOW_NODE_EXECUTION',
  NUMBER_PACK_5 = 'NUMBER_PACK_5',
  NUMBER_PACK_10 = 'NUMBER_PACK_10',
  NUMBER_PACK_50 = 'NUMBER_PACK_50',
}

registerEnumType(BillingProductKey, {
  name: 'BillingProductKey',
  description: 'The different billing products available',
});
