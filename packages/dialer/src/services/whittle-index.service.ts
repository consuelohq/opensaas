import type { WhittleIndexInput, WhittleIndexResult } from '../types.js';

const DEFAULT_EXPLORATION_WEIGHT = 0.1;

export class WhittleIndexService {
  computeIndex(input: WhittleIndexInput): WhittleIndexResult {
    const expectedReward = input.answerRate * input.valuePerConnection;
    const cost = input.costPerAttempt;
    const urgencyBonus =
      input.valuePerConnection *
      (1 / Math.max(Math.trunc(input.hoursRemainingInWindow), 1));
    const explorationWeight =
      input.explorationWeight ?? DEFAULT_EXPLORATION_WEIGHT;
    const explorationBonus =
      input.valuePerConnection *
      (explorationWeight / Math.sqrt(Math.max(input.segmentSampleSize, 1)));
    const index = expectedReward - cost + urgencyBonus + explorationBonus;

    return {
      index,
      components: {
        expectedReward,
        cost,
        urgencyBonus,
        explorationBonus,
      },
    };
  }

  rankCandidates(
    candidates: Array<{
      contactId: string;
      position: number;
      input: WhittleIndexInput;
    }>,
  ): Array<{
    contactId: string;
    index: number;
    position: number;
    components: WhittleIndexResult['components'];
  }> {
    return candidates
      .map((candidate) => {
        const result = this.computeIndex(candidate.input);

        return {
          contactId: candidate.contactId,
          index: result.index,
          position: candidate.position,
          components: result.components,
        };
      })
      .sort((left, right) => {
        if (right.index !== left.index) {
          return right.index - left.index;
        }

        return left.position - right.position;
      });
  }
}
