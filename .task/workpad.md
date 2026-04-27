# fix railway docker chown build timeout

## acceptance criteria
- [x] start from stream/dialer task branch.
- [ ] inspect docker build path and identify why final chown layer is slow/canceling.
- [ ] avoid recursive chown over all of /app if not needed.
- [ ] keep runtime writable directories owned by app user.
- [ ] validate dockerfile syntax/build-relevant diff.
- [ ] publish through task workflow.
- [ ] redeploy and confirm railway build no longer spends 20m on final chown.

## plan
1. inspect dockerfiles and dockerignore.
2. find exact final stage file ownership requirements.
3. patch smallest safe dockerfile change.
4. validate with dockerfile parse/build-target if feasible and review diff.
5. push pr, merge stream, redeploy, inspect build logs.

## notes
- current observed failure: final layer  ran about 20 minutes then build canceled.

- 2026-04-27 20:26:08 write: `.task/workpad.md`
- 2026-04-27 20:26:49 patch lines 87-88: `packages/twenty-docker/twenty/Dockerfile`