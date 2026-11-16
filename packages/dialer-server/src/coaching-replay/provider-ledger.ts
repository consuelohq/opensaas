import {
  serializeProviderReport,
  type ProviderReport,
} from './provider-artifact';
import type { LedgerEntry } from './provider-budget';
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  openSync,
  realpathSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
/** One reviewed fingerprint gets one local attempt in its bound directory.
 * A crash leaves the lock in place; reruns require fresh review and directory. */
export function createProviderLedger(directory: string, fingerprint: string) {
  const stat = lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && stat.uid !== process.getuid()) ||
    !/^[a-f0-9]{64}$/.test(fingerprint)
  )
    throw new Error('invalid private provider directory');
  const canonical = realpathSync(directory),
    file = join(canonical, 'provider-run.lock');
  const fd = openSync(
    file,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  const opened = fstatSync(fd);
  if (
    !opened.isFile() ||
    (opened.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && opened.uid !== process.getuid())
  ) {
    closeSync(fd);
    throw new Error('invalid provider ledger');
  }
  let outputFd: number;
  try {
    outputFd = openSync(
      join(canonical, 'provider-replay-v1.json'),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error: unknown) {
    closeSync(fd);
    throw error;
  }
  let closed = false;
  const record = (entry: LedgerEntry) => {
    if (
      closed ||
      !Number.isSafeInteger(entry.attempts) ||
      entry.attempts < 0 ||
      !Number.isSafeInteger(entry.reservedNanoUsd) ||
      entry.reservedNanoUsd < 0 ||
      !Number.isSafeInteger(entry.spentNanoUsd) ||
      entry.spentNanoUsd < 0 ||
      !Number.isSafeInteger(entry.settlements) ||
      entry.settlements < 0 ||
      typeof entry.halted !== 'boolean'
    )
      throw new Error('invalid provider reservation');
    const bytes = Buffer.from(
      JSON.stringify({ schemaVersion: 1, fingerprint, ...entry }) + '\n',
    );
    ftruncateSync(fd, 0);
    if (writeSync(fd, bytes, 0, bytes.length, 0) !== bytes.length)
      throw new Error('provider ledger write failed');
    fsyncSync(fd);
  };
  try {
    record({
      attempts: 0,
      reservedNanoUsd: 0,
      spentNanoUsd: 0,
      settlements: 0,
      halted: false,
    });
  } catch (error: unknown) {
    closeSync(fd);
    closeSync(outputFd);
    throw error;
  }
  const writeReport = (report: ProviderReport) => {
    if (closed) throw new Error('provider ledger closed');
    const bytes = Buffer.from(serializeProviderReport(report));
    ftruncateSync(outputFd, 0);
    if (writeSync(outputFd, bytes, 0, bytes.length, 0) !== bytes.length)
      throw new Error('provider report write failed');
    fsyncSync(outputFd);
  };
  return {
    directory: canonical,
    record,
    writeReport,
    close: () => {
      if (!closed) {
        closed = true;
        closeSync(fd);
        closeSync(outputFd);
      }
    },
  };
}
