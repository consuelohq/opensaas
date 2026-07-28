export function runtimeReleaseDirectoryName(
  bundleId: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(bundleId)) {
    throw new Error(`invalid runtime bundle id: ${bundleId}`);
  }
  return platform === 'win32' ? bundleId.replace(':', '-') : bundleId;
}

export function runtimeBundleIdFromDirectoryName(
  directoryName: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const bundleId =
    platform === 'win32'
      ? directoryName.replace(/^sha256-/, 'sha256:')
      : directoryName;
  if (!/^sha256:[a-f0-9]{64}$/.test(bundleId)) {
    throw new Error(`invalid runtime release directory: ${directoryName}`);
  }
  return bundleId;
}
