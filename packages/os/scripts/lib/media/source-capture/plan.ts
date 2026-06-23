export function createSourceCapturePlan(input: unknown): Record<string, unknown> {
  const value = input as { source?: string; outDir?: string; dryRun?: boolean };
  return {
    schema: 'media.source-capture-plan.v1',
    source: value.source,
    outDir: value.outDir,
    dryRun: Boolean(value.dryRun),
    requiredProfiles: ['media-youtube'],
    requiredCommands: ['yt-dlp'],
    outputs: ['assets/source.mp4', 'source.info.json', 'transcript.vtt', 'transcript.json', 'thumbnails/', 'media-asset.json', 'ingest-manifest.json'],
    commandPlan: { command: 'yt-dlp', args: ['--write-info-json', '--write-subs', '--output', 'assets/source.mp4'] },
  };
}
