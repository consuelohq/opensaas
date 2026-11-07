import { createHash } from 'node:crypto';
import { createDeliverySchedule } from './inbound-simulator';
export const createRepCampaignPlan = (
  seed: number,
  reps: number,
  callers = reps + 1,
) => {
  if (
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > 20 ||
    !Number.isInteger(callers) ||
    callers < reps ||
    callers > 40
  )
    throw new Error('Campaign requires seed uint32 and 1–20 reps');
  const actors = Array.from(
    { length: reps },
    (_, i) => 'rep-' + String(i + 1).padStart(2, '0'),
  );
  const facts = Array.from(
    { length: callers },
    (_, i) => 'caller-' + String(i + 1).padStart(2, '0'),
  );
  const arrivals = createDeliverySchedule({
    seed,
    facts,
    copies: facts.map(() => 1),
    maxDelayMilliseconds: 250,
  }).map(({ fact, at }) => ({ caller: fact, at }));
  const digest = createHash('sha256')
    .update(JSON.stringify({ actors, arrivals }))
    .digest('hex');
  return { seed, reps, actors, arrivals, digest };
};
export const inspectCapacityInvariants = (
  rows: readonly {
    repId: string;
    owner: null | {
      assignmentId: string;
      requestId: string;
      endpoints: readonly { status: string }[];
    };
  }[],
) => {
  const violations: string[] = [];
  const reps = new Set<string>(),
    requests = new Set<string>(),
    assignments = new Set<string>();
  for (const row of rows) {
    if (reps.has(row.repId)) violations.push('duplicate-rep-capacity');
    reps.add(row.repId);
    if (!row.owner) continue;
    if (requests.has(row.owner.requestId))
      violations.push('duplicate-request-owner');
    requests.add(row.owner.requestId);
    if (assignments.has(row.owner.assignmentId))
      violations.push('duplicate-assignment-owner');
    assignments.add(row.owner.assignmentId);
    if (row.owner.endpoints.filter((e) => e.status === 'accepted').length > 1)
      violations.push('duplicate-endpoint-winner');
  }
  return { valid: violations.length === 0, violations, owners: requests.size };
};
