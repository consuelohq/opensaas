import { mediaIngestOutputLayout } from './plan';

export function expectedSourceCaptureBundleLayout(): string[] {
  return mediaIngestOutputLayout();
}

export function hasSourceMediaPath(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const mediaAsset = record.mediaAsset;
  if (typeof mediaAsset !== 'object' || mediaAsset === null) return false;
  const asset = mediaAsset as Record<string, unknown>;
  return typeof asset.path === 'string' && asset.path.length > 0;
}
