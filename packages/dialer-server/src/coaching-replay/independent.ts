import frozen from './independent-cases.json';
import type { CardId, Scenario } from './fixtures';

// Independent, provisional labels frozen before the reviewed matcher was evaluated.
const families: readonly CardId[] = [
  'affordability',
  'existing-coverage',
  'employer-coverage',
  'spouse-and-family',
  'beneficiaries',
  'application-and-underwriting',
];
export const independentScenarios: readonly Scenario[] = frozen.map(
  (item, index) => ({
    id: item.id,
    family: families[Math.floor((index < 24 ? index : (index - 24) * 2) / 4)]!,
    partition: 'holdout',
    text: item.text,
    acceptableCardIds: item.acceptableCardIds as CardId[],
    windowMs: [item.startMs, item.endMs],
  }),
);
