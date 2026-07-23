export const vercelVersionFixture = {
  stdout: '50.1.3',
  stderr: 'Vercel CLI 50.1.3',
} as const;

export const vercelProjectInspectionFixture = `
> Project found

  General

    ID                   prj_123
    Name                 consuelo
    Framework Settings   Next.js
    Node.js Version      22.x
    Root Directory       packages/app
    Team ID              team_123
    Team Name            acme
    Scope                acme

  Domains

    consuelo.vercel.app
    consuelohq.com
`;

export const vercelProjectListFixture = {
  projects: [
    { id: 'prj_1', name: 'alpha' },
    { id: 'prj_2', name: 'beta' },
  ],
  pagination: { next: 1720000000000 },
} as const;

export const vercelDeploymentListFixture = `
> Deployments for acme/consuelo

  Age     Deployment                          Status       Environment     Duration     Username
  2m      https://dep-one.vercel.app          ● Ready      Production      45s          ko
  1h      https://dep-two.vercel.app          ● Error      Preview         12s          ko
`;

export const vercelDeploymentInspectionFixture = {
  id: 'dpl_123',
  url: 'dep-one.vercel.app',
  readyState: 'READY',
  createdAt: 1720000000000,
  projectId: 'prj_1',
  target: 'production',
} as const;

export const vercelRuntimeLogsFixture = [
  {
    message: 'started',
    timestamp: 1720000000000,
    level: 'info',
    source: 'lambda',
  },
  {
    message: 'complete',
    timestamp: '2026-07-23T12:00:00.000Z',
    level: 'warning',
    source: 'edge',
  },
] as const;

export const vercelEnvironmentListFixture = `
  name             type         environments             created
  DATABASE_URL     Encrypted    Production                2d ago
  FEATURE_FLAG     Plaintext    Preview, Development      3d ago
`;

export const vercelDomainListFixture = `
  name                 registrar     nameservers      expiration date     creator
  consuelohq.com       Vercel        Vercel           -                   ko
  example.net          Third Party   Third Party      -                   ko
`;
