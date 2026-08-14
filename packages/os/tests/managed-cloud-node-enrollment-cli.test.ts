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

describe('entrypoint liveness', () => {
  // Regression: the entrypoint used main().catch(...). The module body then completes while the
  // enrollment poll is still pending, bun drains the event loop and exits 0 mid-poll, and the
  // operator authorization lands on a process that no longer exists. Observed on a cloud node as
  // beforeExit 0 then exit 0 roughly 8s in, with no output and no status write, which is why the
  // status file stayed on awaiting_authorization forever.
  //
  // Asserted at the source level on purpose: the device endpoints are hardcoded constants with no
  // env override, so a real poll loop cannot be driven in a test without reaching production, and
  // adding an override would make the authority redirectable.
  const source = readFileSync(
    join(process.cwd(), 'scripts', 'managed-cloud-node-enroll.ts'),
    'utf8',
  );

  it('awaits main so the poll cannot outlive the process', () => {
    expect(source).toContain('await main()');
  });

  it('never fires main and forgets it', () => {
    // Comments are stripped so prose describing the old shape cannot satisfy or break the check.
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    expect(code).not.toMatch(/main\(\)\s*\.catch/);
  });
});
