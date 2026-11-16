/** Provisional, synthetic labels: no customer speech or human adjudication. */
export type CardId =
  | 'affordability'
  | 'existing-coverage'
  | 'employer-coverage'
  | 'spouse-and-family'
  | 'beneficiaries'
  | 'application-and-underwriting';

export interface Scenario {
  readonly id: string;
  readonly family: CardId;
  readonly partition: 'calibration' | 'holdout';
  readonly text: string;
  readonly acceptableCardIds: readonly CardId[];
  readonly windowMs: readonly [number, number];
}

// Held-out phrases are separately authored, not mutations of calibration phrases.
// Every label is an intentionally reviewable hypothesis, not a gold standard.
const groups: readonly [CardId, readonly [string, boolean][]][] = [
  [
    'affordability',
    [
      ['The premium is too expensive for me.', true],
      ['I cannot afford that monthly payment.', true],
      ['This price does not fit my budget.', true],
      ['How much would coverage cost each month?', true],
      ['The rate is higher than I can pay.', true],
      ['Money is tight and I need a lower premium.', true],
      ['Could we find something gentler on my wallet?', true],
      ['I am worried about keeping up with the bill.', true],
      ['There is no room in our finances for that amount.', true],
      ['My paycheck will not stretch to this plan.', true],
      ['I heard someone say "the premium is too expensive" in a movie.', false],
      ['The price is affordable, so cost is not my concern.', false],
    ],
  ],
  [
    'existing-coverage',
    [
      ['I already have life insurance.', true],
      ['I have an existing policy with Prudential.', true],
      ['My current coverage is through State Farm.', true],
      ['I am insured already with a term policy.', true],
      ['I bought a policy from MetLife last year.', true],
      ['I have coverage from another insurer.', true],
      ['There is already a death benefit in place for me.', true],
      ['A contract I own would pay my family if I died.', true],
      ['Another company protects my family right now.', true],
      ['I have a separate personal plan outside work.', true],
      ['I used to have a policy but it ended years ago.', false],
      ['I do not currently have any life insurance.', false],
    ],
  ],
  [
    'employer-coverage',
    [
      ['My employer provides life insurance.', true],
      ['I have coverage through my job.', true],
      ['My workplace policy is enough.', true],
      ['My company pays for my life insurance.', true],
      ['I get group coverage at work.', true],
      ['My benefits package already includes life insurance.', true],
      ['The policy comes with my employment.', true],
      ['My office gives staff a death benefit.', true],
      ['This is part of my employee benefits.', true],
      ['The plan my boss offers covers me.', true],
      ['My previous employer covered me but I left.', false],
      ['My job does not provide life coverage.', false],
    ],
  ],
  [
    'spouse-and-family',
    [
      ['I need to ask my spouse first.', true],
      ['I should discuss this with my husband.', true],
      ['My wife and I make these decisions together.', true],
      ['Can I talk to my partner before deciding?', true],
      ['I need to check with my family.', true],
      ['Let me consult my spouse about the policy.', true],
      ['We should sleep on it and decide as a couple.', true],
      ['My other half needs a say in this.', true],
      ['I will run this past my significant other.', true],
      ['We make financial choices jointly at home.', true],
      ['My spouse already agreed; I do not need to ask again.', false],
      ['The word "spouse" appears on that form.', false],
    ],
  ],
  [
    'beneficiaries',
    [
      ['Who can I name as a beneficiary?', true],
      ['Can my daughter be the beneficiary?', true],
      ['How do I change my beneficiaries?', true],
      ['I want my children to receive the payout.', true],
      ['Can I name more than one beneficiary?', true],
      ['What happens to the death benefit for my family?', true],
      ['Who gets the money when I pass away?', true],
      ['May I split the proceeds between my sons?', true],
      ['Can a trust receive the insurance payout?', true],
      ['I need to choose who receives the benefit.', true],
      ['The beneficiary question was settled last year.', false],
      ['Please do not change my beneficiary.', false],
    ],
  ],
  [
    'application-and-underwriting',
    [
      ['Will I need a medical exam?', true],
      ['Does underwriting ask about my health?', true],
      ['How long does the application take?', true],
      ['Will my medications affect approval?', true],
      ['Can I qualify with diabetes?', true],
      ['What health questions are on the application?', true],
      ['Would a doctor have to check me first?', true],
      ['How do you decide whether to accept me?', true],
      ['Will my medical history change eligibility?', true],
      ['Is a blood test required to get insured?', true],
      ['The old application was approved years ago.', false],
      ['I am not asking about a medical exam.', false],
    ],
  ],
];

export const scenarios: readonly Scenario[] = groups.flatMap(
  ([family, entries], group) =>
    entries.map(([text, positive], index) => ({
      id: `S${String(group * 12 + index + 1).padStart(3, '0')}`,
      family,
      partition: index < 6 ? ('calibration' as const) : ('holdout' as const),
      text,
      acceptableCardIds: positive ? [family] : [],
      windowMs: [0, 5000] as const,
    })),
);
