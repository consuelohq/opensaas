import { createSourceCapturePlan } from './plan';

export const ytdlpRequiredProfiles = ['media-youtube'] as const;
export const ytdlpRequiredCommands = ['yt-dlp'] as const;

export function createYtDlpSourceCapturePlan(input: { source: string; outDir: string; dryRun?: boolean; format?: string }) {
  return createSourceCapturePlan(input);
}
