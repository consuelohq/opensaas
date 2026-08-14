export function runtimeReleaseDirectoryName(
  bundleId: string,
  _platform: NodeJS.Platform = process.platform,
): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(bundleId)) {
    throw new Error(`invalid runtime bundle id: ${bundleId}`);
  }
  return bundleId.replace(':', '-');
}

export function runtimeBundleIdFromDirectoryName(
  directoryName: string,
  _platform: NodeJS.Platform = process.platform,
): string {
  const bundleId = directoryName.replace(/^sha256-/, 'sha256:');
  if (!/^sha256:[a-f0-9]{64}$/.test(bundleId)) {
    throw new Error(`invalid runtime release directory: ${directoryName}`);
  }
  return bundleId;
}
