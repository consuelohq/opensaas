import { assertSafeRelativePath } from '../fs';

export function assertSourceCaptureRelativePath(path: string): string {
  return assertSafeRelativePath(path);
}
