# Railway exclusion

`consuelo-design` must remain outside Railway deployment.

## rule

Railway-deployed packages should not import or depend on `consuelo-design`.

The production Railway Dockerfile uses explicit package COPY lines. Keep `packages/consuelo-design` absent from those COPY lists unless Ko approves a deployment boundary change.

Relevant deployment files:

- `Dockerfile`
- `packages/twenty-docker/twenty/Dockerfile`

## verification

Run:

```bash
yarn workspace consuelo-design railway:check
```

The check verifies:

- known Railway Dockerfiles do not mention `consuelo-design`
- known deployed package manifests do not depend on `consuelo-design`

## current expected result

`consuelo-design` is a GitHub-visible tooling package and local design facade. It is not part of the app server, worker, frontend, API, dialer, contacts, coaching, logger, or metering runtime graph.
