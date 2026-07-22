import { MEDIA_SOURCE_CAPTURE_PLAN_SCHEMA, type SourceCapturePlan } from './schema';

const DEFAULT_MEDIA_INGEST_OUTPUTS = [
  'assets/source.mp4',
  'source.info.json',
  'transcript.vtt',
  'transcript.json',
  'thumbnails/',
  'media-asset.json',
  'ingest-manifest.json',
] as const;

type SourceCapturePlanInput = {
  source?: string;
  outDir?: string;
  dryRun?: boolean;
  format?: string;
};

function sourceKind(source: string): 'url' | 'file' {
  return source.startsWith('http://') || source.startsWith('https://') ? 'url' : 'file';
}

function buildYtDlpArgs(input: Required<Pick<SourceCapturePlanInput, 'source' | 'outDir'>> & Pick<SourceCapturePlanInput, 'format'>): string[] {
  const args = [
    '--no-playlist',
    '--write-info-json',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs',
    'en.*',
    '--convert-subs',
    'vtt',
    '--write-thumbnail',
    '--paths',
    input.outDir,
    '--output',
    'assets/source.%(ext)s',
  ];
  if (input.format) args.push('--format', input.format);
  args.push(input.source);
  return args;
}

export function mediaIngestOutputLayout(): string[] {
  return [...DEFAULT_MEDIA_INGEST_OUTPUTS];
}

export function createSourceCapturePlan(input: SourceCapturePlanInput): SourceCapturePlan {
  const source = input.source ?? '';
  const outDir = input.outDir ?? '';
  const commandPlan = sourceKind(source) === 'url'
    ? { command: 'yt-dlp', args: buildYtDlpArgs({ source, outDir, format: input.format }) }
    : { command: 'copy-file', args: [source, 'assets/source.mp4'] };

  return {
    schema: MEDIA_SOURCE_CAPTURE_PLAN_SCHEMA,
    source,
    outDir,
    dryRun: Boolean(input.dryRun),
    requiredProfiles: sourceKind(source) === 'url' ? ['media-youtube'] : ['media-core'],
    requiredCommands: sourceKind(source) === 'url' ? ['yt-dlp'] : [],
    outputs: mediaIngestOutputLayout(),
    commandPlan,
  };
}
