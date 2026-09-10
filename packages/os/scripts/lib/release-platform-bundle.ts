export type ReleasePlatformPointer = {
  platform?: string;
  architecture?: string;
  bundleId?: string;
};

const clean = (value: unknown): string => String(value ?? '').trim();

export function selectReleasePlatformBundleId(
  platforms: ReleasePlatformPointer[] | undefined,
  target: { platform: string; architecture: string },
): string {
  const platform = clean(target.platform);
  const architecture = clean(target.architecture);
  const selected = Array.isArray(platforms)
    ? platforms.find(
        (candidate) =>
          clean(candidate.platform) === platform &&
          clean(candidate.architecture) === architecture,
      )
    : undefined;

  if (!selected) {
    throw new Error(`release manifest does not publish ${platform}-${architecture}`);
  }

  const bundleId = clean(selected.bundleId);
  if (!/^sha256:[a-f0-9]{64}$/.test(bundleId)) {
    throw new Error(
      `release manifest platform ${platform}-${architecture} has invalid bundle ID`,
    );
  }
  return bundleId;
}
