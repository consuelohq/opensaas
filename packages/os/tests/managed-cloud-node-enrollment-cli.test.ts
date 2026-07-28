import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type CliContract = {
  parseManagedCloudNodeEnrollmentArgs: (argv: string[]) => {
    home: string;
    onboardingPath: string;
    statusPath: string;
  };
};

async function loadContract(): Promise<CliContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'managed-cloud-node-enroll.ts'),
  ).href;
  return (await import(modulePath)) as CliContract;
}

describe('managed cloud node enrollment CLI', () => {
  it('parses explicit home, onboarding, and status paths', async () => {
    const { parseManagedCloudNodeEnrollmentArgs } = await loadContract();
    expect(
      parseManagedCloudNodeEnrollmentArgs([
        '--home',
        '/var/lib/consuelo',
        '--onboarding',
        '/var/lib/consuelo/bootstrap/onboarding.json',
        '--status',
        '/var/lib/consuelo/bootstrap/enrollment-status.json',
      ]),
    ).toEqual({
      home: '/var/lib/consuelo',
      onboardingPath: '/var/lib/consuelo/bootstrap/onboarding.json',
      statusPath: '/var/lib/consuelo/bootstrap/enrollment-status.json',
    });
  });

  it('requires all paths and wires the shared enrollment service', async () => {
    const { parseManagedCloudNodeEnrollmentArgs } = await loadContract();
    expect(() => parseManagedCloudNodeEnrollmentArgs([])).toThrow(/--home/);
    expect(() =>
      parseManagedCloudNodeEnrollmentArgs(['--home', '/var/lib/consuelo']),
    ).toThrow(/--onboarding/);

    const source = readFileSync(
      join(process.cwd(), 'scripts', 'managed-cloud-node-enroll.ts'),
      'utf8',
    );
    expect(source).toContain('runManagedCloudNodeEnrollment');
    expect(source).toContain('writeManagedCloudNodeEnrollmentStatus');
  });
});
