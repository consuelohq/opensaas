// output sanitization + resource limits (DEV-1022)

const MAX_OUTPUT_BYTES = 1_048_576; // 1MB
const MAX_CONCURRENT_RUNS = 3;

// strip HTML tags from agent output to prevent XSS
export const stripHtml = (text: string): string =>
  text.replace(/<[^>]*>/g, '');

// validate that a URL is an S3 presigned URL from our bucket
export const isAllowedFileUrl = (url: string, bucket: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === `${bucket}.s3.amazonaws.com` ||
      (parsed.hostname.endsWith('.amazonaws.com') && parsed.pathname.startsWith(`/${bucket}/`))
    );
  } catch {
    return false;
  }
};

// truncate output to maxBytes (default 1MB)
export const truncateOutput = (
  text: string,
  maxBytes: number = MAX_OUTPUT_BYTES,
): string => {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  // binary search for the right character cutoff
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (Buffer.byteLength(text.slice(0, mid), 'utf8') <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '\n[output truncated]';
};

// per-user concurrency guard for sandbox runs
export class ConcurrencyGuard {
  private active = new Map<string, number>();
  private maxConcurrent: number;

  constructor(maxConcurrent: number = MAX_CONCURRENT_RUNS) {
    this.maxConcurrent = maxConcurrent;
  }

  acquire(userId: string): boolean {
    const current = this.active.get(userId) ?? 0;
    if (current >= this.maxConcurrent) return false;
    this.active.set(userId, current + 1);
    return true;
  }

  release(userId: string): void {
    const current = this.active.get(userId) ?? 0;
    if (current <= 1) this.active.delete(userId);
    else this.active.set(userId, current - 1);
  }

  activeCount(userId: string): number {
    return this.active.get(userId) ?? 0;
  }
}
