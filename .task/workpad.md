# fix api parallel build type

branch: `task/dialer/fix-api-parallel-build-type`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/166

## problem

Railway/Docker build failed in `packages/api`:

```text
src/routes/parallel.ts(178,11): error TS2740: Type 'ParallelDialResult' is missing the following properties from type 'ParallelGroup': status, winnerSid, queueId, userId, and 3 more.
```

## root cause

The previous parallel caller-id lock fix declared the local initiation response as `ParallelGroup`:

```ts
let result: ParallelGroup;
result = await dialer.parallel.initiateGroup(...);
```

`packages/dialer/src/services/parallel-dialer.ts` declares `initiateGroup(opts): Promise<ParallelDialResult>`, and `packages/dialer/src/types.ts` exports `ParallelDialResult` as the lightweight initiation response shape with `groupId`, `conferenceName`, `profileId`, and `calls`.

The route still uses `ParallelGroup` elsewhere for callback/group reads, so only the initiation response annotation was wrong.

## fix

`packages/api/src/routes/parallel.ts`

- import `type ParallelDialResult` from `@consuelo/dialer`
- change the local `result` variable in `POST /v1/calls/parallel` from `ParallelGroup` to `ParallelDialResult`

No runtime behavior changed.

## validation

Passed:

```bash
git diff --check
```

Blocked in this sandbox:

```bash
cd packages/api && npx tsc
```

The local worktree does not have TypeScript installed/resolved, so `npx tsc` invokes the npm placeholder package and prints `This is not the tsc command you are looking for`. The production build error is still directly addressed by matching the variable type to the actual exported return type.
